"""Persistent notarize: resubmit + poll until a new record lands on studionet.

Studionet consensus is slow and flaky (frequent TIMEOUT / NO_MAJORITY, record can
take 10-30 min). This script keeps resubmitting the SAME claim+url until
get_count increases, then verifies the record via every read method.
"""

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
me = client.local_account.address.lower()

_last_call = 0.0


def throttle(interval: float = 6.0) -> None:
    global _last_call
    elapsed = time.time() - _last_call
    if elapsed < interval:
        time.sleep(interval - elapsed)
    _last_call = time.time()


def gen_call(fn, *args, **kwargs):
    throttle(6.0)
    return client.read_contract(addr, fn, args=list(args), **kwargs)


def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def notarize_until_lands(claim: str, url: str, expected: int, overall_min: int = 90):
    deadline = time.time() + overall_min * 60
    attempts = 0
    last_tx = None
    while time.time() < deadline:
        attempts += 1
        log(f"submit notarize #{attempts} (target count={expected})")
        try:
            last_tx = client.write_contract(addr, "notarize", args=[claim, url])
            log(f"  tx: {last_tx}")
        except Exception as e:
            log(f"  submit error: {type(e).__name__} {str(e)[:120]}")
        step_deadline = time.time() + 10 * 60
        while time.time() < step_deadline:
            time.sleep(30)
            c = gen_call("get_count")
            log(f"  get_count={c}")
            if int(c) >= expected:
                log("RECORD LANDED")
                return int(c), last_tx
        log("  no landing in this window; resubmitting...")
    raise RuntimeError("record never landed within overall window")


def main():
    url = "https://en.wikipedia.org/wiki/List_of_earthquakes_in_Japan"
    claim = "Japan has recorded many earthquakes throughout its history"
    initial = int(gen_call("get_count"))
    log(f"contract={addr}\ninitial get_count={initial}")

    target = initial + 1
    count, tx = notarize_until_lands(claim, url, target)
    log(f"LANDED at count={count} tx={tx}")

    # verify new record
    rec = gen_call("get_record", target - 1)
    log(f"get_record({target-1}): {rec}")
    obj = json.loads(rec if isinstance(rec, str) else rec.decode())
    assert obj.get("claim") == claim, obj
    assert obj.get("source_url") == url, obj
    rid = obj.get("record_id")
    log(f"  verdict={obj.get('verdict')} confidence={obj.get('confidence')}")
    log(f"  requester={obj.get('requester')}")

    byid = gen_call("get_record_by_id", rid)
    log(f"get_record_by_id: {byid[:100]}")
    assert byid == rec or byid == rec.encode()

    # dedup: same claim+url -> count unchanged; requester sees it
    log("dedup test: resubmit same claim+url")
    try:
        dup = client.write_contract(addr, "notarize", args=[claim, url])
        log(f"  dup tx: {dup}")
    except Exception as e:
        log(f"  dup submit error: {e}")
    time.sleep(30)
    c2 = gen_call("get_count")
    log(f"  get_count after dup={c2}")
    assert int(c2) == count, f"dup changed count {c2}"

    rr = gen_call("get_records_by_requester", me)
    log(f"get_records_by_requester: {rr[:200]}")
    reqs = json.loads(rr if isinstance(rr, str) else rr.decode())
    assert isinstance(reqs, list) and len(reqs) >= target

    log("ALL LIVE WRITE/VIEW CHECKS PASSED")


if __name__ == "__main__":
    main()