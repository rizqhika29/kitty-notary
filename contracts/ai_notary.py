# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *

VALID_VERDICTS = ("VERIFIED", "NOT_VERIFIED", "UNCERTAIN")
MAX_CLAIM_LENGTH = 500
MAX_SOURCE_LENGTH = 12000
MAX_SOURCE_URL_LENGTH = 2048
# Bound the read size of get_records_by_requester: return at most the N most
# recent record indices for one requester so a single view call stays small.
MAX_REQUESTER_RECORDS_RETURNED = 200

# Confidence travels through consensus and storage as an integer number of
# basis points (0..10000). Float arithmetic never appears in this contract.
CONFIDENCE_SCALE = 10000
# Validators must agree on a coarse confidence tier, not just the category.
TIER_HIGH_BP = 8000
TIER_MEDIUM_BP = 5000

ALLOWED_DOMAINS = (
    # Major news
    "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "cnn.com",
    "theguardian.com", "nytimes.com", "washingtonpost.com", "usatoday.com",
    "latimes.com", "nypost.com", "wsj.com", "ft.com", "economist.com",
    "bloomberg.com", "cnbc.com", "foxnews.com", "aljazeera.com",
    # Regional news
    "news.com.au", "abc.net.au", "nzherald.co.nz", "stuff.co.nz",
    "timeslive.co.za", "dawn.com", "tribune.com.pk", "rediff.com",
    "timesofindia.indiatimes.com", "hindustantimes.com", "ndtv.com",
    "thehindu.com", "indianexpress.com", "scroll.in", "thewire.in",
    "japantimes.co.jp", "japantoday.com", "mainichi.jp", "asahi.com",
    "nikkei.com", "koreatimes.co.kr", "koreaherald.com", "yna.co.kr",
    "globaltimes.cn", "scmp.com", "straitstimes.com", "channelnewsasia.com",
    "bangkokpost.com", "jakartapost.com", "manilatimes.net",
    "gulfnews.com", "khaleejtimes.com", "thenationalnews.com",
    "english.aawsat.com", "middleeasteye.net",
    # Fact-check / verification
    "themediafactchecker.com", "globalissues.org", "politifact.com",
    "factcheck.org", "snopes.com", "fullfact.org", "africacheck.org",
    "boomlive.in", "thequint.com", "smhoaxslayer.com",
    # Science / academia
    "nature.com", "science.org", "springer.com", "wiley.com",
    "elsevier.com", "plos.org", "pnas.org", "jstor.org",
    "arxiv.org", "biorxiv.org", "medrxiv.org", "pubmed.ncbi.nlm.nih.gov",
    "ncbi.nlm.nih.gov", "pubs.rsc.org", "acs.org", "ieee.org", "acm.org",
    "researchgate.net", "scholar.google.com",
    # Encyclopedias / references
    "wikipedia.org", "britannica.com", "worldometers.info",
    "ourworldindata.org",
    # International orgs
    "who.int", "un.org", "nato.int", "worldbank.org", "imf.org",
    "oecd.org", "wto.org", "icj-cij.org", "icc-cpi.int",
    "unicef.org", "undp.org", "unep.org", "unhcr.org", "ilo.org",
    "fao.org", "wfp.org", "unctad.org", "iom.int",
    # EU institutions
    "ec.europa.eu", "europarl.europa.eu", "consilium.europa.eu",
    "europa.eu", "ecb.europa.eu", "curia.europa.eu",
    # US government
    "defense.gov", "state.gov", "whitehouse.gov", "congress.gov",
    "supremecourt.gov", "nasa.gov", "noaa.gov", "cdc.gov", "nih.gov",
    "sec.gov", "epa.gov", "fda.gov", "ftc.gov", "fcc.gov",
    "usgs.gov", "data.gov", "congress.gov",
    # UK government
    "gov.uk", "parliament.uk",
    # Research / think tanks
    "rand.org", "cfr.org", "brookings.edu", "carnegieendowment.org",
    "chathamhouse.org", "sipri.org", "crisisgroup.org",
    "foreignpolicy.com", "foreignaffairs.com", "thediplomat.com",
    "warontherocks.com",
    # Tech news
    "techcrunch.com", "theverge.com", "wired.com", "arstechnica.com",
    "engadget.com", "gizmodo.com", "zdnet.com", "venturebeat.com",
    "tomsguide.com", "pcmag.com", "techradar.com", "howtogeek.com",
    "bleepingcomputer.com", "thehackernews.com", "krebsontsecurity.com",
    "securityweek.com", "darkreading.com", "cyberscoop.com",
    # Military / defense
    "defensenews.com", "militarytimes.com", "janes.com", "c4isrnet.com",
    "military.com", "stripes.com", "taskandpurpose.com",
    # Markets / finance
    "investing.com", "marketwatch.com", "finance.yahoo.com",
    "barrons.com", "fool.com", "seekingalpha.com",
)
GOVERNMENT_SUFFIXES = (".gov", ".gov.uk", ".go.id", ".go.jp", ".go.kr")


