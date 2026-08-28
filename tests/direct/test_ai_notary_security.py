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


def _mock_news(direct_vm, body=WEB_BODY, pattern=r".*"):
    direct_vm.mock_web(pattern, {"status": 200, "body": body})


def _mock_llm(direct_vm, response=VERIFIED_LLM):
    direct_vm.mock_llm(r".*Evaluate whether the following claim.*", response)


def test_dedup_adds_second_requester(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    idx = contract.notarize("An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake")
    assert contract.get_count() == 1

    direct_vm.sender = direct_bob
    idx2 = contract.notarize("An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake")

    assert idx2 == idx
    assert contract.get_count() == 1
    bob_key = "0x" + direct_bob.hex()
    bob_records = json.loads(contract.get_records_by_requester(bob_key))
    assert bob_records == [str(idx)]


def test_dedup_same_requester_no_duplicate_entry(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    contract.notarize("An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake")
    contract.notarize("An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake")

    alice_key = "0x" + direct_alice.hex()
    alice_records = json.loads(contract.get_records_by_requester(alice_key))
    assert alice_records == ["0"]


def test_claim_too_long_rejected(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    with direct_vm.expect_revert("claim too long"):
        contract.notarize("x" * 501, "https://en.wikipedia.org/wiki/Earthquake")


def test_source_url_too_long_rejected(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    huge_url = "https://en.wikipedia.org/wiki/" + "a" * 2100
    with direct_vm.expect_revert("source_url too long"):
        contract.notarize("An earthquake hit Tokyo today", huge_url)


def test_rejects_non_http_scheme(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    with direct_vm.expect_revert("must start with"):
        contract.notarize("An earthquake hit Tokyo today", "ftp://en.wikipedia.org/wiki/X")


def test_rejects_userinfo_bypass_attempt(direct_vm, direct_deploy, direct_alice):
    """https://wikipedia.org:80@evil.com/ actually resolves to evil.com; the
    host parser must refuse it instead of matching 'wikipedia.org'."""
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    with direct_vm.expect_revert("domain not allowed"):
        contract.notarize(
            "An earthquake hit Tokyo today", "https://wikipedia.org:80@evil.com/"
        )


def test_requester_records_paginated_to_cap(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    total = 205
    for i in range(total):
        contract.notarize(f"Unique earthquake claim number {i}", URL)

    alice_key = "0x" + direct_alice.hex()
    mine = json.loads(contract.get_records_by_requester(alice_key))
    assert len(mine) == 200
    # keeps the most recent indices only
    assert str(total - 1) in mine
    assert "0" not in mine


def test_confidence_numeric_is_stored_as_basis_points(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    contract.notarize("An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake")

    record = json.loads(contract.get_record(0))
    assert record["confidence"] == 9500
    assert isinstance(record["confidence"], int)
    assert not isinstance(record["confidence"], float)


def test_confidence_out_of_range_clamped(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm, json.dumps({
        "verdict": "VERIFIED",
        "reason": "Article confirms the earthquake",
        "confidence": "1e999",
    }))

    contract.notarize("An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake")

    record = json.loads(contract.get_record(0))
    assert record["confidence"] == 0
    assert record["verdict"] == "VERIFIED"


def test_confidence_nan_stored_as_zero(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm, '{"verdict": "VERIFIED", "reason": "x", "confidence": "-inf"}')

    contract.notarize("An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake")

    record = json.loads(contract.get_record(0))
    assert record["confidence"] == 0


def test_validator_accepts_same_verdict_same_tier(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm, VERIFIED_LLM)  # leader: VERIFIED @ 0.95 (HIGH)

    contract.notarize("An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake")

    direct_vm.clear_mocks()
    _mock_news(direct_vm)
    _mock_llm(direct_vm, json.dumps({
        "verdict": "VERIFIED",
        "reason": "Article confirms the earthquake",
        "confidence": "0.9",  # same tier (HIGH)
    }))
    assert direct_vm.run_validator() is True


def test_validator_rejects_same_verdict_different_tier(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm, VERIFIED_LLM)  # leader: VERIFIED @ 0.95 (HIGH)

    contract.notarize("An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake")

    direct_vm.clear_mocks()
    _mock_news(direct_vm)
    _mock_llm(direct_vm, json.dumps({
        "verdict": "VERIFIED",
        "reason": "Article confirms the earthquake",
        "confidence": "0.4",  # LOW tier -> disagreement on weight
    }))
    assert direct_vm.run_validator() is False


def test_validator_tier_boundaries(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm, json.dumps({
        "verdict": "VERIFIED", "reason": "ok", "confidence": "0.8"  # HIGH boundary
    }))

    contract.notarize("An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake")

    for conf, expected in [("0.85", True), ("0.79", False), ("0.5", False)]:
        direct_vm.clear_mocks()
        _mock_news(direct_vm)
        _mock_llm(direct_vm, json.dumps({
            "verdict": "VERIFIED", "reason": "ok", "confidence": conf,
        }))
        assert direct_vm.run_validator() is expected


def test_validator_rejects_different_verdict(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm, VERIFIED_LLM)

    contract.notarize("An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake")

    direct_vm.clear_mocks()
    _mock_news(direct_vm)
    _mock_llm(direct_vm, NOT_VERIFIED_LLM)
    assert direct_vm.run_validator() is False


def test_allows_wikipedia_subdomain(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    index = contract.notarize(
        "An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake"
    )
    assert index == 0


def test_allows_reuters_domain(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    index = contract.notarize(
        "An earthquake hit Tokyo today", "https://www.reuters.com/world/earthquake"
    )
    assert index == 0


def test_allows_gov_domain(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    index = contract.notarize(
        "An earthquake hit Tokyo today",
        "https://www.example.gov/reports/earthquake",
    )
    assert index == 0


def test_allows_academic_domain(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    index = contract.notarize(
        "An earthquake hit Tokyo today", "https://www.nature.com/articles/123"
    )
    assert index == 0


def test_rejects_unknown_domain(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    with direct_vm.expect_revert("domain not allowed"):
        contract.notarize("An earthquake hit Tokyo today", "https://example.com/x")


def test_rejects_lookalike_domain(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    with direct_vm.expect_revert("domain not allowed"):
        contract.notarize(
            "An earthquake hit Tokyo today", "https://wikipedia.org.evil.com/x"
        )


def test_source_unavailable_forces_uncertain(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    direct_vm.mock_web(r".*wikipedia\.org/.*", {"status": 503, "body": b"down"})
    _mock_llm(direct_vm, VERIFIED_LLM)

    contract.notarize("An earthquake hit Tokyo today", "https://en.wikipedia.org/wiki/Earthquake")

    record = json.loads(contract.get_record(0))
    assert record["verdict"] == "UNCERTAIN"
    assert record["confidence"] == 0
    assert isinstance(record["confidence"], int)
