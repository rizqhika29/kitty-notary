"""HTTP-free bridge for the frontend: reads the contract and submits claims.

The npm `genlayer-js` package uses an outdated protocol (eth_call + RLP
[fn, argsString]) that the Studio RPC rejects. `genlayer-py` uses the current
`gen_call` protocol and is validated against studionet, so the frontend calls
this script through a Next.js API route.

Reads use the server account via `gen_call`. Writes are NOT signed here when
using real wallets: `build` returns the raw `addTransaction` payload
({to, data, chainId, value}) for the caller's address so the browser wallet
(MetaMask) can sign and broadcast it. This makes the on-chain `requester`
equal to the wallet address instead of the server account.

Security note: the HTTP API route only forwards `read` and `build`. The
server-key `write` command below is for local/admin CLI usage only.

Usage (all args positional, output is one JSON line on stdout):
    python deploy/api_helper.py read <method> [args_json]
    python deploy/api_helper.py write <method> <args_json>
    python deploy/api_helper.py build <method> <args_json> <from_addr>
"""

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "deploy"))

import run as r  # noqa: E402

# Studionet's RPC reports the consensus entrypoint as 0x000...0 via
# sim_getConsensusContract, but transactions carrying addTransaction data are
# accepted when addressed to the canonical ConsensusMain contract below too
# (verified live: record landed in <30s). Using it avoids MetaMask treating
# every submission as a send-to-burn-address.
STATIC_CONSENSUS_MAIN = "0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575"


def _output(obj) -> None:
    print(json.dumps(obj), flush=True)


def _finalize(result) -> int:
    _output({"result": result})
    return 0


def cmd_read(method: str, args_json: str) -> int:
    args = json.loads(args_json) if args_json else []
    addr = os.environ.get("NEXT_PUBLIC_CONTRACT_ADDRESS")
    client = r._make_client()
    if not client.local_account:
        _output({"error": "No account configured in .env (GENLAYER_PRIVATE_KEY)"})
        return 1
    result = client.read_contract(addr, method, args=args)
    return _finalize(result)


def cmd_write(method: str, args_json: str) -> int:
    args = json.loads(args_json) if args_json else []
    addr = os.environ.get("NEXT_PUBLIC_CONTRACT_ADDRESS")
    client = r._make_client()
    if not client.local_account:
        _output({"error": "No account configured in .env (GENLAYER_PRIVATE_KEY)"})
        return 1
    index = client.write_contract(addr, method, args=args)
    _output({"result": index})
    return 0


def cmd_build(method: str, args_json: str, from_addr: str) -> int:
    """Return {to,data,chainId,value} so the caller's wallet can sign+broadcast.

    Replicates genlayer-py's write_contract encoding (calldata + RLP + ABI
    addTransaction) with `from_addr` as the sender. Nothing is signed here;
    the wallet broadcasts `eth_sendTransaction({from, to, data})`.
    """
    import json as _json

    from eth_abi import encode as abi_encode
    from eth_utils import keccak
    from genlayer_py.abi import calldata
    from genlayer_py.abi.transactions import serialize
    from genlayer_py.contracts.utils import make_calldata_object

    args = _json.loads(args_json) if args_json else []
    addr = os.environ.get("NEXT_PUBLIC_CONTRACT_ADDRESS")
    client = r._make_client()

    data = [
        calldata.encode(make_calldata_object(method=method, args=args, kwargs=None)),
        False,
    ]
    serialized_data = serialize(data)

    consensus = client.chain.consensus_main_contract
    consensus_abi = consensus["abi"]
    consensus_address = consensus["address"]
    fn = next(f for f in consensus_abi if f.get("name") == "addTransaction")
    add_args = [
        from_addr,
        addr,
        client.chain.default_number_of_initial_validators,
        client.chain.default_consensus_max_rotations,
        bytes.fromhex(serialized_data[2:]),
    ]
    if len(fn["inputs"]) >= 6:
        add_args.append(0)
    signature = fn["name"] + "(" + ",".join(i["type"] for i in fn["inputs"]) + ")"
    selector = keccak(text=signature)[:4].hex()
    params = abi_encode([i["type"] for i in fn["inputs"]], add_args)
    encoded_data = "0x" + selector + params.hex()

    return _finalize(
        {
            "to": STATIC_CONSENSUS_MAIN,
            "data": encoded_data,
            "chainId": client.chain.id,
            "value": "0x0",
        }
    )


def cmd_views(batch_json: str) -> int:
    """Run several read-only views inside ONE process.

    Input: JSON list of {"method": str, "args": [..]} (max enforced upstream).
    Output result: list aligned with input; failed entries become null.
    Slashes spawn overhead from O(N) processes to exactly one per page load.
    """
    batch = json.loads(batch_json) if batch_json else []
    addr = os.environ.get("NEXT_PUBLIC_CONTRACT_ADDRESS")
    client = r._make_client()
    if not client.local_account:
        _output({"error": "No account configured in .env (GENLAYER_PRIVATE_KEY)"})
        return 1

    results: list = []
    for item in batch:
        try:
            value = client.read_contract(
                addr, item["method"], args=item.get("args", [])
            )
            results.append(value)
        except Exception:  # noqa: BLE001 - one bad view must not kill the batch
            results.append(None)
    return _finalize(results)


def main() -> int:
    r._load_env()
    if len(sys.argv) < 3:
        print(
            "usage: api_helper.py <read|write> <method> [args_json] | "
            "build <method> <args_json> <from_addr> | views <batch_json>",
            file=sys.stderr,
        )
        return 2
    try:
        action, method = sys.argv[1], sys.argv[2]
        args_json = sys.argv[3] if len(sys.argv) > 3 else ""
        if action == "read":
            return cmd_read(method, args_json)
        if action == "write":
            return cmd_write(method, args_json)
        if action == "build":
            if len(sys.argv) < 5:
                _output({"error": "build requires <method> <args_json> <from_addr>"})
                return 2
            return cmd_build(method, args_json, sys.argv[4])
        if action == "views":
            return cmd_views(args_json)
        print(f"unknown action {action!r}", file=sys.stderr)
        return 2
    except Exception as exc:  # noqa: BLE001
        _output({"error": f"{type(exc).__name__}: {str(exc)[:500]}"})
        return 1


if __name__ == "__main__":
    sys.exit(main())