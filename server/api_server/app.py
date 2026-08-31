"""Standalone HTTP API server for KittyNotary.

Wraps api_helper.py as a REST endpoint for Vercel frontend deployment.
Deploy on Render, Railway, Fly.io, or any Python hosting.

Endpoints:
    POST /api/rpc  - Proxy to api_helper.py (same contract as Next.js route)
    GET  /health   - Health check
"""

import json
import os
import sys
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request
from flask_cors import CORS

# Add project root to path for imports
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "deploy"))

import run as r  # noqa: E402

app = Flask(__name__)
CORS(app, origins=["*"])

# Rate limiting (simple in-memory)
rate_hits: dict[str, list[float]] = {}
RATE_WINDOW_MS = 60_000
RATE_MAX_REQUESTS = 60


def is_rate_limited(ip: str) -> bool:
    import time
    now = time.time() * 1000
    recent = [t for t in rate_hits.get(ip, []) if now - t < RATE_WINDOW_MS]
    if len(recent) >= RATE_MAX_REQUESTS:
        rate_hits[ip] = recent
        return True
    recent.append(now)
    rate_hits[ip] = recent
    return False


ALLOWED_ACTIONS = {"read", "build", "views"}
READ_METHODS = {
    "get_count",
    "get_record",
    "get_record_by_id",
    "get_records_by_requester",
}
BUILD_METHODS = {"notarize"}
MAX_ARGS = 4
MAX_ARG_STRING = 2048
MAX_VIEWS_PER_BATCH = 12
ADDRESS_RE = __import__("re").compile(r"^0x[0-9a-fA-F]{40}$")

# Cache
CACHE_TTL_MS = 3000
response_cache: dict[str, tuple[float, Any]] = {}


def get_cached(key: str) -> Any | None:
    import time
    hit = response_cache.get(key)
    if hit and (time.time() * 1000 - hit[0]) < CACHE_TTL_MS:
        return hit[1]
    response_cache.pop(key, None)
    return None


def set_cached(key: str, body: Any) -> None:
    import time
    response_cache[key] = (time.time() * 1000, body)
    if len(response_cache) > 500:
        response_cache.clear()


def validate_args(args: Any) -> str | None:
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
    import re
    return re.sub(
        r"(?:[A-Za-z]:)?[\\/][\w\-. ]+\.(?:py|js|ts|mjs|json)",
        "[path]",
        message,
    )[:300]


def run_helper(args: list[str]) -> dict:
    """Run api_helper.py and return parsed JSON output."""
    import subprocess
    import os

    helper_path = str(ROOT / "deploy" / "api_helper.py")
    python_bin = os.environ.get("PYTHON_BIN", sys.executable)

    env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}

    for attempt in range(2):
        try:
            result = subprocess.run(
                [python_bin, helper_path] + args,
                capture_output=True,
                text=True,
                timeout=180,
                cwd=str(ROOT),
                env=env,
            )
            lines = result.stdout.strip().split("\n")
            if lines:
                return json.loads(lines[-1])
            return {"error": "empty helper output"}
        except subprocess.TimeoutExpired:
            if attempt == 1:
                return {"error": "helper timeout"}
        except Exception as e:
            if attempt == 1:
                return {"error": f"helper error: {str(e)[:200]}"}

    return {"error": "helper failed after retries"}


@app.route("/api/rpc", methods=["POST"])
def rpc_endpoint():
    ip = request.remote_addr or "unknown"
    if is_rate_limited(ip):
        return jsonify({"error": "Too many requests"}), 429

    try:
        body = request.get_json()
    except Exception:
        return jsonify({"error": "invalid json body"}), 400

    if not body:
        return jsonify({"error": "empty body"}), 400

    action = body.get("action")
    method = body.get("method")
    args = body.get("args", [])
    from_addr = body.get("from")
    views = body.get("views")

    if not isinstance(action, str) or action not in ALLOWED_ACTIONS:
        return jsonify({"error": f"action must be one of {', '.join(ALLOWED_ACTIONS)}"}), 400

    # Batched views
    if action == "views":
        if not isinstance(views, list) or len(views) == 0 or len(views) > MAX_VIEWS_PER_BATCH:
            return jsonify({"error": f"views must be 1..{MAX_VIEWS_PER_BATCH} items"}), 400
        for item in views:
            if not isinstance(item, dict) or not isinstance(item.get("method"), str):
                return jsonify({"error": "invalid view item"}), 400
            if item["method"] not in READ_METHODS:
                return jsonify({"error": f"method not allowed: {item['method']}"}), 400
            err = validate_args(item.get("args", []))
            if err:
                return jsonify({"error": err}), 400

        cache_key = json.dumps({"a": "views", "v": views})
        hit = get_cached(cache_key)
        if hit is not None:
            return jsonify(hit)

        result = run_helper(["views", "", json.dumps(views)])
        if "error" in result:
            return jsonify(result), 502
        set_cached(cache_key, result)
        return jsonify(result)

    if not isinstance(method, str):
        return jsonify({"error": "method must be a string"}), 400

    if action == "read" and method not in READ_METHODS:
        return jsonify({"error": f"method not allowed: {method}"}), 400
    if action == "build" and method not in BUILD_METHODS:
        return jsonify({"error": f"method not allowed: {method}"}), 400

    err = validate_args(args)
    if err:
        return jsonify({"error": err}), 400

    cmd_args = [action, method, json.dumps(args)]

    if action == "build":
        if not isinstance(from_addr, str) or not ADDRESS_RE.match(from_addr):
            return jsonify({"error": "build requires valid `from` address"}), 400
        cmd_args.append(from_addr)

    cacheable = action == "read" and method != "get_record_by_id"
    cache_key = json.dumps(cmd_args)
    if cacheable:
        hit = get_cached(cache_key)
        if hit is not None:
            return jsonify(hit)

    result = run_helper(cmd_args)
    if "error" in result:
        return jsonify({"error": sanitize_error(result["error"])}), 502

    if cacheable:
        set_cached(cache_key, result)

    return jsonify(result)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    r._load_env()
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=False)