class NotarizedEvent(gl.Event):
    def __init__(self, index: u256, requester: Address, /, **blob):
        pass


class AINotary(gl.Contract):
    records: TreeMap[u256, str]
    record_ids: TreeMap[str, u256]
    requester_records: TreeMap[str, str]
    count: u256

    def __init__(self):
        self.count = u256(0)

    @gl.public.view
    def get_count(self) -> u256:
        return self.count

    @gl.public.view
    def get_record(self, index: u256) -> str:
        return self.records.get(index, "{}")

    @gl.public.view
    def get_record_by_id(self, record_id: str) -> str:
        index = self.record_ids.get(record_id)
        if index is None:
            return "{}"
        return self.records.get(index, "{}")

    @gl.public.view
    def get_records_by_requester(self, requester: str) -> str:
        items = self._parse_index_list(
            self.requester_records.get(requester.strip().lower(), "[]")
        )
        if len(items) > MAX_REQUESTER_RECORDS_RETURNED:
            items = items[-MAX_REQUESTER_RECORDS_RETURNED:]
        return json.dumps(items)

    @gl.public.write
    def notarize(self, claim: str, source_url: str) -> u256:
        claim = claim.strip()
        source_url = source_url.strip()
        if not claim:
            raise ValueError("claim must not be empty")
        if len(claim) > MAX_CLAIM_LENGTH:
            raise ValueError("claim too long")
        if not source_url:
            raise ValueError("source_url must not be empty")
        if len(source_url) > MAX_SOURCE_URL_LENGTH:
            raise ValueError("source_url too long")
        if not (source_url.startswith("https://") or source_url.startswith("http://")):
            raise ValueError("source_url must start with http(s)://")
        if not self._is_allowed_source(source_url):
            raise ValueError("source_url domain not allowed")

        requester = str(gl.message.sender_address).lower()
        record_id = self._make_id(claim, source_url)
        existing = self.record_ids.get(record_id)
        if existing is not None:
            self._append_requester_record(requester, existing)
            return existing

        url = source_url

        def leader_fn():
            content = AINotary._fetch_source(url)
            if content is None:
                return {"verdict": "UNCERTAIN", "reason": "source unavailable", "confidence": "0"}
            prompt = AINotary._build_prompt(claim, content)
            return AINotary._evaluate_prompt(prompt)

        def fetch_and_evaluate():
            content = AINotary._fetch_source(url)
            if content is None:
                return {"verdict": "UNCERTAIN", "reason": "source unavailable", "confidence": "0"}
            prompt = AINotary._build_prompt(claim, content)
            return AINotary._evaluate_prompt(prompt)

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            leader_data = leaders_res.calldata
            if not isinstance(leader_data, dict):
                return False
            return AINotary._compare_verdicts(leader_data, fetch_and_evaluate())

        # Docs-recommended pattern for custom validators: run_nondet_unsafe.
        # Our validator never throws (returns False on any disagreement), so
        # unhandled-exception-as-Disagree semantics are already satisfied.
        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        if isinstance(result, dict):
            verdict_data = self._sanitize_verdict(result)
        else:
            verdict_data = self._sanitize_verdict({})

        verdict = verdict_data.get("verdict")
        if verdict not in VALID_VERDICTS:
            verdict = "UNCERTAIN"

        index = self.count
        record = json.dumps({
            "record_id": record_id,
            "claim": claim,
            "source_url": url,
            "verdict": verdict,
            "reason": verdict_data.get("reason", ""),
            "confidence": AINotary._confidence_bp(verdict_data.get("confidence")),
            "requester": requester,
            "timestamp": gl.message_raw["datetime"],
        })

        self.records[index] = record
        self.record_ids[record_id] = index
        self._append_requester_record(requester, index)
        self.count = self.count + u256(1)

        NotarizedEvent(
            index,
            gl.message.sender_address,
            claim=claim,
            source_url=url,
            verdict=verdict,
        ).emit()

        return index

    @staticmethod
    def _parse_index_list(raw) -> list:
        """Parse a stored JSON array of record indices; never raise."""
        try:
            items = json.loads(raw)
        except (TypeError, ValueError):
            return []
        return items if isinstance(items, list) else []

    def _append_requester_record(self, requester: str, index) -> None:
        items = self._parse_index_list(self.requester_records.get(requester, "[]"))
        marker = str(index)
        if marker not in items:
            items.append(marker)
        self.requester_records[requester] = json.dumps(items)

    @staticmethod
    def _sanitize_verdict(data) -> dict:
        """Return a calldata-safe verdict dict: verdict enum plus reason/confidence
        as plain strings in their original textual form (e.g. "0.95").

        Basis-point conversion happens exactly once, at storage time; keeping
        this function free of conversion makes repeated sanitization idempotent
        (leader output passes through here before and after consensus).
        """
        if not isinstance(data, dict):
            return {"verdict": "UNCERTAIN", "reason": "invalid model output", "confidence": ""}
        verdict = data.get("verdict")
        if verdict not in VALID_VERDICTS:
            verdict = "UNCERTAIN"
        reason = data.get("reason")
        if not isinstance(reason, str):
            reason = "unavailable"
        conf = data.get("confidence")
        return {
            "verdict": verdict,
            "reason": reason,
            "confidence": "" if conf is None else str(conf),
        }

    @staticmethod
    def _confidence_bp(value) -> int:
        """Parse raw model confidence into integer basis points in [0, 10000].

        Integer math only (GenVM-safe): numeric inputs are normalized through
        their textual form; anything unparseable (exponents, inf/nan words,
        empty) becomes 0. A negative value is treated as no confidence.
        """
        if value is None:
            return 0
        if isinstance(value, bool):
            return CONFIDENCE_SCALE if value else 0
        text = str(value).strip().rstrip("%").strip()
        if not text:
            return 0
        negative = text[0] == "-"
        if text[0] in "+-":
            text = text[1:].strip()
        for ch in text:
            if ch not in "0123456789.":
                return 0
        parts = text.split(".")
        if len(parts) > 2:
            return 0
        int_part, frac_part = parts[0], parts[1] if len(parts) == 2 else ""
        if int_part == "" and frac_part == "":
            return 0
        int_val = int(int_part) if int_part else 0
        frac4 = (frac_part + "0000")[:4]
        total = int_val * CONFIDENCE_SCALE + int(frac4)
        if negative or total < 0:
            return 0
        return min(CONFIDENCE_SCALE, total)

    @staticmethod
    def _to_int(value, default: int = 0) -> int:
        try:
            return int(str(value).strip())
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _tier(value) -> str:
        """Coarse confidence bucket: validators must agree on weight too,
        not merely on the verdict category.

        Accepts either the fractional text carried through consensus
        (e.g. "0.95", straight from _sanitize_verdict) or an already-stored
        basis-point integer.
        """
        if (
            isinstance(value, int)
            and not isinstance(value, bool)
            and 0 <= value <= CONFIDENCE_SCALE
        ):
            bps = value
        else:
            bps = AINotary._confidence_bp(value)
        if bps >= TIER_HIGH_BP:
            return "HIGH"
        if bps >= TIER_MEDIUM_BP:
            return "MEDIUM"
        return "LOW"

    @staticmethod
    def _compare_verdicts(a: dict, b: dict) -> bool:
        """Validators agree on the verdict category AND its confidence tier."""
        if not isinstance(a, dict) or not isinstance(b, dict):
            return False
        if a.get("verdict") != b.get("verdict"):
            return False
        if a.get("verdict") not in VALID_VERDICTS:
            return False
        return AINotary._tier(a.get("confidence")) == AINotary._tier(b.get("confidence"))

    @staticmethod
    def _make_id(claim: str, source_url: str) -> str:
        h = Keccak256()
        h.update(claim.encode("utf-8"))
        h.update(b"\x00")
        h.update(source_url.encode("utf-8"))
        return h.hexdigest()

    @staticmethod
    def _fetch_source(url: str):
        response = gl.nondet.web.get(url)
        if response.status != 200:
            return None
        try:
            body = response.body.decode("utf-8")
        except Exception:
            return None
        if not body:
            return None
        return body[:MAX_SOURCE_LENGTH]

    @staticmethod
    def _is_allowed_source(url: str) -> bool:
        rest = url
        for scheme in ("https://", "http://"):
            if rest.startswith(scheme):
                rest = rest[len(scheme):]
                break
        else:
            return False
        host = rest
        for sep in ("/", "?", "#", ":"):
            idx = host.find(sep)
            if idx != -1:
                host = host[:idx]
                break
        host = host.strip().rstrip(".").lower()
        if not host:
            return False
        if any(ch not in "abcdefghijklmnopqrstuvwxyz0123456789.-" for ch in host):
            return False
        if host.endswith(GOVERNMENT_SUFFIXES):
            return True
        return any(host == d or host.endswith("." + d) for d in ALLOWED_DOMAINS)

    @staticmethod
    def _evaluate_prompt(prompt: str) -> dict:
        """Run the model and parse its output defensively.

        response_format="json" is deliberately avoided: the GenVM JSON mode
        fails (and on studionet, crashes the leader) when the model emits a
        bare float such as "confidence": 0.95. We take plain text and parse
        it ourselves instead.
        """
        raw = gl.nondet.exec_prompt(prompt)
        data = AINotary._extract_json_object(raw)
        if data is None:
            return {
                "verdict": "UNCERTAIN",
                "reason": "model output not parseable",
                "confidence": "",
            }
        return AINotary._sanitize_verdict(data)

    @staticmethod
    def _extract_json_object(text):
        """Best-effort extraction of a verdict dict from model output.

        Tolerates: a pre-parsed dict, strict JSON text, and Python-repr text
        (single quotes) since execution environments hand exec_prompt
        results back in different shapes.
        """
        if isinstance(text, dict):
            return text
        if not isinstance(text, str):
            return None
        start = text.find("{")
        if start == -1:
            return None
        depth = 0
        in_str = False
        escape = False
        for i in range(start, len(text)):
            ch = text[i]
            if in_str:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == '"':
                    in_str = False
                continue
            if ch == '"':
                in_str = True
            elif ch == "{" and not in_str:
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    candidate = text[start : i + 1]
                    try:
                        loaded = json.loads(candidate)
                    except (TypeError, ValueError):
                        try:
                            import ast

                            loaded = ast.literal_eval(candidate)
                        except (SyntaxError, ValueError, TypeError, MemoryError):
                            return None
                    return loaded if isinstance(loaded, dict) else None
        return None

    @staticmethod
    def _build_prompt(claim: str, content: str) -> str:
        return f"""You are an AI notary. Evaluate whether the following claim is supported by the provided source evidence.

Claim: {claim}

Source content (excerpt):
{content[:8000]}

Respond with ONLY a JSON object and nothing else. Every value must be a JSON string (quoted), including confidence as a decimal number between 0 and 1:
{{"verdict": "VERIFIED", "reason": "brief explanation", "confidence": "0.87"}}"""