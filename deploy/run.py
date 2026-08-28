"""Deploy and interact with the AI Notary contract using genlayer-py.

Usage:
    python deploy/run.py deploy            -- deploy the contract
    python deploy/run.py status            -- show deployed contract + count
    python deploy/run.py notarize "claim" <url>  -- write a notarization

Uses network/account from .env (see .env.example). Falls back to localnet
with a throwaway account when no .env is present.
"""

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTRACT_PATH = ROOT / "contracts" / "ai_notary.py"


def _load_env() -> None:
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def _make_client():
    _load_env()
    from genlayer_py import create_account, create_client
    from genlayer_py import studionet, localnet
    from genlayer_py.chains import localnet as localnet_chain

    network = os.environ.get("NEXT_PUBLIC_GENLAYER_NETWORK", "localnet")
    rpc = os.environ.get("GENLAYER_RPC_URL")
    account = None

    privkey = os.environ.get("GENLAYER_PRIVATE_KEY")
    if privkey:
        account = create_account(privkey)

    if account is None:
        account = create_account()
        print(f"[warn] No GENLAYER_PRIVATE_KEY in .env; using throwaway account")

    if network == "studionet":
        return create_client(chain=studionet, endpoint=rpc, account=account)
    return create_client(chain=localnet_chain, endpoint=rpc, account=account)


def _read_contract() -> str:
    return CONTRACT_PATH.read_text()


def cmd_deploy():
    code = _read_contract()
    print(f"Deploying {CONTRACT_PATH.name} ({len(code)} bytes)...")
    client = _make_client()
    tx_id = client.deploy_contract(code)
    print(f"Deploy transaction: {tx_id}")
    receipt = client.wait_for_transaction_receipt(
        transaction_hash=tx_id, full_transaction=True
    )
    addr = (
        (receipt.get("data") or {}).get("contract_address")
        or ((receipt.get("txDataDecoded") or {}).get("contractAddress"))
        or None
    )
    if not addr:
        print("Could not determine contract address from receipt")
        return None
    print(f"Deployed contract at: {addr}")
    print(f"Add to .env: NEXT_PUBLIC_CONTRACT_ADDRESS={addr}")
    return addr


def cmd_status():
    _load_env()
    addr = os.environ.get("NEXT_PUBLIC_CONTRACT_ADDRESS")
    if not addr:
        print("NEXT_PUBLIC_CONTRACT_ADDRESS not set in .env; run: python deploy/run.py deploy")
        return
    client = _make_client()
    count = client.read_contract(addr, "get_count")
    print(f"Contract:   {addr}")
    print(f"Record count: {count}")


def cmd_notarize(claim: str, url: str):
    _load_env()
    addr = os.environ.get("NEXT_PUBLIC_CONTRACT_ADDRESS")
    if not addr:
        print("NEXT_PUBLIC_CONTRACT_ADDRESS not set in .env; run: python deploy/run.py deploy")
        sys.exit(1)
    client = _make_client()
    index = client.write_contract(addr, "notarize", args=[claim, url])
    print(f"Notarized. index={index} tx={getattr(index, 'hex', lambda: index)() if hasattr(index, 'hex') else index}")
    rec = client.read_contract(addr, "get_record", args=[int(index)])
    print("Record:", rec)


def main():
    parser = argparse.ArgumentParser(description="AI Notary deploy tool")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("deploy", help="deploy contracts/ai_notary.py")
    sub.add_parser("status", help="show contract status")

    p_not = sub.add_parser("notarize", help="submit a claim for notarization")
    p_not.add_argument("claim")
    p_not.add_argument("url")

    args = parser.parse_args()
    if args.command == "deploy":
        cmd_deploy()
    elif args.command == "status":
        cmd_status()
    elif args.command == "notarize":
        cmd_notarize(args.claim, args.url)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()