<div align="center">

# KittyNotary

### AI-Powered On-Chain Fact Verification

**Verify claims. Store truth. Trust the consensus.**

[![License: MIT](https://img.shields.io/badge/License-MIT-pink.svg)](LICENSE)
[![GenLayer](https://img.shields.io/badge/Built%20on-GenLayer-blue.svg)](https://genlayer.com)
[![Tests](https://img.shields.io/badge/Tests-48%2F48-brightgreen.svg)](#testing)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js-black.svg)](https://nextjs.org)
[![Deploy](https://img.shields.io/badge/Deploy-Vercel-black.svg)](https://kitty-notary.vercel.app)

[Live Demo](https://kitty-notary.vercel.app) · [Contract](https://studio.genlayer.com) · [Report Bug](https://github.com/rizqhika29/kitty-notary/issues)

</div>

---

## What is KittyNotary?

KittyNotary is a **GenLayer Intelligent Contract** that verifies whether online events actually happened. Submit a claim + source URL, and decentralized AI validators will reach consensus on its truthfulness -- permanently stored on-chain.

```
Submit     ->  AI Leader  ->  Validators  ->  On-Chain
Claim         Evaluation      Consensus       Result
You           LLM reads       Multiple AI     Permanent
              your source     agree on truth  record
```

## How It Works

| Step | What Happens |
|------|--------------|
| **1. Submit** | User provides a claim + source URL via MetaMask |
| **2. Fetch** | Contract fetches content from the source URL |
| **3. Evaluate** | AI leader analyzes the claim against the source |
| **4. Validate** | Multiple validators independently re-evaluate |
| **5. Consensus** | Verdict + confidence must match across validators |
| **6. Store** | Result permanently stored with immutable `record_id` |

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Smart Contract** | Python (GenLayer SDK) |
| **Frontend** | Next.js 15, TypeScript, Tailwind CSS |
| **Wallet** | MetaMask, Viem |
| **RPC** | Pure TypeScript (no Python dependency) |
| **Network** | GenLayer Studionet |
| **Testing** | pytest, 48 test cases |

## Contract

**Address:** `0xBaAb55EA04643ED010e6f968b7a9dd0C75387c0e`
**Network:** GenLayer Studionet (chainId: 61999)
**Explorer:** [View on GenLayer Explorer](https://genlayer-explorer.vercel.app)

## Quick Start

### Prerequisites

- Node.js 18+
- MetaMask wallet
- GenLayer Studionet ETH (for deployment)

### 1. Clone & Install

```bash
git clone https://github.com/rizqhika29/kitty-notary.git
cd kitty-notary
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings:
# NEXT_PUBLIC_CONTRACT_ADDRESS=0xBaAb55EA04643ED010e6f968b7a9dd0C75387c0e
# NEXT_PUBLIC_RPC_ENDPOINT=https://studio.genlayer.com/api
# NEXT_PUBLIC_NETWORK=studionet
# GENLAYER_RPC_URL=https://studio.genlayer.com/api
```

### 3. Start Development

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### 4. Run Tests (Python, for contract only)

```bash
cd server
pip install -r requirements.txt
pytest tests/direct/ -v
```

## Project Structure

```
kitty-notary/
├── app/                        # Next.js App Router
│   ├── api/rpc/route.ts        # Pure TypeScript RPC (no Python)
│   ├── submit/                 # Claim submission page
│   ├── explorer/               # Browse all records
│   ├── records/                # My records page
│   └── dashboard/              # Analytics dashboard
├── components/                 # React components
│   ├── ClaimForm.tsx           # Submission form with wallet
│   ├── RecordsTable.tsx        # Records browser with filters
│   └── RecordDetailModal.tsx   # Detail view popup
├── lib/                        # Contract integration & utilities
│   ├── genlayer/               # Pure TS GenLayer RPC implementation
│   │   ├── calldata.ts         # ULEB128 tagged binary encoder
│   │   ├── rpc.ts              # gen_call + buildTransaction
│   │   └── chain.ts            # Studionet chain config
│   ├── contract.ts             # Frontend contract helpers
│   ├── wallet.tsx              # MetaMask wallet provider
│   └── utils.ts                # Utilities
├── server/                     # Backend (Python, for contract dev only)
│   ├── contracts/              # GenLayer Intelligent Contract
│   ├── deploy/                 # Deployment CLI & helper
│   └── tests/                  # Test suites (48 cases)
├── vercel.json                 # Vercel config
├── package.json                # Node.js dependencies
└── README.md
```

## Architecture

```
Browser (MetaMask)
       │
       ▼
Vercel (Next.js + TypeScript)
       │
       ├── GET /api/rpc  (read, views) --> GenLayer RPC (gen_call)
       └── POST /api/rpc (build)       --> Build tx payload for MetaMask
```

**No Python server needed.** The RPC calls are implemented in pure TypeScript:
- `lib/genlayer/calldata.ts` -- ULEB128 tagged binary encoder (replicates genlayer-py's calldata format)
- `lib/genlayer/rpc.ts` -- GenLayer JSON-RPC client (`gen_call`, `buildTransaction`)
- `lib/genlayer/chain.ts` -- Studionet chain config

## Contract API

### Write Methods

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `notarize` | `claim: str`, `source_url: str` | `u256` (index) | Submit a claim for verification |

### View Methods

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `get_count` | -- | `u256` | Total number of records |
| `get_record` | `index: u256` | `str` (JSON) | Get record by index |
| `get_record_by_id` | `record_id: str` | `str` (JSON) | Get record by content hash |
| `get_records_by_requester` | `requester: str` | `str` (JSON array) | Get indices for address |

### Record Schema

```json
{
  "record_id": "a1b2c3d4...",
  "claim": "Magnitude 5.0 earthquake struck Tokyo",
  "source_url": "https://reuters.com/article/...",
  "verdict": "VERIFIED",
  "reason": "Multiple sources confirm the seismic event...",
  "confidence": 8500,
  "requester": "0x1234...5678",
  "timestamp": 1693000000
}
```

> **Note:** Confidence is stored as basis points (0-10000). `8500` = 85% confidence.

## Features

### Per-User Wallet Integration
Every submission is signed by the user's own MetaMask wallet. The `requester` field on-chain = user's wallet address.

### Explorer & My Records
Browse all notarizations or filter by your own wallet. Click **Detail** to see full AI reasoning.

### Dashboard
Real-time stats: total records, verification rate, recent submissions.

### Batch Loading
Records are fetched in parallel batches for fast page loads (~8s cold start).

### Security Features
- Domain allowlist (150+ verified sources)
- Input validation (claim <=500 chars, URL <=2048 chars)
- Transaction receipt checking (immediate error detection)
- Client-side payload verification (selector + ABI decode)

### Record Detail Modal
Click any record to see:
- Full claim text
- Source URL (clickable)
- Verdict badge with confidence bar
- Complete AI reasoning
- On-chain metadata

## Testing

```bash
cd server
pytest tests/direct/ -v
```

**Test Coverage:**
- Notarization flow
- Record storage & lookup
- Deduplication
- Requester queries
- Consensus acceptance/rejection
- Input validation
- Confidence formats
- Edge cases

## Allowed Domains

The contract only accepts source URLs from verified domains (150+):

| Category | Examples |
|----------|----------|
| **Major News** | Reuters, AP, BBC, CNN, Guardian, NYT |
| **Regional** | Japan Times, Korea Herald, Straits Times |
| **Fact-Check** | Snopes, PolitiFact, Full Fact |
| **Science** | Nature, Science, arXiv, PubMed |
| **Government** | .gov, .gov.uk, .mil |
| **International** | WHO, UN, NATO, World Bank |

## Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Environment Variables (Vercel)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | `0xBaAb55EA04643ED010e6f968b7a9dd0C75387c0e` |
| `NEXT_PUBLIC_RPC_ENDPOINT` | `https://studio.genlayer.com/api` |
| `NEXT_PUBLIC_NETWORK` | `studionet` |
| `GENLAYER_RPC_URL` | `https://studio.genlayer.com/api` |
| `GENLAYER_PRIVATE_KEY` | Server account private key |

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [GenLayer](https://genlayer.com) for the Intelligent Contract platform
- The GenLayer community for support and feedback

---

<div align="center">

**Built with love by [rizqhika29](https://github.com/rizqhika29)**

[Back to Top](#-kittynotary)

</div>
