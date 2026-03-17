# Qdrant Vector Search Integration — SafeEats SCC

**Date:** 2026-03-17
**Status:** Approved
**Scope:** Add semantic vector search to SafeEats using embedded Qdrant + sentence-transformers

---

## Overview

Replace the current keyword-only search and violation RAG with semantic vector search powered by Qdrant (embedded mode) and `sentence-transformers/all-MiniLM-L6-v2`. This enables natural-language queries like "restaurants with temperature storage problems near schools" to return semantically relevant results, and improves LLM answer quality by feeding better context to Nemotron.

Everything runs locally on DGX Spark — no external services, no data leaves the device.

---

## Goals

1. **Semantic violation search** — replace substring scan in `build_context()` with Qdrant vector search
2. **Semantic restaurant search** — find restaurants by natural language description, not just name/city
3. **Tract semantic search** — query census tracts by demographic/equity description
4. **New `/api/semantic-search` endpoint** — unified multi-collection semantic search for the UI
5. **UI semantic search tab** — expose new capabilities in the frontend

---

## Non-Goals

- No remote Qdrant Cloud (everything stays local)
- No replacement of existing `/api/search` or `/api/nearby` (those remain as-is)
- No re-training or fine-tuning of the embedding model
- No real-time index updates (index is built at startup or on-demand)

---

## Architecture

### Qdrant in Embedded Mode

Qdrant runs as an in-process library (no Docker, no separate port). Data persists to disk at `data/qdrant_storage/`. The client is a singleton initialized at Flask app startup alongside existing data structures.

```
Flask app startup
  ├── load restaurants.json → RESTAURANTS dict  (existing)
  ├── load violations_text.jsonl → VIOLATION_CHUNKS  (existing)
  ├── load qdrant_storage/ → QDRANT_CLIENT  (new)
  └── if qdrant_storage/ empty → run build_index()  (new)
```

### Embedding Model

`sentence-transformers/all-MiniLM-L6-v2`
- 384-dimensional embeddings
- ~80MB on disk, loads in ~2s
- Runs on CPU or GPU
- Cosine similarity distance

---

## Collections

### `violations`

**Source:** `data/violations_text.jsonl`
**Records:** ~7,000+ chunks
**Text to embed:** Full violation chunk text (already formatted for RAG)
**Payload fields:**
```json
{
  "biz_id": "string",
  "biz_name": "string",
  "date": "string",
  "score": "float",
  "city": "string",
  "chunk_text": "string"
}
```

### `restaurants`

**Source:** `data/restaurants.json`
**Records:** ~7,100
**Text to embed:** `"{name} in {city} — {inspection_tier} tier — violations: {top_violation_types}"`
**Payload fields:**
```json
{
  "biz_id": "string",
  "name": "string",
  "city": "string",
  "lat": "float",
  "lon": "float",
  "score": "float",
  "tier": "string",
  "critical_violations": "int"
}
```

### `tracts`

**Source:** `data/food_access_tracts.csv` joined with `data/food_equity_scores.csv`
**Records:** ~408
**Text to embed:** `"Census tract {geoid} in {city_area}: poverty rate {poverty_pct}%, median income ${income}, {food_desert_label}, equity tier {equity_tier}, {food_biz_count} food businesses, {grocery_count} grocery stores"`
**Payload fields:**
```json
{
  "geoid": "string",
  "poverty_pct": "float",
  "income": "float",
  "food_desert": "bool",
  "equity_tier": "string",
  "equity_score": "float",
  "food_biz_count": "int",
  "lat": "float",
  "lon": "float"
}
```

### `food_businesses`

**Source:** `data/food_trucks_parsed.json` + `data/cottage_food_parsed.json`
**Records:** ~200-500
**Text to embed:** `"{name} — {business_type} in {city}"`
**Payload fields:**
```json
{
  "id": "string",
  "name": "string",
  "type": "string",
  "city": "string",
  "lat": "float",
  "lon": "float"
}
```

---

## New File: `qdrant_index.py`

Standalone script + importable module.

**Functions:**

