import json

import pytest

WEB_BODY = json.dumps({
    "title": "Earthquake hits Tokyo",
    "description": "A 5.0 magnitude earthquake struck Tokyo at 3pm JST on July 30",
})

URL = "https://en.wikipedia.org/wiki/Earthquake"

VERIFIED_LLM = json.dumps({
    "verdict": "VERIFIED",
    "reason": "Article confirms the earthquake",
    "confidence": "0.95",
})

NOT_VERIFIED_LLM = json.dumps({
    "verdict": "NOT_VERIFIED",
    "reason": "Article does not mention the event",
    "confidence": "0.9",
})


def _mock_news(direct_vm, body=WEB_BODY):
    direct_vm.mock_web(r".*wikipedia\.org/.*", {"status": 200, "body": body})


def _mock_news_error(direct_vm):
    direct_vm.mock_web(r".*wikipedia\.org/.*", {"status": 503, "body": b"unavailable"})


def _mock_llm(direct_vm, response=VERIFIED_LLM):
    direct_vm.mock_llm(r".*Evaluate whether the following claim.*", response)


def test_notarize_and_get_count(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    contract.notarize("An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake")

    assert contract.get_count() == 1


def test_get_record(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    contract.notarize("An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake")

    record = json.loads(contract.get_record(0))
    assert record["claim"] == "An earthquake hit Tokyo today"
    assert record["verdict"] == "VERIFIED"
    assert record["source_url"] == "https://en.wikipedia.org/wiki/Earthquake"
    assert record["requester"].lower() == "0x" + direct_alice.hex()
    assert record["confidence"] == 9500
    assert isinstance(record["confidence"], int)
    assert not isinstance(record["confidence"], float)
    assert record["record_id"]
    assert record["timestamp"]


def test_duplicate_claim_is_deduplicated(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    index1 = contract.notarize("An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake")
    index2 = contract.notarize("An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake")

    assert index1 == index2
    assert contract.get_count() == 1


def test_lookup_by_record_id(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    contract.notarize("An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake")

    record = json.loads(contract.get_record(0))
    by_id = json.loads(contract.get_record_by_id(record["record_id"]))
    assert by_id["claim"] == record["claim"]
    assert contract.get_record_by_id("0x" + "0" * 64) == "{}"


def test_lookup_by_requester(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    contract.notarize("An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake")

    requester = json.loads(contract.get_record(0))["requester"]
    mine = json.loads(contract.get_records_by_requester(requester))
    assert len(mine) == 1
    assert mine[0] == "0"


def test_consensus_rejects_disagreeing_validator(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm, VERIFIED_LLM)

    contract.notarize("An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake")

    # Validator runs independently: if it sees disagreeing evidence it must return False.
    direct_vm.clear_mocks()
    _mock_news(direct_vm)
    _mock_llm(direct_vm, NOT_VERIFIED_LLM)
    assert direct_vm.run_validator() is False


def test_consensus_accepts_agreeing_validator(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm, VERIFIED_LLM)

    contract.notarize("An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake")

    # Same verdict + close confidence -> validator must accept.
    assert direct_vm.run_validator() is True


def test_unverified_verdict_is_recorded(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm, NOT_VERIFIED_LLM)

    contract.notarize("An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake")

    record = json.loads(contract.get_record(0))
    assert record["verdict"] == "NOT_VERIFIED"


def test_rejects_empty_claim(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    with direct_vm.expect_revert("claim"):
        contract.notarize("   ", "https://en.wikipedia.org/wiki/Earthquake")


def test_rejects_invalid_url(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    with direct_vm.expect_revert("source_url"):
        contract.notarize("Some claim", "not-a-url")


def test_handles_web_http_error(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    direct_vm.mock_web(r".*wikipedia\.org/.*", {"status": 503, "body": b"unavailable"})
    _mock_llm(direct_vm)

    contract.notarize("An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake")

    record = json.loads(contract.get_record(0))
    assert record["verdict"] == "UNCERTAIN"
    assert record["confidence"] == 0
    assert isinstance(record["confidence"], int)
