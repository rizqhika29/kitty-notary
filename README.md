<div align="center">

# 🐱 KittyNotary

### AI-Powered On-Chain Fact Verification

**Verify claims. Store truth. Trust the consensus.**

[![License: MIT](https://img.shields.io/badge/License-MIT-pink.svg)](LICENSE)
[![GenLayer](https://img.shields.io/badge/Built%20on-GenLayer-blue.svg)](https://genlayer.com)
[![Tests](https://img.shields.io/badge/Tests-48%2F48-brightgreen.svg)](#testing)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js-black.svg)](https://nextjs.org)

[Live Demo](https://kitty-notary.vercel.app) · [Contract](https://studio.genlayer.com) · [Report Bug](https://github.com/rizqhika29/kitty-notary/issues)

</div>

---

## ✨ What is KittyNotary?

KittyNotary is a **GenLayer Intelligent Contract** that verifies whether online events actually happened. Submit a claim + source URL, and decentralized AI validators will reach consensus on its truthfulness — permanently stored on-chain.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Submit    │ ──▶ │  AI Leader  │ ──▶ │  Validators │ ──▶ │  On-Chain   │
│   Claim     │     │  Evaluation │     │  Consensus  │     │  Result     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
     You               LLM reads           Multiple AI          Permanent
                       your source         agree on truth       record
```

## 🎯 How It Works

| Step | What Happens |
|------|--------------|
| **1. Submit** | User provides a claim + source URL via MetaMask |
| **2. Fetch** | Contract fetches content from the source URL |
| **3. Evaluate** | AI leader analyzes the claim against the source |
| **4. Validate** | Multiple validators independently re-evaluate |
| **5. Consensus** | Verdict + confidence must match across validators |
| **6. Store** | Result permanently stored with immutable `record_id` |

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Smart Contract** | Python (GenLayer SDK) |
| **Frontend** | Next.js 15, TypeScript, Tailwind CSS |
| **Wallet** | MetaMask, Viem |
| **Network** | GenLayer Studionet |
| **Testing** | pytest, 48 test cases |

## 🚀 Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- MetaMask wallet
- GenLayer Studionet ETH (for deployment)

### 1️⃣ Clone & Install

```bash
git clone https://github.com/rizqhika29/kitty-notary.git
cd kitty-notary

# Frontend dependencies (runs in root)
npm install

# Python dependencies (for local dev / server)
cd server
pip install -r requirements.txt
pip install -r api_server/requirements.txt
cd ..
```

### 2️⃣ Configure Environment

```bash
# Root .env (frontend)
cp .env.example .env
# Edit .env with your NEXT_PUBLIC_CONTRACT_ADDRESS

# Server .env
cp server/.env.example server/.env  # if exists
# Edit server/.env with GENLAYER_PRIVATE_KEY
```

### 3️⃣ Run Tests

```bash
cd server
pytest tests/direct/ -v
cd ..
```

### 4️⃣ Deploy Contract

```bash
cd server
python -m deploy.run deploy
cd ..
```

### 5️⃣ Start Frontend

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) 🎉

## 📁 Project Structure

```
kitty-notary/
├── 🌐 app/                    # Next.js App Router
│   ├── api/rpc/               # API routes (proxy to server)
│   ├── submit/                # Claim submission page
│   ├── explorer/              # Browse all records
│   ├── records/               # My records page
│   └── dashboard/             # Analytics dashboard
├── 🧩 components/             # React components
│   ├── ClaimForm.tsx          # Submission form with wallet
│   ├── RecordsTable.tsx       # Records browser with filters
│   └── RecordDetailModal.tsx  # Detail view popup
├── 📚 lib/                    # Contract integration & utilities
├── 🪝 hooks/                  # Custom React hooks
├── 📋 types/                  # TypeScript types
├── 🖥️ server/                 # Backend (Python)
│   ├── contracts/             # GenLayer Intelligent Contract
│   ├── api_server/            # Flask API for Render
│   ├── deploy/                # Deployment CLI & helper
│   └── tests/                 # Test suites (48 cases)
├── 📄 vercel.json             # Vercel config
├── 📋 package.json            # Node.js dependencies
└── 📝 README.md
```

## 🔧 Contract API

### Write Methods

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `notarize` | `claim: str`, `source_url: str` | `u256` (index) | Submit a claim for verification |

### View Methods

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `get_count` | — | `u256` | Total number of records |
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

## 🎨 Features

### 👛 Per-User Wallet Integration
Every submission is signed by the user's own MetaMask wallet. The `requester` field on-chain = user's wallet address.

### 🔍 Explorer & My Records
Browse all notarizations or filter by your own wallet. Click **Detail** to see full AI reasoning.

### 📊 Dashboard
Real-time stats: total records, verification rate, recent submissions.

### ⚡ Batch Loading
Records are fetched in parallel batches for fast page loads (~8s cold start).

### 🛡️ Security Features
- Domain allowlist (150+ verified sources)
- Input validation (claim ≤500 chars, URL ≤2048 chars)
- Transaction receipt checking (immediate error detection)
- Client-side payload verification

### 🎯 Record Detail Modal
Click any record to see:
- Full claim text
- Source URL (clickable)
- Verdict badge with confidence bar
- Complete AI reasoning
- On-chain metadata

## 🧪 Testing

```bash
# Run all tests
cd server
pytest tests/direct/ -v

# Run specific test suite
pytest tests/direct/test_ai_notary.py -v

# Run security tests
pytest tests/direct/test_ai_notary_security.py -v
```

**Test Coverage:**
- ✅ Notarization flow
- ✅ Record storage & lookup
- ✅ Deduplication
- ✅ Requester queries
- ✅ Consensus acceptance/rejection
- ✅ Input validation
- ✅ Confidence formats
- ✅ Edge cases

## 🌐 Allowed Domains

The contract only accepts source URLs from verified domains:

| Category | Examples |
|----------|----------|
| **Major News** | Reuters, AP, BBC, CNN, Guardian, NYT |
| **Regional** | Japan Times, Korea Herald, Straits Times |
| **Fact-Check** | Snopes, PolitiFact, Full Fact |
| **Science** | Nature, Science, arXiv, PubMed |
| **Government** | .gov, .gov.uk, .mil |
| **International** | WHO, UN, NATO, World Bank |

View full list → [`contracts/ai_notary.py`](contracts/ai_notary.py)

## 🚀 Deploy to Vercel + Render

### Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  Vercel         │     │  Render         │
│  (Frontend)     │ ──▶ │  (API Server)   │
│  Next.js        │     │  Python + Flask  │
└─────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌─────────────────┐
                        │  GenLayer       │
                        │  Studionet      │
                        └─────────────────┘
```

### Step 1: Deploy API Server to Render

1. Fork this repository
2. Go to [render.com](https://render.com) and create a new **Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Root Directory**: `server/api_server`
   - **Build Command**: `pip install -r requirements.txt && pip install -r ../requirements.txt`
   - **Start Command**: `python app.py`
5. Add environment variables:
   ```
   GENLAYER_PRIVATE_KEY=your_private_key
   GENLAYER_RPC_URL=https://studio.genlayer.com/api
   NEXT_PUBLIC_CONTRACT_ADDRESS=your_contract_address
   NEXT_PUBLIC_GENLAYER_NETWORK=studionet
   ```
6. Deploy and note your API URL (e.g., `https://kittynotary-api.onrender.com`)

### Step 2: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and import your GitHub repository
2. Vercel will auto-detect Next.js (no Root Directory configuration needed!)
3. Add environment variables:
   ```
   NEXT_PUBLIC_CONTRACT_ADDRESS=your_contract_address
   NEXT_PUBLIC_RPC_ENDPOINT=https://studio.genlayer.com/api
   NEXT_PUBLIC_NETWORK=studionet
   API_URL=https://kittynotary-api.onrender.com
   ```
4. Deploy

### Step 3: Verify

1. Visit your Vercel URL
2. Connect MetaMask
3. Submit a test claim
4. Check the API server logs on Render for any issues

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | Deployed contract address | ✅ |
| `NEXT_PUBLIC_RPC_ENDPOINT` | GenLayer RPC URL | ✅ |
| `NEXT_PUBLIC_NETWORK` | Network name (`studionet`) | ✅ |
| `API_URL` | Render API server URL | ✅ (Vercel only) |
| `GENLAYER_PRIVATE_KEY` | Server wallet private key | ✅ (API only) |
| `GENLAYER_RPC_URL` | GenLayer RPC URL | ✅ (API only) |

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [GenLayer](https://genlayer.com) for the Intelligent Contract platform
- The GenLayer community for support and feedback

---

<div align="center">

**Built with ❤️ by [rizqhika29](https://github.com/rizqhika29)**

[⬆ Back to Top](#-kittynotary)

</div>