```python
def get_client() -> QdrantClient
    # Returns singleton embedded Qdrant client
    # Path: data/qdrant_storage/

def get_encoder() -> SentenceTransformer
    # Returns singleton sentence-transformers model
    # Model: all-MiniLM-L6-v2

def build_index(force_rebuild: bool = False) -> None
    # Builds all 4 collections
    # Skips if collections already exist (unless force_rebuild=True)
    # Called at app startup if collections missing

def search(query: str, collections: list[str], top_k: int = 10) -> list[dict]
    # Encodes query, searches specified collections
    # Merges and deduplicates results
    # Returns list of hits with score + payload
```

**CLI usage:**
```bash
python qdrant_index.py           # Build index (skip if exists)
python qdrant_index.py --rebuild # Force rebuild all collections
```

---

## Modified: `app.py`

### Startup changes

```python
# After existing data loading:
from qdrant_index import get_client, get_encoder, build_index
QDRANT_CLIENT = get_client()
ENCODER = get_encoder()
build_index()  # no-op if already built
```

### `build_context(query)` — upgrade RAG

Replace current loop over `VIOLATION_CHUNKS` with keyword scan:

```python
# BEFORE: keyword substring matching (O(n))
# AFTER: Qdrant semantic search (O(log n))
from qdrant_index import search
hits = search(query, collections=["violations"], top_k=8)
context = "\n".join(h["payload"]["chunk_text"] for h in hits)
```

### New endpoint: `POST /api/semantic-search`

**Request:**
```json
{
  "query": "restaurants with pest control violations near schools",
  "collections": ["violations", "restaurants", "tracts", "food_businesses"],
  "top_k": 10
}
```

**Response:**
```json
{
  "results": [
    {
      "collection": "restaurants",
      "score": 0.87,
      "payload": { "biz_id": "...", "name": "...", "city": "...", ... }
    },
    ...
  ],
  "query": "...",
  "total": 10
}
```

---

## Modified: `templates/index.html`

Add a **"Semantic Search"** tab in the search panel (alongside existing name/city/score filters):

- Text input: "Ask anything about food safety..."
- Collection checkboxes: violations / restaurants / tracts / food businesses
- Results panel: ranked list with score badge, collection tag, and key payload fields
- Clicking a restaurant result opens the existing restaurant detail view

---

## Data Flow

```
[User types query in Semantic Search tab]
         ↓
POST /api/semantic-search
         ↓
encode query → 384-dim vector
         ↓
search Qdrant collections (cosine similarity)
         ↓
merge results, sort by score, return top_k
         ↓
UI renders ranked results

[User types in Q&A chat]
         ↓
POST /api/ask
         ↓
build_context(query) → Qdrant violations search (top 8)
         ↓
context + question → Nemotron LLM
         ↓
answer rendered in chat
```

---

## Indexing Performance

Expected at DGX Spark GB10 Blackwell speeds:

| Collection | Records | Est. encode time | Est. upsert time |
|---|---|---|---|
| violations | ~7,000 | ~5s (GPU) | ~2s |
| restaurants | ~7,100 | ~5s (GPU) | ~2s |
| tracts | ~408 | <1s | <1s |
| food_businesses | ~500 | <1s | <1s |
| **Total** | **~15,000** | **~12s** | **~6s** |

Index is built once and persisted. Subsequent startups load from disk in ~1s.

---

## Error Handling

- If Qdrant init fails at startup: log warning, fall back to existing keyword search (no crash)
- If embedding model fails to load: same fallback
- `/api/semantic-search` returns 503 with `{"error": "vector search unavailable"}` if Qdrant not ready
- `build_index()` is idempotent — safe to call multiple times

---

## Dependencies

New packages to add to requirements (or install):
```
qdrant-client[fastembed]  # embedded mode + fast upsert
sentence-transformers      # all-MiniLM-L6-v2
```

---

## File Summary

| File | Change |
|---|---|
| `qdrant_index.py` | **New** — indexing script + search helpers |
| `app.py` | **Modified** — startup init, `build_context()` upgrade, new endpoint |
| `templates/index.html` | **Modified** — semantic search tab + results UI |
| `data/qdrant_storage/` | **New** — persisted Qdrant collections (auto-created) |
| `requirements.txt` | **Modified** — add qdrant-client, sentence-transformers |
