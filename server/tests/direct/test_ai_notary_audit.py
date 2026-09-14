"""Tests for audit-trail fields: content_digest, content_excerpt, fetched_at,
expires_at, and re-notarize behaviour."""
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


def _mock_news(direct_vm, body=WEB_BODY):
    direct_vm.mock_web(r".*wikipedia\.org/.*", {"status": 200, "body": body})


def _mock_llm(direct_vm, response=VERIFIED_LLM):
    direct_vm.mock_llm(r".*Evaluate whether the following claim.*", response)


# ---------------------------------------------------------------------------
# content_digest
# ---------------------------------------------------------------------------

def test_record_has_content_digest(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    contract.notarize("An earthquake hit Tokyo today", URL)

    record = json.loads(contract.get_record(0))
    assert "content_digest" in record
    assert isinstance(record["content_digest"], str)
    assert len(record["content_digest"]) == 64  # keccak-256 hex


def test_same_content_produces_same_digest(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm, body='{"data": "identical"}')
    _mock_llm(direct_vm)

    contract.notarize("Claim A", URL)
    digest_a = json.loads(contract.get_record(0))["content_digest"]

    _mock_news(direct_vm, body='{"data": "identical"}')
    _mock_llm(direct_vm)

    contract.notarize("Claim B", URL)
    digest_b = json.loads(contract.get_record(1))["content_digest"]

    assert digest_a == digest_b


def test_different_content_produces_different_digest(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm, body='{"data": "version1"}')
    _mock_llm(direct_vm)

    contract.notarize("Claim A", URL)
    digest_a = json.loads(contract.get_record(0))["content_digest"]

    _mock_news(direct_vm, body='{"data": "version2"}')
    _mock_llm(direct_vm)

    contract.notarize("Claim B", URL)
    digest_b = json.loads(contract.get_record(1))["content_digest"]

    assert digest_a != digest_b


# ---------------------------------------------------------------------------
# content_excerpt
# ---------------------------------------------------------------------------

def test_record_has_content_excerpt(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    contract.notarize("An earthquake hit Tokyo today", URL)

    record = json.loads(contract.get_record(0))
    assert "content_excerpt" in record
    assert isinstance(record["content_excerpt"], str)
    assert len(record["content_excerpt"]) > 0


def test_excerpt_truncated_to_500_chars(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice

    long_body = "x" * 10000
    _mock_news(direct_vm, body=long_body)
    _mock_llm(direct_vm)

    contract.notarize("A claim about long text", URL)

    record = json.loads(contract.get_record(0))
    assert len(record["content_excerpt"]) == 500


def test_short_content_not_truncated(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice

    short_body = "Short content"
    _mock_news(direct_vm, body=short_body)
    _mock_llm(direct_vm)

    contract.notarize("A claim about short text", URL)

    record = json.loads(contract.get_record(0))
    assert record["content_excerpt"] == "Short content"


# ---------------------------------------------------------------------------
# fetched_at & expires_at
# ---------------------------------------------------------------------------

def test_record_has_fetched_at_and_expires_at(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    contract.notarize("An earthquake hit Tokyo today", URL)

    record = json.loads(contract.get_record(0))
    assert "fetched_at" in record
    assert "expires_at" in record
    assert isinstance(record["fetched_at"], int)
    assert isinstance(record["expires_at"], int)
    assert record["expires_at"] > record["fetched_at"]


def test_expires_at_is_90_days_after_fetched(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    contract.notarize("An earthquake hit Tokyo today", URL)

    record = json.loads(contract.get_record(0))
    ttl = record["expires_at"] - record["fetched_at"]
    assert ttl == 90 * 24 * 3600  # 7_776_000


def test_source_unavailable_has_empty_digest(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    direct_vm.mock_web(r".*wikipedia\.org/.*", {"status": 503, "body": b"down"})
    _mock_llm(direct_vm)

    contract.notarize("An earthquake hit Tokyo today", URL)

    record = json.loads(contract.get_record(0))
    assert record["verdict"] == "UNCERTAIN"
    assert record["content_digest"] == ""
    assert record["content_excerpt"] == ""


# ---------------------------------------------------------------------------
# re_notarize
# ---------------------------------------------------------------------------

def test_re_notarize_same_content_returns_same_index(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm, body='{"data": "v1"}')
    _mock_llm(direct_vm)

    idx1 = contract.notarize("An earthquake hit Tokyo today", URL)

    _mock_news(direct_vm, body='{"data": "v1"}')
    _mock_llm(direct_vm)

    idx2 = contract.re_notarize("An earthquake hit Tokyo today", URL)
    assert idx2 == idx1
    assert contract.get_count() == 1


def test_re_notarize_changed_content_creates_new_record(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm, body='{"data": "v1"}')
    _mock_llm(direct_vm)

    idx1 = contract.notarize("An earthquake hit Tokyo today", URL)
    old_record = json.loads(contract.get_record(idx1))

    _mock_news(direct_vm, body='{"data": "v2"}')
    _mock_llm(direct_vm)

    idx2 = contract.re_notarize("An earthquake hit Tokyo today", URL)
    assert idx2 != idx1
    assert contract.get_count() == 2

    new_record = json.loads(contract.get_record(idx2))
    assert new_record["parent_record_id"] == old_record["record_id"]
    assert new_record["parent_digest"] == old_record["content_digest"]
    assert new_record["content_digest"] != old_record["content_digest"]


def test_re_notarize_no_previous_record_creates_new(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    idx = contract.re_notarize("An earthquake hit Tokyo today", URL)
    assert idx == 0
    assert contract.get_count() == 1


def test_re_notarize_validates_inputs(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    with direct_vm.expect_revert("claim and source_url must not be empty"):
        contract.re_notarize("  ", URL)


def test_re_notarize_validates_domain(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm)
    _mock_llm(direct_vm)

    with direct_vm.expect_revert("domain not allowed"):
        contract.re_notarize("Some claim", "https://evil.com/x")


def test_re_notarize_record_has_parent_fields(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy("contracts/ai_notary.py")
    direct_vm.sender = direct_alice
    _mock_news(direct_vm, body='{"data": "v1"}')
    _mock_llm(direct_vm)

    contract.notarize("An earthquake hit Tokyo today", URL)

    _mock_news(direct_vm, body='{"data": "v2"}')
    _mock_llm(direct_vm)

    contract.re_notarize("An earthquake hit Tokyo today", URL)
    record = json.loads(contract.get_record(1))

    assert "parent_record_id" in record
    assert "parent_digest" in record
    assert record["parent_record_id"] != ""
    assert record["parent_digest"] != ""
