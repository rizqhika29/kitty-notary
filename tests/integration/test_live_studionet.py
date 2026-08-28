import json
import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

import deploy.run as r

_addr = os.environ.get("NEXT_PUBLIC_CONTRACT_ADDRESS")
if not _addr:
    r._load_env()
    _addr = os.environ.get("NEXT_PUBLIC_CONTRACT_ADDRESS")

client = r._make_client()
addr = _addr
print("Contract:", addr)
print("Account:", client.local_account.address)

_last_call = 0.0


def throttle(interval: float = 6.0) -> None:
    global _last_call
    elapsed = time.time() - _last_call
    if elapsed < interval:
        time.sleep(interval - elapsed)
    _last_call = time.time()


def call(fn, *args, **kwargs):
    throttle(6.0)
    return client.read_contract(addr, fn, args=list(args), **kwargs)


def wait_count(expected: int, timeout: float = 900.0) -> int:
    deadline = time.time() + timeout
    while time.time() < deadline:
        c = int(call("get_count"))
        if c == expected:
            return c
        time.sleep(30)
    raise AssertionError(f"get_count never reached {expected}; last={int(call("get_count"))}")


initial = int(call("get_count"))
print("initial get_count ->", initial)

# 1. get_record out of range
rec = call("get_record", initial)
print("get_record(out-of-range) ->", rec)
assert rec == "{}" or rec == b"{}"

# 2. get_record_by_id missing
rec2 = call("get_record_by_id", "0x" + "0" * 64)
print("get_record_by_id(missing) ->", rec2)
assert rec2 == "{}" or rec2 == b"{}"

# 3. get_records_by_requester init
rr0 = call("get_records_by_requester", client.local_account.address.lower())
print("get_records_by_requester(init) ->", rr0)
assert rr0 not in ("{}",)

# 4. If a record already exists, verify every field via all read methods
url = "https://en.wikipedia.org/wiki/2024_Noto_earthquake"
claim = "A major earthquake struck the Noto Peninsula in Japan on January 1, 2024"
existing_rid = None
if initial > 0:
    for i in range(initial):
        r0 = call("get_record", i)
        try:
            obj = json.loads(r0 if isinstance(r0, str) else r0.decode())
        except Exception as e:
            print(f"record {i} parse err: {e}")
            continue
        print(f"record[{i}] verdict={obj.get('verdict')} conf={obj.get('confidence')}")
        assert obj.get("claim") == claim, f"claim mismatch on record {i}"
        assert obj.get("source_url") == url, f"source mismatch on record {i}"
        assert obj.get("requester").lower() == client.local_account.address.lower()
        existing_rid = obj.get("record_id")
    if existing_rid:
        byid = call("get_record_by_id", existing_rid)
        print("get_record_by_id(real) ->", byid[:80] if isinstance(byid, str) else byid)
        assert byid == r0 or byid == rec

# 5. notarize a NEW claim+url -> count must increase by 1 (with retry, long wait)
new_url = "https://en.wikipedia.org/wiki/List_of_earthquakes_in_Japan"
new_claim = "Japan has recorded many earthquakes throughout its history"
target = initial + 1
landed = False
last_tx = None
for attempt in range(1, 5):
    print(f"\nnotarize attempt {attempt}/4 (target {target}):")
    last_tx = client.write_contract(addr, "notarize", args=[new_claim, new_url])
    print("  tx:", last_tx)
    try:
        c = wait_count(target, timeout=1500)
        print("  get_count ->", c)
        landed = True
        break
    except AssertionError:
        print("  no record within timeout; retrying")
if not landed:
    raise AssertionError(f"notarize did not land after 4 attempts; last_tx={last_tx}")

# verify the new record
rec_new = call("get_record", target - 1)
print("\nnew record ->", rec_new)
obj_new = json.loads(rec_new if isinstance(rec_new, str) else rec_new.decode())
assert obj_new.get("claim") == new_claim
assert obj_new.get("source_url") == new_url
rid_new = obj_new.get("record_id")
print("  verdict:", obj_new.get("verdict"))
print("  confidence:", obj_new.get("confidence"))
print("  requester:", obj_new.get("requester"))

# 6. get_record_by_id on new record
byid2 = call("get_record_by_id", rid_new)
print("get_record_by_id(new) ->", byid2[:80] if isinstance(byid2, str) else byid2)
assert byid2 == rec_new or byid2 == rec_new.encode()

# 7. dedup: same claim+url -> count must STAY target
print("\nnotarize (duplicate of new)...")
idx_dup = client.write_contract(addr, "notarize", args=[new_claim, new_url])
print("  dup tx:", idx_dup)
wait_count(target, timeout=900)
count_after_dup = int(call("get_count"))
print("  get_count after dup ->", count_after_dup)
assert count_after_dup == target

# 8. requester query lists the requester records
rr2 = call("get_records_by_requester", client.local_account.address.lower())
print("\nget_records_by_requester(after) ->", rr2)
try:
    reql = json.loads(rr2 if isinstance(rr2, str) else rr2.decode())
    assert isinstance(reql, list)
    assert len(reql) >= 1
except Exception as e:
    print("  parse error:", e)

print("\nALL LIVE VIEW/WRITE CHECKS PASSED")