# AI Notary

An Intelligent Contract on GenLayer that verifies whether an online event has actually occurred, using decentralized AI validator consensus.

## How It Works

1. A user submits a **claim** about an online event along with a **source URL**
2. The contract fetches the source and sends it to an LLM to evaluate the claim
3. GenLayer validators independently re-fetch the source and re-evaluate the claim
4. Consensus is reached via GenLayer's equivalence principle: verdicts **and** confidence scores must agree
5. The notarization result (`VERIFIED`, `NOT_VERIFIED`, or `UNCERTAIN`) is stored on-chain permanently with an immutable `record_id` (Keccak-256 of claim + source URL)

## Project Structure

```
genlayer-ai-notary/
├── contracts/
│   └── ai_notary.py          # The Intelligent Contract
├── frontend/                  # Next.js frontend
│   ├── app/                   # App Router pages
│   ├── components/            # React components
│   ├── lib/                   # Contract integration & utilities
│   ├── hooks/                 # Custom React hooks
│   ├── types/                 # TypeScript types
│   ├── styles/                # Global styles
│   ├── public/                # Static assets
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   ├── middleware.ts
│   └── .env.example
├── tests/
│   ├── direct/                # In-memory direct-mode contract tests
│   │   ├── conftest.py        # Windows-safe harness workarounds
│   │   └── test_ai_notary.py
│   └── integration/           # (place integration tests here)
├── deploy/
│   └── run.py                 # Deploy + interact via genlayer-py
├── requirements.txt
├── pyproject.toml
├── .gitignore
└── README.md
```

## Quick Start

### 1. Python setup

```bash
cd genlayer-ai-notary
pip install -r requirements.txt
```

For development (test harness + pytest):

```bash
pip install -e ".[dev]"
```

### 2. Run the tests

```bash
pytest tests/direct/ -v
```

The suite covers notarization, record storage & lookup, deduplication, requester queries, consensus acceptance/rejection, input validation, and HTTP error handling.

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on http://localhost:3000 and connects to the contract at `NEXT_PUBLIC_CONTRACT_ADDRESS`. Copy `frontend/.env.example` to `frontend/.env.local` and set the deployed address.

### 4. Deploy

```bash
# optional: configure studionet + funded account in .env (see .env.example)
python deploy/run.py deploy
python deploy/run.py status
python deploy/run.py notarize "An earthquake hit Tokyo" "https://example.com/news/earthquake"
```

You can also deploy from [GenLayer Studio](https://studio.genlayer.com) by importing `contracts/ai_notary.py`.

## Contract API

| Method | Type | Description |
|--------|------|-------------|
| `notarize(claim, source_url)` | `write` | Submit a claim + source URL for notarization. Returns the record index. Re-submitting the same claim+URL is deduplicated. Emits a `NotarizedEvent`. |
| `get_count()` | `view` | Get total number of notarizations |
| `get_record(index)` | `view` | Get a notarization record by index (JSON string) |
| `get_record_by_id(record_id)` | `view` | Get a notarization record by its content hash |
| `get_records_by_requester(requester)` | `view` | Get record indices for a requester address (as hex string, `0x…`) |

### Record JSON shape

```json
{
  "record_id": "0x…",
  "claim": "An earthquake hit Tokyo today",
  "source_url": "https://example.com/news/earthquake",
  "verdict": "VERIFIED",
  "reason": "Article confirms the event",
  "confidence": 0.95,
  "requester": "0x…",
  "timestamp": "2026-08-17T11:09:02Z"
}
```

## Key Design Decisions

- **JSON output**: prompts force `response_format="json"` for parseable, comparable LLM responses
- **Calldata-safe results**: LLM floats (e.g. `0.95`) are not calldata-encodable on GenLayer, so `confidence` is transported as a string and normalized by the contract
- **Equivalence principle**: validators compare verdict **and** confidence (within ±0.2), not exact text
- **Content-addressed records**: `record_id = keccak256(claim + source_url)` makes every notarization unique and queryable
- **Input validation**: empty claims and malformed URLs are rejected before any external call
- **Events**: `NotarizedEvent` is emitted so indexers/dApps can watch new notarizations

## When to Use

AI Notary fits GenLayer when you need a **shared, on-chain judgment** about whether an online event occurred. If you only need to store a pre-computed result, a normal backend is simpler.

## Resources

- [GenLayer Docs](https://docs.genlayer.com)
- [GenLayer Discord](https://discord.gg/8Jm4v89VAu)
- [GenLayer Twitter/X](https://x.com/GenLayer)