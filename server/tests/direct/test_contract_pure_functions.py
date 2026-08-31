"""Pure-function tests for ai_notary parsing/confidence logic.

These run OUTSIDE the GenVM: a minimal ``genlayer`` stub lets us import the
contract module so the static helpers (JSON extraction, basis-point parsing,
verdict comparison) can be exercised exactly as production will run them,
including model outputs that contain bare JSON floats — something the direct
VM harness cannot deliver (its mock pipeline swallows floats).
"""

import importlib.util
import json
import sys
import types
from pathlib import Path

CONTRACT_PATH = Path(__file__).resolve().parent.parent.parent / "contracts" / "ai_notary.py"


def _install_fake_genlayer() -> None:
    """Minimal stand-in so the contract module can be imported without GenVM."""
    if "genlayer" in sys.modules:
        return
    identity = lambda f: f  # noqa: E731
    gl = types.SimpleNamespace(
        Contract=type("Contract", (), {}),
        Event=type("Event", (), {"__init__": lambda self, *a, **k: None}),
        public=types.SimpleNamespace(view=identity, write=identity),
    )
    fake = types.ModuleType("genlayer")
    fake.gl = gl
    fake.Contract = gl.Contract
    fake.Event = gl.Event
    fake.public = gl.public
    fake.TreeMap = dict
    fake.u256 = int
    fake.Address = str  # only used in evaluated annotations
    fake.Keccak256 = object  # only instantiated inside method bodies
    sys.modules["genlayer"] = fake


_install_fake_genlayer()

_spec = importlib.util.spec_from_file_location("ai_notary_pure", CONTRACT_PATH)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
AINotary = _mod.AINotary

extract = AINotary._extract_json_object
bp = AINotary._confidence_bp
compare = AINotary._compare_verdicts
sanitize = AINotary._sanitize_verdict


# ---------------------------------------------------------------- extraction


def test_extract_parses_bare_float_confidence():
    raw = '{"verdict": "VERIFIED", "reason": "ok", "confidence": 0.95}'
    out = extract(raw)
    assert out == {"verdict": "VERIFIED", "reason": "ok", "confidence": 0.95}


def test_extract_from_fenced_and_prose_wrapped_output():
    fenced = '```json\n{"verdict": "UNCERTAIN", "reason": "x", "confidence": 0}\n```'
    assert extract(fenced)["verdict"] == "UNCERTAIN"
    noisy = 'Sure! Here is my analysis: {"verdict": "NOT_VERIFIED", "reason": "r", "confidence": "0.4"} hope that helps'
    assert extract(noisy)["verdict"] == "NOT_VERIFIED"


def test_extract_handles_python_repr_single_quotes():
    repr_text = "{'verdict': 'VERIFIED', 'reason': 'ok', 'confidence': 0.8}"
    assert extract(repr_text)["confidence"] == 0.8


def test_extract_passthrough_dict_and_rejects_garbage():
    d = {"verdict": "VERIFIED", "reason": "r", "confidence": 1}
    assert extract(d) is d
    assert extract("no json here") is None
    assert extract("{broken") is None
    assert extract(None) is None


# ------------------------------------------------------------- confidence bp


def test_bp_matrix():
    cases = {
        0.95: 9500,
        "0.95": 9500,
        "0.5": 5000,
        "1": 10000,
        1: 10000,
        1.0: 10000,
        "1.0": 10000,
        ".87": 8700,
        "87%": 10000,  # >1 clamps, same semantics as the legacy float clamp
        "150%": 10000,
        "1e999": 0,  # exponent form rejected -> no confidence
        "-inf": 0,
        "nan": 0,
        "": 0,
        None: 0,
        "-0.5": 0,  # negative treated as no confidence
        "abc": 0,
    }
    for value, expected in cases.items():
        got = bp(value)
        assert got == expected, f"bp({value!r}) == {got}, want {expected}"
        assert isinstance(got, int) and not isinstance(got, bool)


def test_bp_never_returns_float():
    for value in (0.12345, "0.99999", 2, "12.345678"):
        result = bp(value)
        assert isinstance(result, int)
        assert not isinstance(result, float)


# ------------------------------------------------------- sanitize idempotence


def test_sanitize_is_idempotent_and_float_free():
    raw_model = {"verdict": "VERIFIED", "reason": "ok", "confidence": 0.95}
    first = sanitize(raw_model)
    second = sanitize(first)
    assert first == second
    # consensus data carries confidence as TEXT (float objects must never
    # cross the calldata boundary); storage converts to basis-point int once
    conf = json.loads(json.dumps(second))["confidence"]
    assert isinstance(conf, str)
    stored = AINotary._confidence_bp(conf)
    assert isinstance(stored, int)
    assert not isinstance(stored, float)
    assert stored == 9500


def test_sanitize_fallbacks():
    assert sanitize(None)["verdict"] == "UNCERTAIN"
    assert sanitize("text")["reason"] == "invalid model output"
    weird = sanitize({"verdict": "HACKED", "reason": {"nested": 1}, "confidence": None})
    assert weird["verdict"] == "UNCERTAIN"
    assert weird["reason"] == "unavailable"


# ------------------------------------------------------------ compare / tiers


def test_compare_requires_category_and_tier_agreement():
    # consensus dicts carry the fractional text straight from _sanitize_verdict
    high = {"verdict": "VERIFIED", "reason": "a", "confidence": "0.95"}
    low = {"verdict": "VERIFIED", "reason": "b", "confidence": "0.04"}
    mid = {"verdict": "VERIFIED", "reason": "c", "confidence": "0.6"}
    assert compare(high, {"verdict": "VERIFIED", "reason": "x", "confidence": "0.9"})
    assert not compare(high, low)
    assert not compare(mid, low)
    assert not compare(high, {"verdict": "NOT_VERIFIED", "reason": "x", "confidence": "0.95"})


def test_compare_accepts_stored_bp_integers_too():
    high = {"verdict": "VERIFIED", "reason": "a", "confidence": 9500}
    low = {"verdict": "VERIFIED", "reason": "b", "confidence": 400}
    assert compare(high, {"verdict": "VERIFIED", "reason": "x", "confidence": 9000})
    assert not compare(high, low)


def test_compare_rejects_invalid_or_malformed_input():
    assert not compare(None, {"verdict": "VERIFIED", "reason": "x", "confidence": "1"})
    assert not compare({}, {})
    assert not compare({"verdict": "HACKED", "reason": "r", "confidence": "1"},
                       {"verdict": "HACKED", "reason": "r", "confidence": "1"})


def test_tier_boundaries_match_vm_tests():
    assert AINotary._tier("0.8") == "HIGH"
    assert AINotary._tier("0.7999") == "MEDIUM"
    assert AINotary._tier("0.5") == "MEDIUM"
    assert AINotary._tier("0.4999") == "LOW"
    assert AINotary._tier(8000) == "HIGH"
    assert AINotary._tier(4999) == "LOW"
