# Kivo — Local-First AI Scope Management for Freelancers

> **"Stop guessing. Start scoping."**

Kivo is a local-first SaaS tool that helps freelancers turn vague client briefs into structured, locked scope baselines, detect scope creep when clients ask for extras, and generate transparent change-order proposals — all powered by a locally-running language model (no cloud API required).

---

## The Problem

Scope creep is the silent revenue killer for freelancers and small agencies. A client brief that starts as "a simple five-page website" quietly grows into a filterable gallery, a blog with admin panel, multilingual support, and a redesigned checkout — often without any corresponding contract amendment or additional billing.

Kivo solves three concrete problems:

1. **Structured scope extraction** — turns a free-text client brief into categorised deliverables, assumptions, exclusions, and clarification questions, each tagged with provenance (`explicit` = client said it; `suggested` = AI inferred it).
2. **Baseline locking** — freezes the agreed scope and its pricing into an immutable record before any work starts.
3. **Scope-creep detection and change orders** — analyses new client messages against the locked baseline, calculates the effort and cost delta, and generates a shareable change-order proposal the client can approve or reject.

---

## Core Workflow

```
1. Create project        →  name, client, hourly rate
2. Paste brief           →  free-text client description
3. Extract scope (AI)    →  Qwen2.5 3B produces deliverables / assumptions /
                            exclusions / clarifications (provenance-tagged)
4. Review & edit         →  adjust hours per item, toggle suggestions
5. Lock baseline         →  immutable snapshot stored in SQLite
6. Detect scope creep    →  paste new client message → AI delta analysis
7. Generate change order →  effort + cost delta, shareable token link
8. Client approves       →  status flips to "approved", ledger updated
9. Dashboard             →  Baseline Contract + Approved Changes = Project Total
```

---

## Architecture

```
┌─────────────────────────────┐
│  React SPA (Vite + TS)      │  localhost:5173
│  Tailwind CSS, Lucide icons │
│  src/components/            │
│    DashboardView.tsx        │
│    ScopeIntakeView.tsx      │
│    ScopeCreepView.tsx       │
│    ProposalReviewView.tsx   │
│    Navbar.tsx               │
└────────────┬────────────────┘
             │ HTTP /api/*
┌────────────▼────────────────┐
│  FastAPI backend            │  localhost:8000
│  app/routes/                │
│    projects.py   (CRUD)     │
│    scope.py      (extract)  │
│    changes.py    (proposals)│
│    health.py                │
│  app/services/              │
│    ollama_client.py         │
│    pricing_engine.py        │
└────────────┬────────────────┘
      ┌──────┴──────┐
      │             │
 SQLite (kivo.db)  Ollama
 aiosqlite         qwen2.5:3b
                   localhost:11434
```

### Data model (SQLite)

| Table | Purpose |
|---|---|
| `projects` | One row per engagement (name, client, hourly rate, currency) |
| `scope_baselines` | Immutable snapshot locked after client approval (hours, price) |
| `scope_items` | Individual deliverables/assumptions/exclusions/questions per baseline |
| `change_requests` | Scope-creep proposals (status, hours, cost, share token) |
| `change_request_items` | Line items within each change order |

---

## Local AI — Ollama + Qwen2.5 3B

All inference runs **locally** via [Ollama](https://ollama.ai). No cloud API, no data sent externally.

The backend calls `ollama_client.py` which:
1. Sends the raw brief to `qwen2.5:3b` with a structured JSON prompt.
2. Parses the response into deliverables, assumptions, exclusions, and clarification questions.
3. Falls back to `_fallback_scope_extraction()` if the model is unavailable or returns malformed JSON — the fallback produces a deterministic, rule-based extraction so the app remains functional offline.

**Pricing** uses Python `Decimal` with `ROUND_HALF_UP` throughout — no floating-point rounding errors.

---

## Prerequisites

| Dependency | Version | Purpose |
|---|---|---|
| Python | ≥ 3.9 | Backend runtime |
| Node.js | ≥ 18 | Frontend build |
| Ollama | latest | Local model host |
| qwen2.5:3b model | — | Scope extraction & analysis |

---

## Installation

### 1. Install Ollama and pull the model

```bash
# Install from https://ollama.ai, then:
ollama pull qwen2.5:3b
```

### 2. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Frontend

```bash
cd frontend
npm install
```

---

## Running Locally

Open **two terminals**:

```bash
# Terminal 1 — Backend (from /backend)
PYTHONPATH=. venv/bin/uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend (from /frontend)
npm run dev
```

Then open **http://localhost:5173** in your browser.

The backend health endpoint at `http://localhost:8000/api/health` returns Ollama connectivity status and model availability.

---

## Tests

```bash
# From /backend (with venv activated)
PYTHONPATH=. pytest tests/ -v
```

**Test suite (23 tests across 4 files):**

| File | What it covers |
|---|---|
| `test_api.py` | Health endpoint, scope extraction validation, project CRUD |
| `test_pricing_engine.py` | Hourly rate × hours, fractional hours, negative guards, totals |
| `test_quality_regression.py` | Provenance integrity, approval/rejection persistence, ledger reconciliation, deduplication & pending reuse, idempotency, fallback parsing |
| `test_workflow.py` | Full end-to-end scope intake; validation error states |

All 23 tests pass (verified: Python 3.9.6 + pytest 8.4.2, runtime ~58s).

---

## Production Build

```bash
# From /frontend
npm run build     # outputs to frontend/dist/
```

Verified clean build: 0 TypeScript errors, 0 Vite warnings, 317 kB JS bundle (88 kB gzipped).

---

## What Is Explicitly Not Included

- Payment processing
- Multi-user / team accounts
- Email delivery of change-order links
- Cloud hosting / deployment pipeline
- CMS or content editing
- Custom domain or SSL setup

---

## Project Structure

```
Kivo/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── routes/
│   │   │   ├── projects.py
│   │   │   ├── scope.py
│   │   │   ├── changes.py
│   │   │   └── health.py
│   │   └── services/
│   │       ├── ollama_client.py
│   │       └── pricing_engine.py
│   ├── tests/
│   │   ├── test_api.py
│   │   ├── test_pricing_engine.py
│   │   ├── test_quality_regression.py
│   │   └── test_workflow.py
│   ├── requirements.txt
│   └── pytest.ini
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DashboardView.tsx
│   │   │   ├── ScopeIntakeView.tsx
│   │   │   ├── ScopeCreepView.tsx
│   │   │   ├── ProposalReviewView.tsx
│   │   │   └── Navbar.tsx
│   │   ├── api/
│   │   │   └── client.ts
│   │   ├── App.tsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.ts
└── README.md
```
