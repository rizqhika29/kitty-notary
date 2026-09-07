"""Vercel Python serverless function – KittyNotary RPC.

Self-contained: uses genlayer-py directly, no subprocess calls.
Handles read, build, views actions for the AI Notary contract.
"""

import json
import os
import re
import time
from http.server import BaseHTTPRequestHandler

STATIC_CONSENSUS_MAIN = "0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575"

ALLOWED_ACTIONS = {"read", "build", "views"}
READ_METHODS = {
    "get_count", "get_record", "get_record_by_id", "get_records_by_requester",
}
BUILD_METHODS = {"notarize"}
MAX_ARGS = 4
MAX_ARG_STRING = 2048
MAX_VIEWS_PER_BATCH = 12
ADDRESS_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")

CACHE_TTL_MS = 3000
response_cache: dict[str, tuple[float, object]] = {}
_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client

    from genlayer_py import create_account, create_client, studionet

    rpc = os.environ.get("GENLAYER_RPC_URL", "https://studio.genlayer.com/api")
    privkey = os.environ.get("GENLAYER_PRIVATE_KEY")
    if not privkey:
        raise RuntimeError("GENLAYER_PRIVATE_KEY not set")

    account = create_account(privkey)
    _client = create_client(chain=studionet, endpoint=rpc, account=account)
    return _client


def _addr():
    a = os.environ.get("NEXT_PUBLIC_CONTRACT_ADDRESS")
    if not a:
        raise RuntimeError("NEXT_PUBLIC_CONTRACT_ADDRESS not set")
    return a


def get_cached(key: str):
    hit = response_cache.get(key)
    if hit and (time.time() * 1000 - hit[0]) < CACHE_TTL_MS:
        return hit[1]
    response_cache.pop(key, None)
    return None


def set_cached(key: str, body):
    response_cache[key] = (time.time() * 1000, body)
    if len(response_cache) > 500:
        response_cache.clear()


def validate_args(args):
    if not isinstance(args, list) or len(args) > MAX_ARGS:
        return f"args must be an array of at most {MAX_ARGS} items"
    for arg in args:
        if arg is not None and not isinstance(arg, (str, int, bool)):
            return "args may only contain strings, numbers, booleans or null"
        if isinstance(arg, str) and len(arg) > MAX_ARG_STRING:
            return f"string arguments are limited to {MAX_ARG_STRING} characters"
        if isinstance(arg, int) and not (-2**53 < arg < 2**53):
            return "numbers must be safe integers"
    return None


def sanitize_error(message: str) -> str:
    return re.sub(
        r"(?:[A-Za-z]:)?[\\/][\w\-. ]+\.(?:py|js|ts|mjs|json)", "[path]", message
    )[:300]


def handle_read(method: str, args: list) -> dict:
    client = _get_client()
    addr = _addr()
    result = client.read_contract(addr, method, args=args)
    return {"result": result}


def handle_views(views: list) -> dict:
    client = _get_client()
    addr = _addr()
    results = []
    for item in views:
        try:
            value = client.read_contract(addr, item["method"], args=item.get("args", []))
            results.append(value)
        except Exception:
            results.append(None)
    return {"result": results}


def handle_build(method: str, args: list, from_addr: str) -> dict:
    from eth_abi import encode as abi_encode
    from eth_utils import keccak
    from genlayer_py.abi import calldata
    from genlayer_py.abi.transactions import serialize
    from genlayer_py.contracts.utils import make_calldata_object

    client = _get_client()
    addr = _addr()

    data = [
        calldata.encode(make_calldata_object(method=method, args=args, kwargs=None)),
        False,
    ]
    serialized_data = serialize(data)

    consensus = client.chain.consensus_main_contract
    consensus_abi = consensus["abi"]
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

    return {
        "result": {
            "to": STATIC_CONSENSUS_MAIN,
            "data": encoded_data,
            "chainId": client.chain.id,
            "value": "0x0",
        }
    }


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/api/rpc":
            self._respond(404, {"error": "not found"})
            return

        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            body = json.loads(raw)
        except Exception:
            self._respond(400, {"error": "invalid json"})
            return

        if not body:
            self._respond(400, {"error": "empty body"})
            return

        action = body.get("action")
        method = body.get("method")
        args = body.get("args", [])
        from_addr = body.get("from")
        views = body.get("views")

        if not isinstance(action, str) or action not in ALLOWED_ACTIONS:
            self._respond(400, {"error": f"action must be one of {', '.join(ALLOWED_ACTIONS)}"})
            return

        # Batched views
        if action == "views":
            if not isinstance(views, list) or len(views) == 0 or len(views) > MAX_VIEWS_PER_BATCH:
                self._respond(400, {"error": f"views must be 1..{MAX_VIEWS_PER_BATCH} items"})
                return
            for item in views:
                if not isinstance(item, dict) or not isinstance(item.get("method"), str):
                    self._respond(400, {"error": "invalid view item"})
                    return
                if item["method"] not in READ_METHODS:
                    self._respond(400, {"error": f"method not allowed: {item['method']}"})
                    return
                err = validate_args(item.get("args", []))
                if err:
                    self._respond(400, {"error": err})
                    return

            ck = json.dumps({"a": "views", "v": views})
            hit = get_cached(ck)
            if hit is not None:
                self._respond(200, hit)
                return
            try:
                result = handle_views(views)
            except Exception as e:
                self._respond(502, {"error": sanitize_error(str(e))})
                return
            set_cached(ck, result)
            self._respond(200, result)
            return

        if not isinstance(method, str):
            self._respond(400, {"error": "method must be a string"})
            return

        if action == "read" and method not in READ_METHODS:
            self._respond(400, {"error": f"method not allowed: {method}"})
            return
        if action == "build" and method not in BUILD_METHODS:
            self._respond(400, {"error": f"method not allowed: {method}"})
            return

        err = validate_args(args)
        if err:
            self._respond(400, {"error": err})
            return

        if action == "build":
            if not isinstance(from_addr, str) or not ADDRESS_RE.match(from_addr):
                self._respond(400, {"error": "build requires valid `from` address"})
                return

        ck = json.dumps({"a": action, "m": method, "args": args, "f": from_addr})
        cacheable = action == "read" and method != "get_record_by_id"
        if cacheable:
            hit = get_cached(ck)
            if hit is not None:
                self._respond(200, hit)
                return

        try:
            if action == "read":
                result = handle_read(method, args)
            elif action == "build":
                result = handle_build(method, args, from_addr)
            else:
                self._respond(400, {"error": "unknown action"})
                return
        except Exception as e:
            self._respond(502, {"error": sanitize_error(str(e))})
            return

        if cacheable:
            set_cached(ck, result)
        self._respond(200, result)

    def do_GET(self):
        if self.path == "/api/health":
            self._respond(200, {"status": "ok"})
            return
        self._respond(404, {"error": "not found"})

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def _respond(self, status: int, data: dict):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self._cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    from http.server import HTTPServer

    port = int(os.environ.get("PORT", "8080"))
    server = HTTPServer(("0.0.0.0", port), handler)
    print(f"KittyNotary API listening on :{port}")
    server.serve_forever()
