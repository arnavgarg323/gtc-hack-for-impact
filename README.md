# FoodSight SCC — AI-Powered Food Safety & Equity Platform
https://drive.google.com/file/d/1oFw1ZHG3nl2U1HFthmUchaRFeF4_uOS5/view?usp=sharing

> **GTC Hack for Impact** · Santa Clara County · NVIDIA DGX Spark GB10 Blackwell

FoodSight SCC is a full-stack AI platform that combines local LLM inference, GPU-accelerated ML, and interactive mapping to make food safety and food equity data actionable for Santa Clara County. Built on a DGX Spark supercomputer, it processes 8,588 restaurants, ~3.8 million inspection violations, and 408 census tracts entirely on-device — no data ever leaves the machine.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Backend](#backend)
  - [Flask API Routes](#flask-api-routes)
  - [vLLM & Nemotron Nano](#vllm--nemotron-nano)
  - [CLIP Vision Model](#clip-vision-model)
  - [GPU Analysis (cuML)](#gpu-analysis-cuml)
  - [Route Optimization (cuOpt)](#route-optimization-cuopt)
  - [ML Risk Prediction](#ml-risk-prediction)
  - [Food Equity Scoring](#food-equity-scoring)
  - [Processing Scripts](#processing-scripts)
  - [Processed Data Files](#processed-data-files)
- [Frontend (TypeScript)](#frontend-typescript)
  - [Tab Components](#tab-components)
  - [Map & Components](#map--components)
- [foodsight-next (JavaScript)](#foodsight-next-javascript)
- [Raw Data](#raw-data)
- [OpenClaw Security Policy](#openclaw-security-policy)
- [DGX Spark Setup (SKILL.md)](#dgx-spark-setup-skillmd)
- [Running Locally](#running-locally)
- [Environment Variables](#environment-variables)
- [Hardware Requirements](#hardware-requirements)

---

## Overview

FoodSight SCC answers questions like:

- *Which restaurants in Sunnyvale have the most critical violations?*
- *Which census tracts are food deserts and who lives there?*
- *What's the optimal inspection route for 3 inspectors in San Jose today?*
- *If we added 5 grocery stores to tract 5031, how much would equity improve?*
- *Does this photo of a kitchen suggest any food safety violations?*

It does all of this with **local inference only** — the LLM, vision model, and GPU analytics all run on the DGX Spark, keeping sensitive county data completely private.

### Key Capabilities

| Capability | Technology | Detail |
|---|---|---|
| RAG Q&A | Nemotron-Nano-30B via vLLM | Searches 3.8M violation records, answers in plain English |
| Food equity scoring | Custom algorithm | Per-tract grocery/density/penalty formula across 408 tracts |
| Policy simulation | Nemotron-Nano | What-if: add N stores → recalculate equity → LLM policy brief |
| Route optimization | NVIDIA cuOpt | GPU-based VRP solver for inspection scheduling |
| Risk prediction | Gradient Boosting + Random Forest | 0-100 food desert risk score per census tract |
| GPU clustering | RAPIDS cuML | KMeans (k=6), UMAP, NearestNeighbors on DGX Spark |
| Vision analysis | CLIP (openai/clip-vit-base-patch32) | Photo → 11 food safety violation category scores |
| Live data | OpenFDA API | California food product recalls, 1-hour cache |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DGX Spark GB10                           │
│                                                                 │
│  ┌──────────────────────────────────────┐                       │
│  │   Next.js Frontend (port 3000)       │                       │
│  │   TypeScript · React 19 · Leaflet    │                       │
│  └──────────────┬───────────────────────┘                       │
│                 │ /api/* → localhost:5000                       │
│  ┌──────────────▼───────────────────────┐                       │
│  │   Flask Backend (port 5000)          │                       │
│  │   50+ REST endpoints · RAG · CLIP    │                       │
│  └────┬──────────┬────────────┬─────────┘                       │
│       │          │            │                                 │
│  ┌────▼───┐ ┌────▼────┐ ┌────▼───────┐                         │
│  │ vLLM   │ │ cuOpt   │ │ cuML/RAPIDS│                         │
│  │ :8000  │ │ :5007   │ │ (in-process│                         │
│  │Nemotron│ │ VRP     │ │  KMeans    │                         │
│  │ Nano   │ │ Solver  │ │  UMAP etc) │                         │
│  └────────┘ └─────────┘ └────────────┘                         │
│                                                                 │
│  /models/llm/nvidia--NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4      │
│  /models/cv/openai--clip-vit-base-patch32                       │
└─────────────────────────────────────────────────────────────────┘
```

The Flask backend is the single source of truth. Both the TypeScript and JavaScript Next.js frontends proxy all API calls to it. vLLM and cuOpt run as separate Docker containers; cuML runs in-process inside Flask.

---

## Repository Structure

```
gtc-hack-for-impact/
├── README.md
├── SKILL.md                          # DGX Spark hardware & container setup guide
├── .gitignore
│
├── backend/                          # Flask Python backend
│   ├── app.py                        # Main application (2,117 lines, 50+ routes)
│   ├── food_equity.py                # Food equity scoring algorithm
│   ├── gpu_analysis.py               # RAPIDS cuML GPU analysis
│   ├── train_ml_model.py             # Food desert ML risk model training
│   ├── run_analysis.py               # GPU/CPU analysis orchestrator
│   ├── process_data.py               # Raw CSV → restaurants.json + violations JSONL
│   ├── build_food_access.py          # Food desert classification pipeline
│   ├── process_crime.py              # Crime report geocoding
│   ├── process_extra_data.py         # Trends, violations, workforce processing
│   ├── run_gpu_when_ready.sh         # Pause vLLM, run cuML, resume vLLM
│   ├── static/                       # Static assets
│   ├── templates/
│   │   └── index.html                # Fallback HTML template (131KB, dark-mode UI)
│   ├── openclaw/
│   │   ├── foodsight-policy.yaml      # Sandbox network + filesystem policy (v7)
│   │   └── skills/foodsight-scc/      # App-specific OpenClaw skills
│   ├── docs/
│   │   └── superpowers/
│   │       ├── plans/                # Implementation plans
│   │       └── specs/                # Feature design specs
│   └── data/                         # Processed output data (~400MB)
│       ├── restaurants.json          # 8,588 restaurants with scores
│       ├── violations_text.jsonl     # 3.8M violation chunks for RAG
│       ├── food_equity_tracts.geojson
│       ├── food_access_tracts.geojson
│       ├── ml_risk_scores.json
│       ├── gpu_clusters.json
│       └── ... (40+ files, see Processed Data Files)
│
├── frontend/                         # TypeScript Next.js (primary UI)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # Main layout: tab panel + Leaflet map
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── MapView.tsx           # Leaflet map with equity/health layers
│   │   │   ├── Header.tsx            # Logo, GPU badge, stats bar
│   │   │   ├── TabNav.tsx            # Tab switcher
│   │   │   └── tabs/                 # 19 data exploration tabs
│   │   ├── hooks/
│   │   │   └── useStats.ts           # Fetch green/yellow/red counts
│   │   └── types/index.ts            # TypeScript interfaces
│   ├── next.config.ts                # Rewrites /api/* → localhost:5000
│   ├── package.json                  # React 19, Next 16, Leaflet 1.9
│   └── tsconfig.json
│
├── foodsight-next/                   # JavaScript Next.js (alternate UI)
│   ├── app/
│   │   ├── page.js
│   │   ├── layout.js
│   │   └── api/proxy/[...path]/      # API proxy handler
│   ├── components/                   # React components (JS versions)
│   ├── next.config.mjs               # Rewrites /flask/* → localhost:5000
│   └── package.json                  # React 18, Next 14, Tailwind 3
│
└── data/                             # Raw input CSVs (~230MB)
    ├── SCC_DEH_Food_Data_BUSINESS_*.csv
    ├── SCC_DEH_Food_Data_INSPECTIONS_*.csv
    ├── SCC_DEH_Food_Data_VIOLATIONS_*.csv
    ├── Santa_Clara_County_ACS_2024_*_demographics.csv
    ├── Crime_Reports_*.csv
    ├── calenviroscreen4_ca.csv
    ├── ca_healthcare_facilities.csv
    ├── ca_wic_vendors.csv
    ├── tl_2024_06_*.zip              # TIGER/Line 2024 census tract shapefiles
    └── build_food_access_datasets.py # Data pipeline script
```

---

## Backend

The backend is a single Flask application (`backend/app.py`, 2,117 lines) that handles all data serving, LLM inference, GPU analysis, and processing.

### Flask API Routes

#### Core Restaurant Data

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/restaurants` | All 8,588 restaurants as JSON array for map rendering (id, name, address, city, lat, lon, latest_score, avg_score, critical_count, tier) |
| GET | `/api/restaurant/<id>` | Single restaurant detail with 5 most recent inspections, violation list, and score history |
| GET | `/api/search` | Filter restaurants by `q` (name), `city`, `tier` (green/yellow/red), `min_score`, `max_score` |
| GET | `/api/nearby` | Restaurants within `radius` meters of `lat`/`lon` |
| GET | `/api/stats` | Summary counts: total, green, yellow, red, unscored |
| GET | `/api/by-city` | Average safety score, tier counts, and restaurant count per city |
| GET | `/api/worst-violators` | Top 15 restaurants ranked by total critical violation count |
| GET | `/api/trends` | Monthly avg inspection score + inspection count (time series) |
| GET | `/api/violation-types` | Top 20 violation descriptions with occurrence count and critical% |
| GET | `/api/report/<id>` | Plain-text food safety report for a restaurant (download) |
| GET | `/api/compare` | Side-by-side stats for two restaurants by id |
| GET | `/api/zip-summary/<zip>` | Aggregated food safety stats for a single ZIP code |

#### Food Equity & Access

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/food-equity-geojson` | GeoJSON FeatureCollection of 408 census tracts enriched with equity_score (0-100), equity_tier, business type breakdown (grocery%, fast_food%, liquor%, etc.), population |
| GET | `/api/food-equity-summary` | County-wide equity summary: tier distribution, population counts per tier, tract statistics |
| GET | `/api/food-deserts` | List of food desert tracts with severity (severe/moderate/low), population, poverty rate |
| GET | `/api/food-access-geojson` | GeoJSON tracts with USDA-style food access classification plus ML risk scores overlaid |
| GET | `/api/equity-analysis` | Correlation analysis: income quintiles vs food access, demographics vs equity tier |
| POST | `/api/simulate` | Policy what-if: send `{tract_id, new_groceries, new_restaurants}` → recalculated equity score + vLLM-generated 3-paragraph policy brief |
| GET | `/api/fresh-food-points` | Grocery stores, farmers markets, supermarkets as point layer |
| GET | `/api/food-category-summary` | Fresh vs limited-fresh vs restaurant count by city |
| GET | `/api/access-vulnerability` | Tracts ranked by composite access vulnerability (poverty + no vehicle + age 65+ + zero biz) |
| GET | `/api/access-vulnerability-geojson` | Same as above as GeoJSON choropleth |
| GET | `/api/priority-tracts` | Top 10 highest-priority underserved areas |

#### Health & Environment

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/health-outcomes` | CDC PLACES 2023 health metrics by tract: food insecurity%, diabetes%, obesity%, hypertension%, physical inactivity% |
| GET | `/api/health-outcomes/<geoid>` | Single tract health metrics |
| GET | `/api/health-metrics` | Available CDC PLACES measures with descriptions and units |
| GET | `/api/calenviroscreen` | CalEnviroScreen 4.0 pollution burden + population vulnerability scores by tract |
| GET | `/api/cdc-tract/<measure_id>` | Single health measure values for all tracts |
| GET | `/api/cdc-tract-geojson/<measure_id>` | GeoJSON choropleth for a specific CDC health measure |
| GET | `/api/health-food-combined` | Combined health outcomes + food access per tract |
| GET | `/api/small-area-health` | Health profiles by ZIP code or neighborhood |

#### Community Resources

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/food-trucks` | Mobile food vendors licensed by SCC DEH |
| GET | `/api/cottage-food` | Home-based cottage food businesses |
| GET | `/api/wic-vendors` | WIC program authorized vendors |
| GET | `/api/healthcare` | Healthcare facilities (hospitals, clinics) from CA CDPH |
| GET | `/api/senior-dining` | Senior nutrition program dining sites |
| GET | `/api/schools` | Public schools (SCC GIS, all grade levels) |
| GET | `/api/food-recalls` | Live OpenFDA food recall data for California (1-hour cache) |
| GET | `/api/infrastructure` | OpenStreetMap: supermarkets, food banks, pharmacies, clinics |

#### GPU & ML Analysis

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/gpu-clusters` | 6 KMeans cluster profiles: n_tracts, avg poverty rate, avg businesses per 1k, desert rate, cluster label |
| GET | `/api/gpu-tsne` | 2D UMAP embedding coordinates for all census tracts (for scatter visualization) |
| GET | `/api/gpu-nearest-food` | Desert tracts sorted by distance to nearest food business |
| GET | `/api/gpu-benchmark` | CPU vs GPU runtime comparison for cuML operations |
| GET | `/api/ml-risk` | Per-tract food desert risk score (0-100), risk tier, desert probability, feature values |
| GET | `/api/ml-risk-stats` | Model performance metrics: ROC-AUC, F1, feature importances, top at-risk tracts |
| POST | `/api/optimize-route` | Body: `{city, n_inspectors, priority}` → optimized inspection routes with stops, distances, and estimated times |

#### AI & Vision

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/ask` | Body: `{question}` → RAG answer (violation chunk retrieval + Nemotron-Nano inference) with source highlights |
| POST | `/api/vision-check` | Multipart image upload → CLIP similarity scores for 11 food safety violation categories |
| GET | `/api/clip-status` | Whether the CLIP model has finished loading (loads asynchronously on startup) |

#### Metadata & Utility

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/crime-points` | Crime heatmap points (sampled to 5,000 for frontend performance) with severity weights |
| GET | `/api/crime-analysis` | Top 15 incident types with counts |
| GET | `/api/employee-demographics` | SCC DEH workforce diversity: gender, ethnicity, age band, department |
| GET | `/api/photographers` | County photographers' cultural archive metadata |
| GET | `/api/data-sources` | Dataset provenance: source names, dates, row counts, update frequency |

---

### vLLM & Nemotron Nano

The app connects to a locally-running vLLM server using the OpenAI-compatible SDK:

```python
VLLM_BASE_URL = os.environ.get("VLLM_BASE_URL", "http://localhost:8000/v1")
VLLM_MODEL    = os.environ.get("VLLM_MODEL", "/models/llm/nvidia--NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4")
client = OpenAI(api_key="dummy", base_url=VLLM_BASE_URL)
```

vLLM runs in Docker with reduced-memory settings:

```bash
docker run -d --name nemotron-nano --gpus all --ipc host \
  -p 8000:8000 -v /home/nvidia/models/llm:/models/llm \
  nvcr.io/nvidia/vllm:26.02-py3 \
  vllm serve /models/llm/nvidia--NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4 \
    --trust-remote-code \
    --max-model-len 8192 \
    --gpu-memory-utilization 0.80
```

**RAG pipeline for `/api/ask`:**

1. User question arrives as plain text
2. `search_violations()` performs keyword search over the 3.8M violation chunks loaded into memory at startup
3. Top 6 matching chunks (restaurant name, address, date, score, violation text) are formatted as context
4. System prompt instructs Nemotron to answer only from the provided context
5. Answer returned with source chunk highlights for transparency

**Policy simulation for `/api/simulate`:**

1. Backend recalculates food equity score for the modified tract (adjusting grocery ratio + business density)
2. New equity tier determined
3. vLLM generates a 3-paragraph policy brief: current situation, projected impact, recommended actions

---

### CLIP Vision Model

A CLIP model (`openai/clip-vit-base-patch32`) loads asynchronously in a background thread at startup from `/models/cv/openai--clip-vit-base-patch32`.

**Pre-computed text embeddings for 11 food safety categories:**

| Category | Example prompt |
|---|---|
| Temperature control | "improper food temperature storage" |
| Pest infestation | "rodent or insect pest infestation" |
| Handwashing | "improper handwashing hygiene" |
| Cross contamination | "cross contamination raw cooked food" |
| Sanitation | "dirty surfaces equipment sanitation" |
| Food storage | "improper food storage containers" |
| Employee hygiene | "employee personal hygiene violations" |
| Pest evidence | "pest droppings evidence" |
| Equipment condition | "damaged or unclean equipment" |
| Plumbing | "plumbing issues drain backup" |
| Lighting ventilation | "inadequate lighting ventilation" |

When an image is uploaded to `/api/vision-check`, CLIP encodes it and returns cosine similarity scores against all 11 text embeddings. Scores above 0.25 are flagged as potential concerns.

---

### GPU Analysis (cuML)

`gpu_analysis.py` and `run_analysis.py` use NVIDIA RAPIDS (cuML, cuDF) for GPU-accelerated ML on the DGX Spark. Falls back to scikit-learn on non-GPU machines.

**Operations:**

| Analysis | Library | Description |
|---|---|---|
| KMeans clustering (k=6) | `cuml.cluster.KMeans` | Groups 408 census tracts into 6 food access pattern profiles |
| UMAP 2D embedding | `cuml.manifold.UMAP` | Dimensionality reduction for tract scatter visualization |
| Nearest Neighbors | `cuml.neighbors.NearestNeighbors` | Finds the closest food business for each food desert tract |
| Anomaly detection | `cuml.ensemble.IsolationForest` | Identifies statistical outlier tracts |

**Input features per tract:** `businesses_per_1000`, `grocery_ratio`, `poverty_rate`, `median_income`, `pop_no_vehicle_pct`, `pop_age65_pct`

**Output files:** `gpu_clusters.json`, `gpu_umap_coords.json`, `gpu_nearest_food.json`, `gpu_rf_results.json`

To regenerate GPU analysis (pauses vLLM to free memory):
```bash
./backend/run_gpu_when_ready.sh
```

---

### Route Optimization (cuOpt)

`/api/optimize-route` calls NVIDIA cuOpt running in Docker (`localhost:5007`) for GPU-accelerated vehicle routing (VRP).

**How it works:**

1. Fetches restaurants for the requested city filtered by priority (`red`, `critical`, or `all`)
2. Builds an N×N cost matrix using haversine travel-time estimates (minutes)
3. Submits VRP problem to cuOpt: N locations, K inspectors, capacity constraints
4. Returns per-inspector routes with ordered stops, total miles, and estimated inspection times

**Fallback:** If cuOpt is unavailable, a greedy nearest-neighbor TSP is used instead. The response includes a flag indicating which solver was used.

cuOpt Docker container:
```bash
docker run -d --name cuopt --gpus all \
  -p 5007:5000 \
  nvcr.io/nvidia/cuopt/cuopt:26.2.0-cuda13.0-py3.13
```

---

### ML Risk Prediction

`train_ml_model.py` trains two models on census + food access data:

| Model | Type | Target | Output |
|---|---|---|---|
| Food desert classifier | `GradientBoostingClassifier` | Binary (desert / not desert) | Desert probability [0,1] |
| Risk level classifier | `RandomForestClassifier` | 4-class (critical/high/moderate/low) | Risk tier |

**Features used:**
- `businesses_per_1000_people`
- `grocery_ratio` (grocery stores / total food businesses)
- `poverty_rate` (ACS 5-year estimate)
- `median_household_income`
- `pct_no_vehicle`
- `pct_age_65_plus`
- `population_density`

**Training:**
- 5-fold StratifiedKFold cross-validation
- Outputs: ROC-AUC, F1 macro, per-class precision/recall
- Feature importances saved to `ml_model_stats.json`

**Risk score formula:**
```
risk_score = (desert_probability × 0.7 + risk_class_weight × 0.3) × 100
```

Scores range 0–100 with tiers: `critical` (80+), `high` (60–79), `moderate` (40–59), `low` (20–39), `minimal` (<20).

---

### Food Equity Scoring

`food_equity.py` computes a Food Equity Score (0–100) for each census tract.

**Business Classification:**

Businesses are classified by keyword matching on the business name:

| Category | Examples |
|---|---|
| `grocery` | Safeway, Whole Foods, supermarket, mercado, 99 Ranch |
| `fast_food` | McDonald's, Taco Bell, Subway, Panda Express |
| `convenience` | 7-Eleven, liquor store, gas station food |
| `institutional` | Hospital cafeteria, school lunch, correctional |
| `restaurant` | Everything else (default) |

**Equity Score Formula:**
```
equity_score = (
    (grocery_ratio / target_grocery_ratio) × 50    # grocery mix bonus
  + min(biz_per_1000 / target_density, 1.0) × 30   # density bonus
  - fast_food_penalty × 10                          # fast food deduction
  - liquor_penalty × 10                             # liquor store deduction
) clamped to [0, 100]
```

**Equity Tiers:**

| Tier | Score | Interpretation |
|---|---|---|
| `high_equity` | 70–100 | Good food access, healthy business mix |
| `moderate_equity` | 40–69 | Acceptable access, some gaps |
| `low_equity` | 20–39 | Significant access barriers |
| `critical_equity_gap` | 0–19 | Severe food equity crisis |

---

### Processing Scripts

These scripts are run once to transform raw CSVs into the processed JSON/CSV files used by the backend.

#### `process_data.py`
Joins the three SCC DEH raw files (BUSINESS, INSPECTIONS, VIOLATIONS):
- Computes per-restaurant: latest score, average score, critical violation count, inspection frequency
- Generates `backend/data/restaurants.json` (8,588 entries)
- Generates `backend/data/violations_text.jsonl` (one chunk per inspection with violation text, used for RAG)

#### `build_food_access.py`
Food desert classification pipeline:
- Loads food businesses, census TIGER/Line tract boundaries, ACS demographics
- Applies USDA-inspired desert criteria: tract is a food desert if `(poverty_rate ≥ 20% OR income ≤ 80% county median) AND (businesses_per_1000 < 3)`
- Adds severity flags: `no_vehicle` (≥10% households), `elderly` (≥15% age 65+), `zero_businesses`
- Outputs `backend/data/food_access_tracts.geojson`

#### `train_ml_model.py`
Trains the food desert risk model (see [ML Risk Prediction](#ml-risk-prediction)).

#### `gpu_analysis.py` / `run_analysis.py`
GPU-accelerated analysis using RAPIDS cuML (see [GPU Analysis](#gpu-analysis-cuml)).

#### `process_crime.py`
- Geocodes crime reports using city centroid + random jitter (±0.01°)
- Assigns severity weights: `homicide=4`, `robbery/assault=3`, `theft/burglary=1`
- Outputs `backend/data/crime_points.json` (~50k points)

#### `process_extra_data.py`
- Builds `trends.json` (monthly avg inspection scores with inspection counts)
- Builds `violation_types.json` (top 20 violation descriptions with critical%)
- Processes employee workforce demographics from EEO categories

---

### Processed Data Files

All files live in `backend/data/` and are loaded at Flask startup.

| File | Size | Contents |
|------|------|----------|
| `restaurants.json` | ~8MB | 8,588 restaurants: id, name, address, city, lat, lon, latest_score, avg_score, critical_count, tier (green/yellow/red) |
| `violations_text.jsonl` | ~180MB | One JSON line per inspection chunk: business_id, name, address, date, score, violation descriptions — used for RAG keyword search |
| `name_index.json` | ~500KB | Map of normalized name → list of business_ids for O(1) lookup |
| `food_equity_tracts.geojson` | ~12MB | 408 census tract polygons with equity_score, equity_tier, grocery%, fast_food%, convenience%, restaurant%, liquor%, institutional%, business density, population |
| `food_equity_scores.csv` | ~80KB | Tabular version of equity scores |
| `food_access_tracts.geojson` | ~14MB | Tract polygons with is_desert, severity, poverty_rate, income, no_vehicle%, elderly%, ml_risk_score, ml_risk_tier |
| `food_desert_summary.json` | ~5KB | County totals: affected population, severe/moderate/low counts |
| `businesses_clean.csv` | ~2MB | Cleaned food business list (business_id, name, address, city, lat, lon) |
| `businesses_with_tract.csv` | ~3MB | Businesses tagged with census tract GEOID + ACS demographics |
| `block_group_demographics.csv` | ~400KB | ACS block group data (1,173 rows): income, poverty, race, age, vehicle access |
| `ml_risk_scores.json` | ~200KB | Per-tract: risk_score, risk_tier, desert_probability, feature values used in prediction |
| `ml_model_stats.json` | ~15KB | Model CV metrics (ROC-AUC, F1), feature importances ranked, top 10 at-risk tracts |
| `gpu_clusters.json` | ~10KB | 6 cluster profiles: n_tracts, avg_poverty, avg_biz_per_1k, desert_rate, label |
| `gpu_umap_coords.json` | ~50KB | 2D UMAP coordinates (x, y) for all 408 tracts |
| `gpu_nearest_food.json` | ~30KB | Desert tracts with nearest_food_distance (km), nearest_business_name |
| `gpu_rf_results.json` | ~20KB | Feature importances + CPU vs GPU timing benchmarks |
| `scc_health_outcomes_by_tract.csv` | ~1MB | CDC PLACES 2023 per tract: food insecurity%, diabetes%, obesity%, hypertension%, cardiovascular%, physical inactivity% |
| `scc_calenviroscreen4.csv` | ~300KB | CalEnviroScreen 4.0: pollution burden (PM2.5, ozone, pesticides, traffic) + population vulnerability per tract |
| `cdc_places_scc.json` | ~2MB | CDC PLACES county-level health estimates |
| `cdc_places_scc_tracts.json` | ~8MB | CDC PLACES tract-level raw data |
| `crime_points.json` | ~15MB | ~50k jittered crime points: lat, lon, type, severity_weight, city |
| `crime_by_type.json` | ~5KB | Top 15 incident types with counts (theft, assault, burglary, etc.) |
| `crime_analysis.json` | ~10KB | Extended crime breakdown |
| `food_trucks_parsed.json` | ~500KB | Mobile food vendors: name, operator, city, permit status |
| `cottage_food_parsed.json` | ~300KB | Cottage food home businesses: name, city, product type |
| `wic_vendors.json` | ~400KB | WIC program authorized vendor locations |
| `healthcare_facilities.json` | ~2MB | Hospitals, clinics, urgent care from CA CDPH dataset |
| `senior_dining.json` | ~100KB | Senior nutrition program dining sites |
| `public_schools.json` | ~300KB | All public schools (K-12) in Santa Clara County |
| `osm_infrastructure.json` | ~5MB | OpenStreetMap POIs: supermarkets, food banks, pharmacies, clinics |
| `small_area_zip.json` | ~200KB | Health + food safety profiles for 57 ZIP code areas |
| `small_area_neighborhood.json` | ~500KB | Health + food safety profiles for 109 neighborhoods |
| `employee_demographics.json` | ~50KB | SCC DEH workforce diversity (gender, ethnicity, age band, department) |
| `photographers_collection.json` | ~400KB | County photographers' cultural archive metadata (760 entries) |
| `violation_types.json` | ~10KB | Top 20 violation descriptions with occurrence count and critical% |
| `trends.json` | ~30KB | Monthly time series: avg inspection score, inspection count (Jan 2019–present) |

---

## Frontend (TypeScript)

The primary user interface. Built with Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, and Leaflet 1.9.

**Start:**
```bash
cd frontend && npm install && npm run dev   # http://localhost:3000
```

**API proxy** (`next.config.ts`):
```typescript
rewrites: [{
  source: '/api/:path*',
  destination: 'http://localhost:5000/api/:path*'
}]
```

### Tab Components

All 19 tabs live in `frontend/src/components/tabs/`:

| Tab | File | Description |
|-----|------|-------------|
| **Chat** | `ChatTab.tsx` | Conversational Q&A powered by Nemotron-Nano. Type any food safety question; results include highlighted source violations. |
| **Search** | `SearchTab.tsx` | Filter restaurants by name, city, risk tier (green/yellow/red), and score range. Click a result to fly the map to that restaurant. |
| **Violators** | `ViolatorsTab.tsx` | Top 15 restaurants by total critical violation count with score history sparklines. |
| **Cities** | `CitiesTab.tsx` | City-level comparison: average score, count of green/yellow/red businesses, worst-performing city highlight. |
| **Trends** | `TrendsTab.tsx` | Monthly inspection score trend line chart. Shows county-wide average + inspection volume over time. |
| **Food Deserts** | `DesertsTab.tsx` | Food desert tract list with severity (severe/moderate/low), affected population, poverty rate. Click to fly map to tract. |
| **Equity** | `EquityTab.tsx` | Income vs. food access correlation analysis. Toggle the GeoJSON equity choropleth layer on the map. |
| **Fresh Food** | `FreshFoodTab.tsx` | Grocery store and fresh food market locations as a map layer. Summary counts by city. |
| **Health Data** | `HealthDataTab.tsx` | CDC PLACES health metrics (food insecurity%, diabetes%, obesity%) as a map heatmap. Switch between measures. |
| **ML Risk** | `MlRiskTab.tsx` | Per-tract food desert risk scores (0–100) with risk tier badges. Model architecture card with ROC-AUC, feature importances. |
| **GPU** | `GpuTab.tsx` | GPU vs CPU benchmark timing for cuML operations. 6 KMeans cluster profile cards with characteristics. |
| **Routes** | `RoutesTab.tsx` | Inspection route optimizer: select city, # of inspectors, priority level → draw optimized routes on map. |
| **Resources** | `ResourcesTab.tsx` | Community food resources: food trucks, WIC vendors, senior dining, schools, healthcare facilities. Toggle layers on map. |
| **Recalls** | `RecallsTab.tsx` | Live OpenFDA food recall data for California. Refreshes every hour. Sortable by date, product, class. |
| **Vision** | `VisionTab.tsx` | Upload a restaurant kitchen/food photo → CLIP analyzes it against 11 safety categories and shows risk scores. |
| **Workforce** | `WorkforceTab.tsx` | Santa Clara County DEH workforce diversity data: gender, ethnicity, age, department breakdown. |
| **Culture** | `CultureTab.tsx` | County photographers' cultural archive. Historical and contemporary visual documentation of local food culture. |
| **SCC Cities** | `CitiesTab.tsx` | (see Cities above) |
| **Simulate** | (inline in EquityTab) | What-if policy simulator: add grocery stores to a tract → recalculated equity score + AI policy brief. |

### Map & Components

**`MapView.tsx`** — Leaflet map with Esri basemap and four overlay layers:
- **Restaurant markers**: Color-coded dots (green=score≥80, yellow=60–79, red<60) with popup showing name, score, inspection date
- **Equity GeoJSON**: Choropleth of census tracts colored by equity tier (critical_gap=red → high=green)
- **Health heatmap**: CDC PLACES measure rendered as a continuous color scale
- **Route polylines**: Inspection routes drawn per-inspector with different colors

**`Header.tsx`**: Logo, pulsing GPU status indicator, and live stats bar (green/yellow/red/total counts via `useStats` hook)

**`TabNav.tsx`**: Horizontal scrollable tab switcher with icon + label

**`types/index.ts`** — TypeScript interfaces:
```typescript
interface Restaurant { id, name, address, city, lat, lon, score, avg_score, critical_count, tier }
interface DesertTract { geoid, name, severity, population, poverty_rate, lat, lon }
interface Route { inspector_id, stops: Stop[], total_miles, estimated_minutes }
interface HealthDataPoint { geoid, value, measure_id, lat, lon }
interface Violator { id, name, city, critical_count, latest_score }
interface MapRef { flyTo(lat, lon, zoom), showEquityLayer(), showHealthLayer(measure_id), drawRoutes(routes), clearRoutes() }
```

---

## foodsight-next (JavaScript)

An alternate JavaScript version of the frontend (React 18, Next.js 14, Tailwind CSS 3). Same conceptual structure but simpler and without TypeScript.

**Start:**
```bash
cd foodsight-next && npm install && npm run dev   # http://localhost:3001
```

**API proxy** (`next.config.mjs`):
```javascript
rewrites: [{
  source: '/flask/:path*',
  destination: 'http://localhost:5000/:path*'
}]
```

Note the different prefix: this version uses `/flask/` while `frontend/` uses `/api/`. The Flask backend handles both.

**Differences from `frontend/`:**
- JavaScript instead of TypeScript (no compile-time type checking)
- Simpler component structure (components are flat files, not organized into tabs/)
- 12 tabs vs 19 (missing GPU, ML Risk, Recalls, Vision, Workforce, Culture, Simulate)
- `app/api/proxy/[...path]/route.js` — custom server-side proxy handler for API calls

This is the earlier iteration of the UI. `frontend/` (TypeScript) is the primary interface.

---

## Raw Data

Raw input files live in `data/`. These are the source CSVs that the processing scripts transform into the backend's `data/` folder.

### Santa Clara County DEH Food Safety Data (as of March 6, 2026)

| File | Rows | Description |
|------|------|-------------|
| `SCC_DEH_Food_Data_BUSINESS_20260306.csv` | 8,588 | All permitted food facilities: business_id, name, address, city, ZIP, permit type |
| `SCC_DEH_Food_Data_INSPECTIONS_20260306.csv` | ~1M+ | Every inspection: business_id, date (YYYYMMDD), score (0–100), result (pass/fail/closed), inspection type (routine/follow-up/complaint) |
| `SCC_DEH_Food_Data_VIOLATIONS_*.csv` | ~3.8M | Every violation observed: inspection_id, violation_code, description, is_critical (bool), corrected_on_site (bool), comment |

### US Census / ACS 2024 Demographics

| File | Rows | Description |
|------|------|-------------|
| `Santa_Clara_County_ACS_2024_tract_demographics.csv` | 408 | Census tract-level: GEOID, population, median_household_income, poverty_rate, pct_no_vehicle, pct_age_65_plus, race/ethnicity breakdown |
| `Santa_Clara_County_ACS_2024_block_group_demographics.csv` | 1,173 | Same fields at block group granularity |
| `tl_2024_06_tract.zip` | — | TIGER/Line 2024 Census tract boundaries for California (state FIPS 06) |
| `tl_2024_06_bg.zip` | — | TIGER/Line 2024 block group boundaries |

### Environmental & Health Data

| File | Rows | Description |
|------|------|-------------|
| `calenviroscreen4_ca.csv` | ~8k | CalEnviroScreen 4.0: per-tract pollution burden (PM2.5, ozone, pesticides, traffic, lead) + population vulnerability scores for all CA tracts |
| `calenviroscreen5_draft.csv` | ~8k | Draft CalEnviroScreen 5.0 (not yet official) |
| `scc_health_outcomes_by_tract.csv` | 408 | CDC PLACES 2023 health metrics processed for SCC tracts |

### Santa Clara County Administrative Data

| File | Rows | Description |
|------|------|-------------|
| `Crime_Reports_20260306.csv` | ~70k | Incident-level crime reports: city, primary type, parent type, date |
| `Employee_Breakdown_by_Equal_Employment_Opportunity_Categories_20260306.csv` | ~1k | County DEH workforce: department, job title, gender, ethnicity, age band |
| `County_Photographers'_Collection_20260306.csv` | 760 | Cultural archive: photographer name, collection description, date range |

### California Statewide Reference Data

| File | Rows | Description |
|------|------|-------------|
| `ca_healthcare_facilities.csv` | ~7.6M | All CA-licensed healthcare facilities: name, address, lat/lon, facility type, license status |
| `ca_wic_vendors.csv` | ~2M | WIC program authorized vendor locations statewide |

### Data Processing Scripts (in `data/`)

| Script | Purpose |
|--------|---------|
| `build_food_access_datasets.py` | Combines business, census, and tract data into scored food access GeoJSON |
| `build_food_access_map_demo.py` | Generates a standalone HTML demo map (`santa_clara_food_access_map_demo.html`) |

---

## OpenClaw Security Policy

`backend/openclaw/foodsight-policy.yaml` (version 7) defines a strict sandbox policy for the OpenClaw agent framework.

**Network access (allowlist only):**

| Destination | Protocol | Methods | Purpose |
|---|---|---|---|
| `localhost:5000` | REST | GET, POST | FoodSight Flask API |
| `localhost:8000` | REST | GET, POST | vLLM inference |
| `api.claude.ai` | REST | POST | Claude Code backend |
| `integrate.api.nvidia.com` | REST | POST | NVIDIA NIM cloud fallback |
| `github.com` | Git+HTTPS | GET | Code access |
| `registry.npmjs.org` | HTTPS | GET | npm packages |
| `api.telegram.org` | REST | GET, POST | Telegram bridge |

**Filesystem permissions:**
- Read/Write: `/sandbox`, `/tmp`
- Read-only: `/usr`, `/lib`, `/app`, `/etc`
- No access: `/home`, `/root`, `/var`

**Process:** Runs as unprivileged user `sandbox` with no privilege escalation.

---

## DGX Spark Setup (SKILL.md)

`SKILL.md` is a 347-line operations guide for running FoodSight on NVIDIA DGX Spark GB10.

**Hardware specs:**
- CPU: ARM64 (Grace Hopper Superchip GB10)
- GPU: NVIDIA Blackwell B200, SM architecture `sm_121`
- Memory: 128GB Unified Memory Architecture (UMA) — GPU and CPU share the same pool
- CUDA: 13.0+

**Key topics covered:**

1. Pre-flight hardware verification (`nvidia-smi`, `nvcc --version`, CUDA compat check)
2. vLLM container setup (NGC `nvcr.io/nvidia/vllm:26.02-py3`) with ARM64-specific Triton/LLVM patch notes
3. Open WebUI, NIM, RAPIDS, ComfyUI container setup playbooks
4. OOM troubleshooting: UMA buffer cache flush (`echo 3 > /proc/sys/vm/drop_caches`)
5. DNS allow-listing for HuggingFace (`xethub.hf.co`)
6. Ansible deployment guidance for multi-node Spark setups
7. Known issues and workarounds for SM 121a architecture detection

---

## Running Locally

### 1. Start vLLM (Nemotron Nano)

```bash
docker run -d --name nemotron-nano --gpus all --ipc host \
  -p 8000:8000 \
  -v /home/nvidia/models/llm:/models/llm \
  nvcr.io/nvidia/vllm:26.02-py3 \
  vllm serve /models/llm/nvidia--NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4 \
    --trust-remote-code \
    --max-model-len 8192 \
    --gpu-memory-utilization 0.80
```

### 2. Start cuOpt (Route Optimization)

```bash
docker run -d --name cuopt --gpus all \
  -p 5007:5000 \
  nvcr.io/nvidia/cuopt/cuopt:26.2.0-cuda13.0-py3.13
```

### 3. Start Flask Backend

```bash
cd backend
pip install flask openai pandas transformers torch Pillow scikit-learn
PORT=5000 python3 app.py
```

The backend loads all data files on startup (takes ~10–30 seconds). CLIP loads asynchronously in the background.

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

Or the JavaScript version:
```bash
cd foodsight-next
npm install
npm run dev          # http://localhost:3001
```

### 5. (Optional) Run GPU Analysis

Pause vLLM to free memory, run cuML analysis, then resume:

```bash
./backend/run_gpu_when_ready.sh
```

This regenerates `gpu_clusters.json`, `gpu_umap_coords.json`, `gpu_nearest_food.json`, and `gpu_rf_results.json`.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Flask server port |
| `VLLM_BASE_URL` | `http://localhost:8000/v1` | vLLM OpenAI-compatible endpoint |
| `VLLM_MODEL` | `/models/llm/nvidia--NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4` | Model path or HuggingFace handle |
| `CUOPT_URL` | `http://localhost:5007` | cuOpt VRP solver endpoint |

All defaults are set for running on DGX Spark with local model paths. No API keys or external services are required.

---

## Hardware Requirements

| Component | Minimum | Recommended (DGX Spark) |
|---|---|---|
| GPU | NVIDIA GPU with 16GB VRAM | B200 (128GB UMA) |
| CUDA | 12.x | 13.0+ |
| RAM | 32GB | 128GB (UMA shared with GPU) |
| Storage | 50GB | 200GB+ (models + data) |
| CPU | x86_64 | ARM64 (Grace Hopper GB10) |

The app runs on any NVIDIA GPU but is optimized for and benchmarked on DGX Spark GB10. RAPIDS cuML and cuOpt require CUDA 11.4+. The CLIP and RAPIDS modules degrade gracefully to CPU if no GPU is detected.

---

## Dataset Credits

| Dataset | Source | Date |
|---|---|---|
| Food facility inspection data | Santa Clara County DEH | March 6, 2026 |
| ACS demographics | US Census Bureau (ACS 5-Year 2024) | 2024 |
| Census tract boundaries | US Census TIGER/Line 2024 | 2024 |
| CalEnviroScreen 4.0 | CA OEHHA | 2021 |
| CDC PLACES health metrics | CDC / Robert Wood Johnson Foundation | 2023 |
| Healthcare facilities | CA CDPH | 2024 |
| WIC vendor locations | CA WIC Program | 2024 |
| Crime reports | Santa Clara County Sheriff / Police | March 6, 2026 |
| OpenStreetMap infrastructure | OpenStreetMap contributors | March 2026 |
| Food recalls | OpenFDA | Live |
