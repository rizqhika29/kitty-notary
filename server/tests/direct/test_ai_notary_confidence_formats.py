import json

import pytest

WEB_BODY = json.dumps({
    "title": "Earthquake hits Tokyo",
    "description": "A 5.0 magnitude earthquake struck Tokyo",
})

URL = "https://en.wikipedia.org/wiki/Earthquake"

NUMERIC_CONF_LLM = '{"verdict": "VERIFIED", "reason": "ok", "confidence": 0.95}'
INT_CONF_LLM = '{"verdict": "VERIFIED", "reason": "ok", "confidence": 1}'
MISSING_CONF_LLM = '{"verdict": "VERIFIED", "reason": "ok"}'


def _mock(direct_vm, llm):
    direct_vm.mock_web(r".*wikipedia\.org/.*", {"status": 200, "body": WEB_BODY})
    direct_vm.mock_llm(r".*Evaluate whether the following claim.*", llm)


def test_float_through_harness_degrades_safely(direct_vm, direct_deploy, direct_alice):
    """The gltest mock pipeline auto-parses mock text into a Python dict and
    its calldata bridge cannot carry floats, so exec_prompt yields nothing
    usable for this input. Production does not share that pipeline (the
    contract parses raw model text itself — see test_contract_pure_functions),
    but the required behaviour either way is: never crash, never store a
    fabricated verdict.
    """
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock(direct_vm, NUMERIC_CONF_LLM)
    contract.notarize("An earthquake hit Tokyo today", URL)
    record = json.loads(contract.get_record(0))
    assert record["verdict"] == "UNCERTAIN"
    assert record["confidence"] == 0
    assert isinstance(record["confidence"], int)


def test_int_confidence_one(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock(direct_vm, INT_CONF_LLM)
    contract.notarize("An earthquake hit Tokyo today", URL)
    record = json.loads(contract.get_record(0))
    assert record["verdict"] == "VERIFIED"
    assert record["confidence"] == 10000


def test_missing_confidence(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock(direct_vm, MISSING_CONF_LLM)
    contract.notarize("An earthquake hit Tokyo today", URL)
    record = json.loads(contract.get_record(0))
    assert record["verdict"] == "VERIFIED"
    assert record["confidence"] == 0


def test_validator_with_int_confidence_agrees(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock(direct_vm, INT_CONF_LLM)
    contract.notarize("An earthquake hit Tokyo today", URL)
    assert direct_vm.run_validator() is True
