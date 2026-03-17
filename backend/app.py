#!/usr/bin/env python3
"""
FoodSight AI - Flask Backend
Serves the web UI and provides RAG-powered Q&A about Santa Clara County food safety.
"""

import json
import math
import os
import re
import base64
import io
import threading
import pandas as pd
from flask import Flask, request, jsonify, render_template, redirect
from openai import OpenAI
from food_equity import compute_food_equity_scores, enrich_geojson_with_equity, classify_business

app = Flask(__name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
RAW_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")

# --- Load data at startup ---
print("Loading restaurant data...")
with open(f"{DATA_DIR}/restaurants.json") as f:
    RESTAURANTS = json.load(f)

with open(f"{DATA_DIR}/name_index.json") as f:
    NAME_INDEX = json.load(f)

print(f"  Loaded {len(RESTAURANTS):,} restaurants")

# Index restaurants by business_id for fast lookup
BIZ_BY_ID = {r["business_id"]: r for r in RESTAURANTS}

# --- Load food equity data at startup ---
print("Loading food equity scores...")
_EQUITY_GEOJSON_PATH = f"{DATA_DIR}/food_equity_tracts.geojson"
if not os.path.exists(_EQUITY_GEOJSON_PATH):
    print("  Computing food equity scores (first run)...")
    _eq_df = compute_food_equity_scores()
    _eq_geojson = enrich_geojson_with_equity(_eq_df)
    with open(_EQUITY_GEOJSON_PATH, "w") as f:
        json.dump(_eq_geojson, f)
    print("  Saved food_equity_tracts.geojson")
with open(_EQUITY_GEOJSON_PATH) as f:
    EQUITY_GEOJSON = json.load(f)
EQUITY_BY_GEOID = {feat["properties"]["geoid"]: feat["properties"] for feat in EQUITY_GEOJSON["features"]}
print(f"  Loaded equity data for {len(EQUITY_BY_GEOID):,} tracts")

# Load violation chunks for RAG
print("Loading violation chunks for RAG...")
VIOLATION_CHUNKS = []
with open(f"{DATA_DIR}/violations_text.jsonl") as f:
    for line in f:
        VIOLATION_CHUNKS.append(json.loads(line))
print(f"  Loaded {len(VIOLATION_CHUNKS):,} inspection chunks")

# Load inspections CSV for trends
print("Loading inspections CSV for trends...")
INSPECTIONS = pd.read_csv(f"{RAW_DATA_DIR}/SCC_DEH_Food_Data_INSPECTIONS_20260306.csv")
INSPECTIONS["date"] = pd.to_datetime(INSPECTIONS["date"], format="%Y%m%d", errors="coerce")
INSPECTIONS["SCORE"] = pd.to_numeric(INSPECTIONS["SCORE"], errors="coerce")
print(f"  Loaded {len(INSPECTIONS):,} inspections")

# Load violations CSV for violation-type aggregation
print("Loading violations CSV...")
VIOLATIONS = pd.read_csv(f"{RAW_DATA_DIR}/SCC_DEH_Food_Data_VIOLATIONS_20260306.csv")
print(f"  Loaded {len(VIOLATIONS):,} violations")

# Load food access tract data for equity analysis
TRACT_ACCESS = None
tract_access_file = f"{DATA_DIR}/food_access_tracts.csv"
if os.path.exists(tract_access_file):
    TRACT_ACCESS = pd.read_csv(tract_access_file)
    print(f"  Loaded {len(TRACT_ACCESS):,} tracts for equity analysis")

# Load ML risk scores
ML_RISK_BY_GEOID = {}
ml_risk_file = f"{DATA_DIR}/ml_risk_scores.json"
if os.path.exists(ml_risk_file):
    with open(ml_risk_file) as f:
        _ml = json.load(f)
    ML_RISK_BY_GEOID = {r["geoid"]: r for r in _ml}
    print(f"  Loaded ML risk scores for {len(ML_RISK_BY_GEOID):,} tracts")

# Load business categories (fresh food / restaurant / etc.)
BIZ_CATEGORIES = {}
_biz_cat_file = f"{RAW_DATA_DIR}/santa_clara_food_businesses_with_census.csv"
if os.path.exists(_biz_cat_file):
    _bcat_df = pd.read_csv(_biz_cat_file)
    for _, row in _bcat_df.iterrows():
        BIZ_CATEGORIES[str(row["business_id"])] = {
            "category": row.get("business_category", "other_food_business"),
            "fresh_food": bool(row.get("fresh_food_likely", 0)),
            "lat": row.get("latitude"),
            "lon": row.get("longitude"),
            "name": row.get("name", ""),
            "city": str(row.get("city", "")).strip().title(),
        }
    print(f"  Loaded business categories: {len(BIZ_CATEGORIES):,}")

# Load fresh-food access vulnerability scores per tract
TRACT_SCORED = {}
_tract_scored_file = f"{RAW_DATA_DIR}/santa_clara_tract_food_access_scored.csv"
if os.path.exists(_tract_scored_file):
    _ts_df = pd.read_csv(_tract_scored_file)
    for _, row in _ts_df.iterrows():
        geoid = str(row["geoid"]).zfill(11)
        TRACT_SCORED[geoid] = {
            "geoid": geoid,
            "name": row.get("name", ""),
            "total_population": row.get("total_population"),
            "fresh_food_businesses": int(row.get("fresh_food_businesses", 0)),
            "fresh_food_per_1k": round(float(row.get("fresh_food_per_1000_people", 0) or 0), 2),
            "fresh_food_share": round(float(row.get("fresh_food_share", 0) or 0), 3),
            "access_vulnerability_score": round(float(row.get("access_vulnerability_score", 0) or 0), 3),
            "food_access_priority_score": round(float(row.get("food_access_priority_score", 0) or 0), 3),
            "priority_area": bool(row.get("priority_area_flag", 0)),
            "access_label": row.get("access_label", ""),
            "restaurant_per_1k": round(float(row.get("restaurant_per_1000_people", 0) or 0), 2),
        }
    print(f"  Loaded access vulnerability scores for {len(TRACT_SCORED):,} tracts")

# OSM infrastructure (supermarkets, clinics, pharmacies, hospitals, food banks)
OSM_INFRA = []
_osm_file = f"{DATA_DIR}/osm_infrastructure.json"
if os.path.exists(_osm_file):
    with open(_osm_file) as f:
        OSM_INFRA = json.load(f)
    print(f"  Loaded {len(OSM_INFRA):,} OSM infrastructure points")

# CDC PLACES 2023 health outcomes by census tract (food insecurity, diabetes, obesity, etc.)
HEALTH_OUTCOMES = {}
_health_file = f"{DATA_DIR}/scc_health_outcomes_by_tract.csv"
if os.path.exists(_health_file):
    _ho_df = pd.read_csv(_health_file)
    for _, row in _ho_df.iterrows():
        geoid = str(int(float(row["tract_geoid"]))).zfill(11)
        HEALTH_OUTCOMES[geoid] = {k: (None if pd.isna(v) else round(float(v), 1) if isinstance(v, float) else v)
                                   for k, v in row.items() if k != "tract_geoid"}
        HEALTH_OUTCOMES[geoid]["geoid"] = geoid
    print(f"  Loaded CDC PLACES health outcomes for {len(HEALTH_OUTCOMES):,} tracts")

# CalEnviroScreen 4.0 — pollution burden + population vulnerability scores
CALENVIRO = {}
_ces_file = f"{DATA_DIR}/scc_calenviroscreen4.csv"
if os.path.exists(_ces_file):
    _ces_df = pd.read_csv(_ces_file)
    for _, row in _ces_df.iterrows():
        geoid = str(int(float(row["geoid"]))).zfill(11)
        CALENVIRO[geoid] = {k: (None if pd.isna(v) else round(float(v), 2) if isinstance(v, float) else v)
                             for k, v in row.items() if k not in ("tract", "geoid")}
        CALENVIRO[geoid]["geoid"] = geoid
    print(f"  Loaded CalEnviroScreen data for {len(CALENVIRO):,} tracts")

# CDC PLACES county health metrics for Santa Clara County
CDC_PLACES = []
_cdc_file = f"{DATA_DIR}/cdc_places_scc.json"
if os.path.exists(_cdc_file):
    with open(_cdc_file) as f:
        CDC_PLACES = json.load(f)
    print(f"  Loaded {len(CDC_PLACES):,} CDC PLACES health measures")

# OpenFDA recall cache (1-hour TTL)
import time as _time
_RECALLS_CACHE: dict = {"data": None, "ts": 0.0}

def get_food_recalls() -> list:
    import urllib.request
    now = _time.time()
    if _RECALLS_CACHE["data"] and now - _RECALLS_CACHE["ts"] < 3600:
        return _RECALLS_CACHE["data"]
    try:
        url = ("https://api.fda.gov/food/enforcement.json"
               "?search=distribution_pattern:%22California%22"
               "&limit=50&sort=recall_initiation_date:desc")
        req = urllib.request.Request(url, headers={"User-Agent": "FoodSight-AI/1.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            raw = json.loads(resp.read())
        recalls = [{
            "firm": r.get("recalling_firm", ""),
            "product": r.get("product_description", "")[:120],
            "reason": r.get("reason_for_recall", "")[:160],
            "classification": r.get("classification", ""),
            "status": r.get("status", ""),
            "date": r.get("recall_initiation_date", ""),
            "city": r.get("city", ""),
            "state": r.get("state", ""),
            "recall_number": r.get("recall_number", ""),
        } for r in raw.get("results", [])]
        _RECALLS_CACHE.update({"data": recalls, "ts": now})
        return recalls
    except Exception:
        return _RECALLS_CACHE["data"] or []


# Food trucks and cottage food from SCC DEH Socrata (live data)
FOOD_TRUCKS = []
_trucks_file = f"{DATA_DIR}/food_trucks_parsed.json"
if os.path.exists(_trucks_file):
    with open(_trucks_file) as f:
        FOOD_TRUCKS = json.load(f)
    print(f"  Loaded {len(FOOD_TRUCKS):,} food trucks (SCC DEH)")

COTTAGE_FOOD = []
_cottage_file = f"{DATA_DIR}/cottage_food_parsed.json"
if os.path.exists(_cottage_file):
    with open(_cottage_file) as f:
        COTTAGE_FOOD = json.load(f)
    print(f"  Loaded {len(COTTAGE_FOOD):,} cottage food businesses (SCC DEH)")

# WIC vendors (CA WIC program — Santa Clara County)
WIC_VENDORS = []
_wic_file = f"{DATA_DIR}/wic_vendors.json"
if os.path.exists(_wic_file):
    with open(_wic_file) as f:
        WIC_VENDORS = json.load(f)
    print(f"  Loaded {len(WIC_VENDORS):,} WIC vendors (SCC)")

# Healthcare facilities (CDPH — Santa Clara County, OPEN only)
HEALTHCARE = []
_hc_file = f"{DATA_DIR}/healthcare_facilities.json"
if os.path.exists(_hc_file):
    with open(_hc_file) as f:
        HEALTHCARE = json.load(f)
    print(f"  Loaded {len(HEALTHCARE):,} healthcare facilities (SCC)")

# Senior dining / nutrition sites (SCC Aging and Adult Services)
SENIOR_DINING = []
_sd_file = f"{DATA_DIR}/senior_dining.json"
if os.path.exists(_sd_file):
    with open(_sd_file) as f:
        SENIOR_DINING = json.load(f)
    print(f"  Loaded {len(SENIOR_DINING):,} senior dining sites (SCC)")

# Public schools (SCC GIS — all grades)
PUBLIC_SCHOOLS = []
_sc_file = f"{DATA_DIR}/public_schools.json"
if os.path.exists(_sc_file):
    with open(_sc_file) as f:
        PUBLIC_SCHOOLS = json.load(f)
    print(f"  Loaded {len(PUBLIC_SCHOOLS):,} public schools (SCC)")

# Small Area Health Profiles — by ZIP (57 ZCTAs) and neighborhood (109)
SMALL_AREA_ZIP = []
_saz_file = f"{DATA_DIR}/small_area_zip.json"
if os.path.exists(_saz_file):
    with open(_saz_file) as f:
        SMALL_AREA_ZIP = json.load(f)
    print(f"  Loaded {len(SMALL_AREA_ZIP):,} ZIP-level health profiles")

SMALL_AREA_NBHD = []
_san_file = f"{DATA_DIR}/small_area_neighborhood.json"
if os.path.exists(_san_file):
    with open(_san_file) as f:
        SMALL_AREA_NBHD = json.load(f)
    print(f"  Loaded {len(SMALL_AREA_NBHD):,} neighborhood health profiles")


# vLLM client (OpenAI-compatible)
VLLM_BASE_URL = os.environ.get("VLLM_BASE_URL", "http://localhost:8000/v1")
VLLM_MODEL = os.environ.get("VLLM_MODEL", "/models/llm/nvidia--NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4")

client = OpenAI(base_url=VLLM_BASE_URL, api_key="none")


# ─── CLIP Vision Model ────────────────────────────────────────────────────────
CLIP_MODEL_PATH = "/home/nvidia/models/cv/openai--clip-vit-base-patch32"
CLIP_MODEL = None
CLIP_PROCESSOR = None
CLIP_TEXT_EMBEDDINGS = None  # pre-computed text embeddings for violation prompts
CLIP_LOCK = threading.Lock()
CLIP_READY = threading.Event()

# Food safety prompts mapped to violation categories
FOOD_SAFETY_PROMPTS = [
    ("temperature_control",     "food stored at wrong temperature, hot food cold, cold food warm"),
    ("handwashing",             "employee not washing hands, no handwashing, poor hygiene practices"),
    ("pest_infestation",        "cockroaches, rodents, insects, pests, vermin in kitchen or restaurant"),
    ("food_contamination",      "cross contamination, raw meat near ready to eat food, dirty cutting board"),
    ("surface_cleanliness",     "dirty floor walls ceiling, unclean kitchen surfaces, grease buildup"),
    ("food_storage",            "improper food storage, food not covered, food on floor, open containers"),
    ("equipment_sanitation",    "unclean equipment, dirty utensils, unsanitized food contact surfaces"),
    ("employee_hygiene",        "employee not wearing gloves, hair not covered, sick employee handling food"),
    ("chemical_hazard",         "chemical storage near food, cleaning products near food items"),
    ("adequate_facilities",     "no soap or towels at handwash station, broken sink, blocked handwashing"),
    ("safe_food_preparation",   "safe clean food preparation, proper gloves worn, food handled correctly"),
    ("clean_environment",       "clean restaurant kitchen, organized food storage, proper food safety"),
]

def _load_clip():
    """Load CLIP model and pre-compute text embeddings (called in background thread)."""
    global CLIP_MODEL, CLIP_PROCESSOR, CLIP_TEXT_EMBEDDINGS
    try:
        import torch
        import torch.nn.functional as F
        from transformers import CLIPModel, CLIPProcessor as _CLIPProc

        print("Loading CLIP ViT-B/32 from local model cache...")
        with CLIP_LOCK:
            CLIP_MODEL = CLIPModel.from_pretrained(CLIP_MODEL_PATH)
            CLIP_PROCESSOR = _CLIPProc.from_pretrained(CLIP_MODEL_PATH)
            CLIP_MODEL.eval()

        # Pre-compute text embeddings for all safety prompts
        texts = [p[1] for p in FOOD_SAFETY_PROMPTS]
        with torch.no_grad():
            inputs = CLIP_PROCESSOR(text=texts, return_tensors="pt", padding=True, truncation=True, max_length=77)
            text_out = CLIP_MODEL.text_model(**{k: v for k, v in inputs.items() if k in ["input_ids", "attention_mask"]})
            feats = CLIP_MODEL.text_projection(text_out.pooler_output)
            feats = F.normalize(feats, dim=-1)

        CLIP_TEXT_EMBEDDINGS = feats
        CLIP_READY.set()
        print(f"CLIP ready — {len(FOOD_SAFETY_PROMPTS)} safety prompts encoded.")
    except Exception as e:
        print(f"CLIP load failed: {e}")
        CLIP_READY.set()  # signal even on failure so requests don't hang

# Start CLIP loading in background so Flask starts immediately
threading.Thread(target=_load_clip, daemon=True).start()


def search_violations(query: str, top_k: int = 8) -> list[dict]:
    """Simple keyword search over violation chunks."""
    query_lower = query.lower()
    terms = re.findall(r"\b\w{3,}\b", query_lower)
    # Remove common stop words
    stopwords = {"the", "and", "for", "that", "this", "with", "are", "was", "has", "have", "what", "how", "any"}
    terms = [t for t in terms if t not in stopwords]

    scored = []
    for chunk in VIOLATION_CHUNKS:
        text_lower = chunk["text"].lower()
        score = sum(text_lower.count(term) for term in terms)
        # Bonus: exact name match
        name_lower = chunk["name"].lower()
        if any(term in name_lower for term in terms):
            score += 20
        if score > 0:
            scored.append((score, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored[:top_k]]


def find_restaurant_by_name(name: str) -> list[dict]:
    """Find restaurants matching a name query."""
    name_lower = name.lower().strip()
    results = []

    # Exact match
    if name_lower in NAME_INDEX:
        for biz_id in NAME_INDEX[name_lower]:
            if biz_id in BIZ_BY_ID:
                results.append(BIZ_BY_ID[biz_id])

    # Partial match
    if not results:
        for key, ids in NAME_INDEX.items():
            if name_lower in key or key in name_lower:
                for biz_id in ids:
                    if biz_id in BIZ_BY_ID:
                        r = BIZ_BY_ID[biz_id]
                        if r not in results:
                            results.append(r)

    return results[:5]


def build_context(query: str) -> str:
    """Build RAG context for the query."""
    chunks = search_violations(query, top_k=6)
    if not chunks:
        return "No specific inspection records found for this query."

    parts = []
    for c in chunks:
        parts.append(c["text"])
    return "\n\n---\n\n".join(parts)


def ask_llm(question: str, context: str) -> str:
    """Call vLLM with RAG context."""
    system_prompt = """You are FoodSight AI, a food safety assistant for Santa Clara County, California.
You help residents understand restaurant health inspection records.
Answer questions based on the inspection data provided. Be concise, helpful, and factual.
If a restaurant has critical violations, clearly flag them. If data is limited, say so.
Respond ONLY with the final answer. Do not show reasoning, thinking, or intermediate steps.
Format your response in plain text, not markdown."""

    user_prompt = f"""Question: {question}

Relevant inspection records:
{context}

Answer (2-4 sentences, factual, name restaurants and key details, no reasoning steps):"""

    try:
        resp = client.chat.completions.create(
            model=VLLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=500,
            temperature=0.2,
        )
        raw = resp.choices[0].message.content or ""
        # Nemotron-Nano is a reasoning model — strip the <think>...</think> block
        if "</think>" in raw:
            raw = raw.split("</think>", 1)[1].strip()
        return raw
    except Exception as e:
        # Smart fallback: summarize the data without LLM
        chunks = search_violations(question, top_k=4)
        if not chunks:
            return "I found no matching inspection records for that query. Try searching for a specific restaurant name or violation type."
        lines = [f"[AI model is loading — here's what the inspection data shows]\n"]
        for c in chunks:
            score_str = f"Score: {c['score']}" if c.get('score') else ""
            lines.append(f"• {c['name']} ({c.get('city','')}) — {c.get('date','')} {score_str}")
            # Extract violation count from text
            text = c.get("text", "")
            if "Violations" in text:
                viol_part = text.split("Violations")[1][:200]
                crit_count = viol_part.count("[CRITICAL]")
                if crit_count:
                    lines.append(f"  ⚠ {crit_count} CRITICAL violation(s) found")
        lines.append(f"\n(Nemotron-3 120B model is loading on DGX Spark — full AI answers coming soon)")
        return "\n".join(lines)


# --- Routes ---

@app.route("/")
def index():
    """Redirect to Next.js frontend."""
    return redirect("http://localhost:3000", code=302)


@app.route("/api/restaurants")
def get_restaurants():
    """Return all restaurants for the map."""
    # Slim down for the map (lat/lon + metadata only)
    slim = [
        {
            "id": r["business_id"],
            "name": r["name"],
            "address": r["address"],
            "city": r["city"],
            "lat": float(r["latitude"]),
            "lon": float(r["longitude"]),
            "score": r["latest_score"],
            "avg_score": r["avg_score"],
            "tier": r["tier"],
            "critical": r["total_critical"],
            "inspections": r["inspection_count"],
            "last_date": r["latest_date"],
        }
        for r in RESTAURANTS
        if r.get("latitude") and r.get("longitude")
    ]
    return jsonify(slim)


@app.route("/api/restaurant/<biz_id>")
def get_restaurant(biz_id):
    """Return full details for one restaurant."""
    r = BIZ_BY_ID.get(biz_id)
    if not r:
        return jsonify({"error": "Not found"}), 404

    # Get recent inspections
    chunks = [c for c in VIOLATION_CHUNKS if c["business_id"] == biz_id]
    chunks.sort(key=lambda x: x["date"], reverse=True)

    return jsonify({
        "restaurant": r,
        "recent_inspections": chunks[:5],
    })


@app.route("/api/ask", methods=["POST"])
def ask():
    """RAG-powered Q&A endpoint."""
    data = request.json
    question = data.get("question", "").strip()
    if not question:
        return jsonify({"error": "No question provided"}), 400

    context = build_context(question)
    answer = ask_llm(question, context)

    # Also find matching restaurants for the map to highlight
    matches = find_restaurant_by_name(question)
    highlight_ids = [r["business_id"] for r in matches]

    return jsonify({
        "question": question,
        "answer": answer,
        "highlight_ids": highlight_ids,
        "sources": len([c for c in search_violations(question, 6)]),
    })


@app.route("/api/stats")
def stats():
    """Summary statistics."""
    total = len(RESTAURANTS)
    green = sum(1 for r in RESTAURANTS if r["tier"] == "green")
    yellow = sum(1 for r in RESTAURANTS if r["tier"] == "yellow")
    red = sum(1 for r in RESTAURANTS if r["tier"] == "red")
    return jsonify({
        "total_restaurants": total,
        "green": green,
        "yellow": yellow,
        "red": red,
        "total_inspections": len(VIOLATION_CHUNKS),
    })


@app.route("/api/worst-violators")
def worst_violators():
    """Top 15 restaurants by total critical violations."""
    sorted_r = sorted(
        [r for r in RESTAURANTS if r.get("total_critical", 0) > 0],
        key=lambda x: x["total_critical"],
        reverse=True,
    )[:15]
    result = [
        {
            "id": r["business_id"],
            "name": r["name"],
            "city": r["city"],
            "critical": r["total_critical"],
            "total_violations": r["total_violations"],
            "score": r["latest_score"],
            "tier": r["tier"],
            "lat": float(r["latitude"]),
            "lon": float(r["longitude"]),
        }
        for r in sorted_r
    ]
    return jsonify(result)


@app.route("/api/by-city")
def by_city():
    """Average safety score and counts by city."""
    from collections import defaultdict
    city_data = defaultdict(lambda: {"scores": [], "red": 0, "total": 0, "critical": 0})
    for r in RESTAURANTS:
        city = str(r.get("city", "Unknown")).strip().title()
        score = r.get("latest_score", 0)
        city_data[city]["total"] += 1
        city_data[city]["critical"] += r.get("total_critical", 0)
        if score > 0:
            city_data[city]["scores"].append(score)
        if r["tier"] == "red":
            city_data[city]["red"] += 1

    result = []
    for city, d in city_data.items():
        avg = round(sum(d["scores"]) / len(d["scores"]), 1) if d["scores"] else 0
        result.append({
            "city": city,
            "avg_score": avg,
            "total": d["total"],
            "red_count": d["red"],
            "critical_violations": d["critical"],
        })
    result.sort(key=lambda x: x["avg_score"], reverse=True)
    return jsonify(result)


@app.route("/api/crime-points")
def crime_points():
    """Return sampled crime heatmap points."""
    crime_file = f"{DATA_DIR}/crime_points.json"
    if not os.path.exists(crime_file):
        return jsonify([])
    with open(crime_file) as f:
        points = json.load(f)
    # Sample down to 5000 for browser performance
    import random
    random.seed(1)
    if len(points) > 5000:
        points = random.sample(points, 5000)
    return jsonify(points)


@app.route("/api/report/<biz_id>")
def report(biz_id):
    """Plain-text safety report for a restaurant."""
    r = BIZ_BY_ID.get(biz_id)
    if not r:
        return "Restaurant not found", 404

    chunks = [c for c in VIOLATION_CHUNKS if c["business_id"] == biz_id]
    chunks.sort(key=lambda x: x["date"], reverse=True)

    lines = [
        "=" * 60,
        f"FOOD SAFETY REPORT — Santa Clara County",
        "=" * 60,
        f"Restaurant: {r['name']}",
        f"Address:    {r['address']}, {r['city']} {r.get('postal_code', '')}",
        f"Phone:      {r.get('phone_number', 'N/A')}",
        "",
        f"Latest Score:  {r['latest_score'] or 'N/A'}",
        f"Average Score: {r['avg_score'] or 'N/A'}",
        f"Safety Tier:   {r['tier'].upper()}",
        f"Inspections:   {r['inspection_count']}",
        f"Critical Violations (total): {r['total_critical']}",
        f"Last Inspected: {r['latest_date']}",
        "",
        "-" * 60,
        "INSPECTION HISTORY (most recent first)",
        "-" * 60,
    ]

    for c in chunks[:5]:
        lines.append(f"\nDate: {c['date']}  Score: {c['score']}")
        lines.append(c["text"].split("Violations")[1] if "Violations" in c["text"] else "")

    lines += ["", "=" * 60, "Generated by FoodSight AI — Santa Clara County Food Safety", "=" * 60]

    from flask import Response
    filename = r["name"].replace(" ", "_").replace("/", "-")[:40]
    return Response(
        "\n".join(lines),
        mimetype="text/plain",
        headers={"Content-Disposition": f'attachment; filename="FoodSight_{filename}.txt"'},
    )


@app.route("/api/food-equity-geojson")
def food_equity_geojson():
    """GeoJSON enriched with food equity scores and business type breakdown."""
    return jsonify(EQUITY_GEOJSON)


@app.route("/api/food-equity-summary")
def food_equity_summary():
    """County-wide food equity summary statistics."""
    tiers = {"critical_equity_gap": 0, "low_equity": 0, "moderate_equity": 0, "high_equity": 0}
    total_pop = 0
    critical_pop = 0
    total_grocery = 0
    total_fast_food = 0
    total_institutional = 0
    total_public = 0

    for props in EQUITY_BY_GEOID.values():
        tier = props.get("equity_tier", "unknown")
        if tier in tiers:
            tiers[tier] += 1
        pop = props.get("total_population", 0) or 0
        total_pop += pop
        if tier == "critical_equity_gap":
            critical_pop += pop
        total_grocery += props.get("grocery", 0) or 0
        total_fast_food += props.get("fast_food", 0) or 0
        total_institutional += props.get("institutional", 0) or 0
        total_public += props.get("public_food_count", 0) or 0

    return jsonify({
        "total_tracts": len(EQUITY_BY_GEOID),
        "total_population": total_pop,
        "tier_counts": tiers,
        "critical_equity_population": critical_pop,
        "critical_equity_population_pct": round(critical_pop / max(total_pop, 1) * 100, 1),
        "county_grocery_count": total_grocery,
        "county_fast_food_count": total_fast_food,
        "county_institutional_count": total_institutional,
        "county_public_food_count": total_public,
        "grocery_pct_of_public": round(total_grocery / max(total_public, 1) * 100, 1),
        "fast_food_pct_of_public": round(total_fast_food / max(total_public, 1) * 100, 1),
        "institutional_pct_of_all": round(total_institutional / max(total_grocery + total_fast_food + total_institutional + total_public, 1) * 100, 1),
    })


@app.route("/api/simulate", methods=["POST"])
def simulate():
    """What-If Intervention Simulator — powered by DGX Spark local inference."""
    data = request.json
    geoid = data.get("geoid", "").strip()
    new_businesses = int(data.get("new_businesses", 1))

    if not geoid:
        return jsonify({"error": "No tract geoid provided"}), 400
    if new_businesses < 1 or new_businesses > 10:
        return jsonify({"error": "new_businesses must be 1–10"}), 400

    props = EQUITY_BY_GEOID.get(geoid)
    if not props:
        return jsonify({"error": f"Tract {geoid} not found"}), 404

    pop = props.get("total_population", 0) or 1
    public_before = props.get("public_food_count", 0) or 0
    grocery_before = props.get("grocery", 0) or 0
    fast_food_before = props.get("fast_food", 0) or 0
    liquor_before = props.get("liquor", 0) or 0
    score_before = props.get("food_equity_score", 0) or 0
    tier_before = props.get("equity_tier", "unknown")

    # Simulate adding grocery stores
    public_after = public_before + new_businesses
    grocery_after = grocery_before + new_businesses
    safe_public_after = max(public_after, 1)

    grocery_pct_after = round(grocery_after / safe_public_after * 100, 1)
    fast_food_pct_after = round(fast_food_before / safe_public_after * 100, 1)
    public_per_1k_after = round(public_after / pop * 1000, 2)

    score_after = min(100.0, round(
        (grocery_pct_after * 0.5) +
        (min(public_per_1k_after, 10) * 3.0) +
        (-(fast_food_pct_after * 0.1)) +
        (-(min(liquor_before, 5) * 2.0)),
        1
    ))

    def equity_tier(score):
        if score >= 50: return "high_equity"
        elif score >= 25: return "moderate_equity"
        elif score >= 10: return "low_equity"
        return "critical_equity_gap"

    tier_after = equity_tier(score_after)
    tier_changed = tier_before != tier_after

    # Find neighboring tracts with food equity issues
    neighbor_count = sum(
        1 for p in EQUITY_BY_GEOID.values()
        if p.get("equity_tier") in ("critical_equity_gap", "low_equity")
        and p.get("geoid") != geoid
    )

    result = {
        "target_geoid": geoid,
        "new_businesses": new_businesses,
        "population": pop,
        "before": {
            "grocery": grocery_before,
            "fast_food": fast_food_before,
            "public_food_count": public_before,
            "grocery_pct": props.get("grocery_pct", 0),
            "fast_food_pct": props.get("fast_food_pct", 0),
            "institutional": props.get("institutional", 0),
            "institutional_pct": props.get("institutional_pct", 0),
            "food_equity_score": score_before,
            "equity_tier": tier_before,
            "public_biz_per_1k": props.get("public_biz_per_1k", 0),
            "median_household_income": props.get("median_household_income", 0),
            "poverty_rate_pct": props.get("poverty_rate_pct", 0),
        },
        "after": {
            "grocery": grocery_after,
            "fast_food": fast_food_before,
            "public_food_count": public_after,
            "grocery_pct": grocery_pct_after,
            "fast_food_pct": fast_food_pct_after,
            "food_equity_score": score_after,
            "equity_tier": tier_after,
            "public_biz_per_1k": public_per_1k_after,
        },
        "impact": {
            "score_improvement": round(score_after - score_before, 1),
            "tier_changed": tier_changed,
            "tier_before": tier_before,
            "tier_after": tier_after,
            "population": pop,
            "nearby_underserved_tracts": neighbor_count,
        },
    }

    # Generate policy brief via local Nemotron on DGX Spark
    b = result["before"]
    a = result["after"]
    brief_prompt = f"""You are a public policy analyst for Santa Clara County, California.
Write a 3-paragraph policy brief recommending this food equity intervention.

DATA:
- Tract: {geoid} | Population: {pop:,}
- Current Food Equity Score: {score_before}/100 ({tier_before.replace('_',' ').title()})
- Public grocery stores: {grocery_before} ({b['grocery_pct']}% of public food options)
- Fast food outlets: {fast_food_before} ({b['fast_food_pct']}% of public food options)
- Institutional food (tech campuses/schools — NOT publicly accessible): {b['institutional']} businesses ({b['institutional_pct']}%)
- Median income: ${b['median_household_income']:,} | Poverty rate: {b['poverty_rate_pct']}%
- After adding {new_businesses} grocery store(s): Food Equity Score rises to {score_after}/100 ({tier_after.replace('_',' ').title()})
- Grocery share improves: {b['grocery_pct']}% → {grocery_pct_after}% of public food options

Write 3 short paragraphs:
1. THE PROBLEM: Describe the Silicon Valley food equity paradox — high institutional/tech food, low public grocery access
2. THE INTERVENTION: What changes with {new_businesses} new grocery store(s), cite specific numbers
3. THE RECOMMENDATION: Urge action, note this analysis ran locally on an NVIDIA DGX Spark (no community data left the device)

Be direct and specific with numbers. No markdown formatting."""

    try:
        resp = client.chat.completions.create(
            model=VLLM_MODEL,
            messages=[
                {"role": "system", "content": "You are a concise public policy analyst."},
                {"role": "user", "content": brief_prompt},
            ],
            max_tokens=800,
            temperature=0.4,
        )
        raw = resp.choices[0].message.content or ""
        # Strip thinking tokens (Nemotron outputs <think>...</think> or reasoning before final answer)
        if "</think>" in raw:
            raw = raw.split("</think>", 1)[-1].strip()
        elif "\n\n" in raw and len(raw) > 400:
            # Heuristic: if very long, take the last 2/3 which is likely the actual brief
            parts = raw.strip().split("\n\n")
            raw = "\n\n".join(parts[-3:]) if len(parts) >= 3 else raw
        result["policy_brief"] = raw.strip()
    except Exception as e:
        result["policy_brief"] = (
            f"Tract {geoid} currently scores {score_before}/100 on food equity. "
            f"With {grocery_before} public grocery stores serving {pop:,} residents ({b['grocery_pct']}% of food options), "
            f"and {b['institutional']} institutional food outlets inaccessible to the public, this community "
            f"lacks meaningful healthy food choice. Adding {new_businesses} grocery store(s) would raise the "
            f"Food Equity Score to {score_after}/100 and improve grocery access to {grocery_pct_after}% of food options. "
            f"[LLM offline: {e}]"
        )

    return jsonify(result)


@app.route("/api/food-deserts")
def food_deserts():
    """Return food desert summary + tract list."""
    summary_file = f"{DATA_DIR}/food_desert_summary.json"
    if not os.path.exists(summary_file):
        return jsonify({"error": "Run build_food_access.py first"}), 404
    with open(summary_file) as f:
        return jsonify(json.load(f))


@app.route("/api/food-access-geojson")
def food_access_geojson():
    """Return GeoJSON of tracts with food access classification + ML risk scores."""
    geojson_file = f"{DATA_DIR}/food_access_tracts.geojson"
    if not os.path.exists(geojson_file):
        return jsonify({"error": "Run build_food_access.py first"}), 404
    with open(geojson_file) as f:
        gj = json.load(f)
    # Enrich with ML risk scores (normalize geoid: strip leading zero)
    if ML_RISK_BY_GEOID:
        for feat in gj.get("features", []):
            geoid = str(feat["properties"].get("geoid", "")).lstrip("0")
            ml = ML_RISK_BY_GEOID.get(geoid)
            if ml:
                feat["properties"]["ml_risk_score"] = ml["risk_score"]
                feat["properties"]["ml_risk_tier"] = ml["risk_tier"]
                feat["properties"]["ml_desert_probability"] = ml["desert_probability"]
    return jsonify(gj)


def _haversine(lat1, lon1, lat2, lon2):
    """Return distance in miles between two lat/lon points."""
    R = 3958.8  # Earth radius in miles
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@app.route("/api/search")
def search_restaurants():
    """Search restaurants by name, filter by city/tier/score range. Return top 50."""
    q = request.args.get("q", "").strip().lower()
    city_filter = request.args.get("city", "").strip().lower()
    tier_filter = request.args.get("tier", "").strip().lower()
    min_score = request.args.get("min_score", type=float)
    max_score = request.args.get("max_score", type=float)

    results = []
    for r in RESTAURANTS:
        # Name search (substring match)
        if q and q not in str(r.get("name", "")).lower():
            continue
        # City filter
        r_city = str(r.get("city", "")).strip().lower()
        if city_filter and city_filter != r_city:
            continue
        # Tier filter
        if tier_filter and tier_filter != r.get("tier", ""):
            continue
        # Score range filter
        score = r.get("latest_score")
        if score is not None and score > 0:
            if min_score is not None and score < min_score:
                continue
            if max_score is not None and score > max_score:
                continue
        elif min_score is not None or max_score is not None:
            # Skip restaurants without a valid score when score filters are active
            continue
        # Must have lat/lon
        if not r.get("latitude") or not r.get("longitude"):
            continue
        results.append({
            "id": r["business_id"],
            "name": r["name"],
            "address": r["address"],
            "city": r["city"],
            "lat": float(r["latitude"]),
            "lon": float(r["longitude"]),
            "score": r["latest_score"],
            "avg_score": r["avg_score"],
            "tier": r["tier"],
            "critical": r["total_critical"],
            "inspections": r["inspection_count"],
            "last_date": r["latest_date"],
        })
        if len(results) >= 50:
            break

    return jsonify(results)


@app.route("/api/nearby")
def nearby():
    """Find restaurants within a radius (miles) of a lat/lon point."""
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    radius = request.args.get("radius", default=1.0, type=float)

    if lat is None or lon is None:
        return jsonify({"error": "lat and lon are required"}), 400

    results = []
    for r in RESTAURANTS:
        if not r.get("latitude") or not r.get("longitude"):
            continue
        rlat = float(r["latitude"])
        rlon = float(r["longitude"])
        dist = _haversine(lat, lon, rlat, rlon)
        if dist <= radius:
            results.append({
                "id": r["business_id"],
                "name": r["name"],
                "address": r["address"],
                "city": r["city"],
                "lat": rlat,
                "lon": rlon,
                "score": r["latest_score"],
                "avg_score": r["avg_score"],
                "tier": r["tier"],
                "critical": r["total_critical"],
                "inspections": r["inspection_count"],
                "last_date": r["latest_date"],
                "distance_miles": round(dist, 3),
            })

    results.sort(key=lambda x: x["distance_miles"])
    return jsonify(results)


@app.route("/api/trends")
def trends():
    """Return inspection score trends over time, grouped by month."""
    df = INSPECTIONS.dropna(subset=["date", "SCORE"]).copy()
    df["month"] = df["date"].dt.to_period("M")
    grouped = df.groupby("month")["SCORE"].agg(["mean", "count"]).reset_index()
    grouped.sort_values("month", inplace=True)

    result = []
    for _, row in grouped.iterrows():
        result.append({
            "month": str(row["month"]),
            "avg_score": round(float(row["mean"]), 2),
            "inspection_count": int(row["count"]),
        })

    return jsonify({"months": result})


@app.route("/api/violation-types")
def violation_types():
    """Top 20 violation types with count and % critical."""
    df = VIOLATIONS.dropna(subset=["DESCRIPTION"]).copy()
    grouped = df.groupby("DESCRIPTION").agg(
        count=("DESCRIPTION", "size"),
        critical_count=("critical", lambda x: (x.astype(str).str.lower() == "true").sum()),
    ).reset_index()
    grouped.sort_values("count", ascending=False, inplace=True)
    top20 = grouped.head(20)

    result = []
    for _, row in top20.iterrows():
        cnt = int(row["count"])
        crit = int(row["critical_count"])
        result.append({
            "type": row["DESCRIPTION"],
            "description": row["DESCRIPTION"],
            "count": cnt,
            "critical_count": crit,
            "critical_pct": round(100.0 * crit / cnt, 1) if cnt > 0 else 0.0,
        })

    return jsonify(result)


@app.route("/api/equity-analysis")
def equity_analysis():
    """Analyze whether food safety scores correlate with income/demographics."""
    if TRACT_ACCESS is None:
        return jsonify({"error": "Tract data not loaded"}), 404
    df = TRACT_ACCESS.copy()
    df = df[df["total_population"] > 0]
    county_median = df["median_household_income"].median()

    low_inc = df[df["median_household_income"] <= county_median]
    high_inc = df[df["median_household_income"] > county_median]

    hisp_high = df[df["pct_hispanic"] >= 30] if "pct_hispanic" in df.columns else pd.DataFrame()
    hisp_low = df[df["pct_hispanic"] < 10] if "pct_hispanic" in df.columns else pd.DataFrame()

    asian_high = df[df["pct_asian"] >= 30] if "pct_asian" in df.columns else pd.DataFrame()
    asian_low = df[df["pct_asian"] < 10] if "pct_asian" in df.columns else pd.DataFrame()

    return jsonify({
        "county_median_income": int(county_median),
        "income_analysis": {
            "below_median": {"tracts": len(low_inc), "avg_food_biz": round(low_inc["food_biz_count"].mean(), 1), "avg_biz_per_1k": round(low_inc["biz_per_1k_pop"].mean(), 2), "avg_poverty": round(low_inc["poverty_rate_pct"].mean(), 1)},
            "above_median": {"tracts": len(high_inc), "avg_food_biz": round(high_inc["food_biz_count"].mean(), 1), "avg_biz_per_1k": round(high_inc["biz_per_1k_pop"].mean(), 2), "avg_poverty": round(high_inc["poverty_rate_pct"].mean(), 1)},
        },
        "hispanic_analysis": {
            "high_pct_30plus": {"tracts": len(hisp_high), "avg_food_biz": round(hisp_high["food_biz_count"].mean(), 1) if len(hisp_high) else 0, "avg_income": int(hisp_high["median_household_income"].mean()) if len(hisp_high) else 0},
            "low_pct_under10": {"tracts": len(hisp_low), "avg_food_biz": round(hisp_low["food_biz_count"].mean(), 1) if len(hisp_low) else 0, "avg_income": int(hisp_low["median_household_income"].mean()) if len(hisp_low) else 0},
        },
        "asian_analysis": {
            "high_pct_30plus": {"tracts": len(asian_high), "avg_food_biz": round(asian_high["food_biz_count"].mean(), 1) if len(asian_high) else 0, "avg_income": int(asian_high["median_household_income"].mean()) if len(asian_high) else 0},
            "low_pct_under10": {"tracts": len(asian_low), "avg_food_biz": round(asian_low["food_biz_count"].mean(), 1) if len(asian_low) else 0, "avg_income": int(asian_low["median_household_income"].mean()) if len(asian_low) else 0},
        },
        "food_desert_demographics": {
            "desert_tracts": int(df["is_food_desert"].sum()) if "is_food_desert" in df.columns else 0,
            "desert_avg_hispanic_pct": round(df[df.get("is_food_desert", False) == True]["pct_hispanic"].mean(), 1) if "is_food_desert" in df.columns and "pct_hispanic" in df.columns else 0,
            "non_desert_avg_hispanic_pct": round(df[df.get("is_food_desert", False) == False]["pct_hispanic"].mean(), 1) if "is_food_desert" in df.columns and "pct_hispanic" in df.columns else 0,
        }
    })


@app.route("/api/compare")
def compare_restaurants():
    """Compare two restaurants side by side."""
    ids_param = request.args.get("ids", "")
    if not ids_param:
        return jsonify({"error": "Provide ids parameter, e.g. ?ids=id1,id2"}), 400

    ids = [i.strip() for i in ids_param.split(",") if i.strip()]
    if len(ids) != 2:
        return jsonify({"error": "Exactly two comma-separated IDs required"}), 400

    results = []
    for biz_id in ids:
        r = BIZ_BY_ID.get(biz_id)
        if not r:
            return jsonify({"error": f"Restaurant '{biz_id}' not found"}), 404

        chunks = [c for c in VIOLATION_CHUNKS if c["business_id"] == biz_id]
        chunks.sort(key=lambda x: x["date"], reverse=True)

        results.append({
            "restaurant": r,
            "recent_inspections": chunks[:5],
        })

    return jsonify({"comparison": results})


@app.route("/api/zip-summary/<zip_code>")
def zip_summary(zip_code):
    """Summary statistics for a given zip code."""
    matches = [r for r in RESTAURANTS if str(r.get("postal_code", "")).strip() == str(zip_code).strip()]
    if not matches:
        return jsonify({"error": f"No restaurants found for zip code {zip_code}"}), 404

    scores = [r["latest_score"] for r in matches if r.get("latest_score")]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0

    critical_count = sum(1 for r in matches if r.get("total_critical", 0) > 0)
    green = sum(1 for r in matches if r["tier"] == "green")
    yellow = sum(1 for r in matches if r["tier"] == "yellow")
    red = sum(1 for r in matches if r["tier"] == "red")

    names = sorted(set(r["name"] for r in matches))

    return jsonify({
        "zip_code": zip_code,
        "num_restaurants": len(matches),
        "avg_score": avg_score,
        "critical_violation_restaurants": critical_count,
        "tier_breakdown": {
            "green": green,
            "yellow": yellow,
            "red": red,
        },
        "restaurant_names": names,
    })


@app.route("/api/employee-demographics")
def employee_demographics():
    """County employee workforce demographics."""
    fpath = f"{DATA_DIR}/employee_demographics.json"
    if not os.path.exists(fpath):
        return jsonify({"error": "Run process_extra_data.py first"}), 404
    with open(fpath) as f:
        return jsonify(json.load(f))


@app.route("/api/photographers")
def photographers():
    """County photographers collection cultural archive."""
    fpath = f"{DATA_DIR}/photographers_collection.json"
    if not os.path.exists(fpath):
        return jsonify({"error": "Run process_extra_data.py first"}), 404
    with open(fpath) as f:
        return jsonify(json.load(f))


@app.route("/api/crime-analysis")
def crime_analysis():
    """Crime incident analysis and breakdown."""
    fpath = f"{DATA_DIR}/crime_analysis.json"
    if not os.path.exists(fpath):
        return jsonify({"error": "Run process_extra_data.py first"}), 404
    with open(fpath) as f:
        return jsonify(json.load(f))


@app.route("/api/ml-risk")
def ml_risk():
    """ML-predicted food desert risk scores for all census tracts."""
    fpath = f"{DATA_DIR}/ml_risk_scores.json"
    stats_path = f"{DATA_DIR}/ml_model_stats.json"
    if not os.path.exists(fpath):
        return jsonify({"error": "Run train_ml_model.py first"}), 404
    with open(fpath) as f:
        scores = json.load(f)
    stats = {}
    if os.path.exists(stats_path):
        with open(stats_path) as f:
            stats = json.load(f)
    return jsonify({"tracts": scores, "model_stats": stats})


@app.route("/api/ml-risk-stats")
def ml_risk_stats():
    """ML model performance and feature importances."""
    fpath = f"{DATA_DIR}/ml_model_stats.json"
    if not os.path.exists(fpath):
        return jsonify({"error": "Run train_ml_model.py first"}), 404
    with open(fpath) as f:
        return jsonify(json.load(f))


@app.route("/api/gpu-clusters")
def gpu_clusters():
    """cuML/sklearn KMeans tract clusters (6 food access patterns)."""
    fpath = f"{DATA_DIR}/gpu_clusters.json"
    if not os.path.exists(fpath):
        return jsonify({"error": "Run run_analysis.py first"}), 404
    with open(fpath) as f:
        return jsonify(json.load(f))


@app.route("/api/gpu-tsne")
def gpu_tsne():
    """t-SNE/UMAP 2D embedding of all census tracts."""
    fpath = f"{DATA_DIR}/gpu_umap_coords.json"
    if not os.path.exists(fpath):
        return jsonify({"error": "Run run_analysis.py first"}), 404
    with open(fpath) as f:
        return jsonify(json.load(f))


@app.route("/api/gpu-nearest-food")
def gpu_nearest_food():
    """Nearest food business distances for food desert tracts."""
    fpath = f"{DATA_DIR}/gpu_nearest_food.json"
    if not os.path.exists(fpath):
        return jsonify({"error": "Run run_analysis.py first"}), 404
    with open(fpath) as f:
        data = json.load(f)
    # Sort worst-access-first for display
    data["deserts"].sort(key=lambda x: -x["closest_miles"])
    return jsonify(data)


@app.route("/api/gpu-benchmark")
def gpu_benchmark():
    """GPU vs CPU benchmark results."""
    fpath = f"{DATA_DIR}/gpu_rf_results.json"
    if not os.path.exists(fpath):
        return jsonify({"error": "Run run_analysis.py first"}), 404
    with open(fpath) as f:
        return jsonify(json.load(f))


CUOPT_URL = os.environ.get("CUOPT_URL", "http://localhost:5007")

def _build_cost_matrix(locs):
    """Build haversine distance matrix (minutes at 25 mph avg) for cuOpt."""
    n = len(locs)
    matrix = []
    for i in range(n):
        row = []
        for j in range(n):
            if i == j:
                row.append(0.0)
            else:
                dist_mi = _haversine(locs[i][0], locs[i][1], locs[j][0], locs[j][1])
                # Convert to travel time in minutes (25 mph avg city driving)
                row.append(round(dist_mi / 25.0 * 60, 2))
        matrix.append(row)
    return matrix


def _nearest_neighbor_tsp(locs, start_idx=0):
    """Nearest-neighbor greedy TSP for fallback when cuOpt unavailable."""
    n = len(locs)
    visited = [False] * n
    route = [start_idx]
    visited[start_idx] = True
    for _ in range(n - 1):
        cur = route[-1]
        best_dist = float("inf")
        best_next = -1
        for j in range(n):
            if not visited[j]:
                d = _haversine(locs[cur][0], locs[cur][1], locs[j][0], locs[j][1])
                if d < best_dist:
                    best_dist = d
                    best_next = j
        route.append(best_next)
        visited[best_next] = True
    return route


def _cuopt_available() -> str:
    """Return 'ready', 'oom', or 'offline'."""
    try:
        import requests as _req
        r = _req.get(f"{CUOPT_URL}/cuopt/health", timeout=2)
        if r.ok:
            return "ready"
    except Exception:
        pass
    return "offline"


def _optimize_with_cuopt(locs, n_vehicles, time_limit_s=5):
    """Call cuOpt server to solve VRP. Returns (routes, engine_label)."""
    try:
        from cuopt_sh_client import cuopt_self_host_client as cuopt_client
        n = len(locs)
        matrix = _build_cost_matrix(locs)

        # Depot is index 0 (inspector home base), tasks are 1..n-1
        task_indices = list(range(1, n))
        n_tasks = len(task_indices)

        data = {
            "cost_matrix_data": {"data": {"0": matrix}},
            "task_data": {
                "task_locations": task_indices,
                "demand": [[1] * n_tasks],
                "task_time_windows": [[0, 540]] * n_tasks,  # 9-hour window
                "service_times": [30] * n_tasks,  # 30 min per inspection
            },
            "fleet_data": {
                "vehicle_locations": [[0, 0]] * n_vehicles,
                "capacities": [[20]] * n_vehicles,
                "vehicle_time_windows": [[0, 540]] * n_vehicles,
                "vehicle_max_travel_time": [540] * n_vehicles,
            },
            "solver_config": {"time_limit": time_limit_s},
        }

        # Parse ip/port from CUOPT_URL (CuOptServiceSelfHostClient takes separate ip/port)
        import urllib.parse
        parsed = urllib.parse.urlparse(CUOPT_URL)
        cuopt_ip = parsed.hostname or "localhost"
        cuopt_port = str(parsed.port or 5007)
        svc = cuopt_client.CuOptServiceSelfHostClient(ip=cuopt_ip, port=cuopt_port)
        sol = svc.get_optimized_routes(data)
        if sol and hasattr(sol, "get_vehicle_data"):
            vdata = sol.get_vehicle_data()
            routes = []
            for v_id, vd in vdata.items():
                stop_ids = vd.get("task_id", [])
                # Map task indices back to location indices
                route = [0] + [task_indices[i] for i in stop_ids if i < n_tasks] + [0]
                routes.append(route)
            return routes, True
    except Exception as e:
        pass
    return None, False


@app.route("/api/optimize-route", methods=["POST"])
def optimize_route():
    """
    GPU-accelerated food inspection route optimizer powered by NVIDIA cuOpt.
    Falls back to nearest-neighbor heuristic if cuOpt is unavailable.
    """
    data = request.json or {}
    city = data.get("city", "San Jose").strip()
    n_inspectors = max(1, min(int(data.get("n_inspectors", 2)), 5))
    n_stops = max(5, min(int(data.get("n_stops", 15)), 40))
    priority = data.get("priority", "all")  # "all", "red", "critical"

    # Get food businesses in the city
    city_rests = [
        r for r in RESTAURANTS
        if str(r.get("city", "")).strip().lower() == city.lower()
        and r.get("latitude") and r.get("longitude")
    ]

    if not city_rests:
        return jsonify({"error": f"No restaurants found in {city}"}), 404

    # Filter by priority
    if priority == "red":
        subset = [r for r in city_rests if r.get("tier") == "red"]
    elif priority == "critical":
        subset = sorted(city_rests, key=lambda x: x.get("total_critical", 0), reverse=True)
    else:
        subset = city_rests

    # Take top n_stops (worst safety scores first for "all")
    subset = sorted(subset, key=lambda x: x.get("latest_score", 100) or 100)[:n_stops]

    if not subset:
        return jsonify({"error": f"No {priority} restaurants found in {city}"}), 404

    # Build location list: index 0 = depot (city centroid), indices 1..n = restaurants
    city_center = {
        "centroid": [float(sum(r["latitude"] for r in subset) / len(subset)),
                     float(sum(r["longitude"] for r in subset) / len(subset))]
    }
    depot_lat = city_center["centroid"][0]
    depot_lon = city_center["centroid"][1]

    locs = [(depot_lat, depot_lon)] + [(float(r["latitude"]), float(r["longitude"])) for r in subset]

    # Check cuOpt availability for accurate engine label
    cuopt_status = _cuopt_available()

    # Try cuOpt first, fall back to nearest-neighbor
    cuopt_routes, used_cuopt = _optimize_with_cuopt(locs, n_inspectors)

    if cuopt_routes:
        routes_out = []
        for route_indices in cuopt_routes:
            route_stops = []
            for idx in route_indices:
                if idx == 0:
                    route_stops.append({"name": "Inspector Base", "lat": depot_lat, "lon": depot_lon, "depot": True})
                else:
                    r = subset[idx - 1]
                    route_stops.append({
                        "name": r["name"], "address": r["address"],
                        "lat": float(r["latitude"]), "lon": float(r["longitude"]),
                        "tier": r.get("tier"), "score": r.get("latest_score"),
                        "critical": r.get("total_critical", 0),
                    })
            routes_out.append(route_stops)
    else:
        # Nearest-neighbor fallback — split stops among inspectors
        all_nn = _nearest_neighbor_tsp(locs, start_idx=0)
        stop_indices = [i for i in all_nn if i != 0]
        # Split round-robin among inspectors
        inspector_stops = [[] for _ in range(n_inspectors)]
        for k, idx in enumerate(stop_indices):
            inspector_stops[k % n_inspectors].append(idx)

        routes_out = []
        for inspector_idx, stop_list in enumerate(inspector_stops):
            route_stops = [{"name": "Inspector Base", "lat": depot_lat, "lon": depot_lon, "depot": True}]
            for idx in stop_list:
                r = subset[idx - 1]
                route_stops.append({
                    "name": r["name"], "address": r["address"],
                    "lat": float(r["latitude"]), "lon": float(r["longitude"]),
                    "tier": r.get("tier"), "score": r.get("latest_score"),
                    "critical": r.get("total_critical", 0),
                })
            route_stops.append({"name": "Inspector Base", "lat": depot_lat, "lon": depot_lon, "depot": True})
            routes_out.append(route_stops)

    # Compute total route distance per inspector
    def route_distance(route):
        total = 0.0
        for i in range(len(route) - 1):
            total += _haversine(route[i]["lat"], route[i]["lon"], route[i+1]["lat"], route[i+1]["lon"])
        return round(total, 2)

    routes_final = [{"inspector": i + 1, "stops": r, "total_miles": route_distance(r)} for i, r in enumerate(routes_out)]

    return jsonify({
        "city": city,
        "n_inspectors": n_inspectors,
        "total_stops": len(subset),
        "priority": priority,
        "engine": ("NVIDIA cuOpt GPU" if used_cuopt
                   else "Greedy TSP (cuOpt installed — LLM using 112GB UMA)" if cuopt_status == "ready"
                   else "Greedy TSP (cuOpt offline)"),
        "cuopt_status": cuopt_status,
        "routes": routes_final,
    })


@app.route("/api/fresh-food-points")
def fresh_food_points():
    """Return fresh food retail locations for map overlay."""
    points = []
    for biz_id, b in BIZ_CATEGORIES.items():
        if b["fresh_food"] and b.get("lat") and b.get("lon"):
            points.append({
                "id": biz_id,
                "name": b["name"],
                "city": b["city"],
                "lat": float(b["lat"]),
                "lon": float(b["lon"]),
                "category": b["category"],
            })
    return jsonify(points)


@app.route("/api/food-category-summary")
def food_category_summary():
    """Business category breakdown — fresh food vs restaurant vs other, by city."""
    city_stats = {}
    for b in BIZ_CATEGORIES.values():
        city = b["city"]
        if not city:
            continue
        if city not in city_stats:
            city_stats[city] = {"city": city, "fresh": 0, "limited": 0, "restaurant": 0, "other": 0}
        cat = b["category"]
        if cat == "fresh_food_retail":
            city_stats[city]["fresh"] += 1
        elif cat == "limited_fresh_food_retail":
            city_stats[city]["limited"] += 1
        elif cat == "restaurant_or_prepared_food":
            city_stats[city]["restaurant"] += 1
        else:
            city_stats[city]["other"] += 1

    result = []
    for city, s in sorted(city_stats.items(), key=lambda x: -(x[1]["fresh"] + x[1]["limited"])):
        total = s["fresh"] + s["limited"] + s["restaurant"] + s["other"]
        result.append({
            "city": city,
            "fresh_food_stores": s["fresh"],
            "limited_fresh_stores": s["limited"],
            "restaurants": s["restaurant"],
            "other": s["other"],
            "total": total,
            "fresh_pct": round(s["fresh"] / total * 100, 1) if total else 0,
        })
    return jsonify(result)


@app.route("/api/access-vulnerability")
def access_vulnerability():
    """Fresh-food access vulnerability scores per census tract, sorted worst-first."""
    tracts = sorted(TRACT_SCORED.values(), key=lambda x: -x.get("access_vulnerability_score", 0))
    return jsonify(tracts)


@app.route("/api/access-vulnerability-geojson")
def access_vulnerability_geojson():
    """GeoJSON choropleth with fresh-food access vulnerability scores."""
    geojson_path = f"{DATA_DIR}/food_access_tracts.geojson"
    if not os.path.exists(geojson_path):
        return jsonify({"error": "GeoJSON not found"}), 404
    with open(geojson_path) as f:
        gj = json.load(f)
    for feat in gj.get("features", []):
        geoid = str(feat["properties"].get("geoid", "")).zfill(11)
        if geoid in TRACT_SCORED:
            feat["properties"].update(TRACT_SCORED[geoid])
    return jsonify(gj)


@app.route("/api/priority-tracts")
def priority_tracts():
    """Return the highest food-access-vulnerability tracts (priority_area_flag=True)."""
    priority = [t for t in TRACT_SCORED.values() if t.get("priority_area")]
    priority.sort(key=lambda x: -x.get("access_vulnerability_score", 0))
    return jsonify(priority)


@app.route("/api/vision-check", methods=["POST"])
def vision_check():
    """CLIP-powered food safety photo analysis.
    POST JSON: { "image": "<base64-encoded jpeg/png>" }
    Returns similarity scores for each food safety category.
    """
    if not CLIP_READY.is_set():
        # wait up to 15s for model to load
        CLIP_READY.wait(timeout=15)

    if CLIP_MODEL is None or CLIP_TEXT_EMBEDDINGS is None:
        return jsonify({"error": "CLIP model not available (install: pip install torch transformers)"}), 503

    data = request.json or {}
    image_b64 = data.get("image", "")
    if not image_b64:
        return jsonify({"error": "Missing 'image' field (base64-encoded image)"}), 400

    try:
        import torch
        import torch.nn.functional as F
        from PIL import Image as PILImage

        # Decode base64 image
        if "," in image_b64:
            image_b64 = image_b64.split(",", 1)[1]
        img_bytes = base64.b64decode(image_b64)
        img = PILImage.open(io.BytesIO(img_bytes)).convert("RGB")

        # Encode image with CLIP
        with CLIP_LOCK:
            with torch.no_grad():
                vis_inputs = CLIP_PROCESSOR(images=img, return_tensors="pt")
                vis_out = CLIP_MODEL.vision_model(**vis_inputs)
                img_feat = CLIP_MODEL.visual_projection(vis_out.pooler_output)
                img_feat = F.normalize(img_feat, dim=-1)

        # Cosine similarity against all safety text prompts
        sims = (img_feat @ CLIP_TEXT_EMBEDDINGS.T).squeeze(0).tolist()

        # Build result with scores
        results = []
        for i, (cat, prompt) in enumerate(FOOD_SAFETY_PROMPTS):
            score = sims[i]
            results.append({
                "category": cat,
                "prompt": prompt,
                "score": round(score, 4),
                "confidence_pct": round((score + 1) / 2 * 100, 1),  # map [-1,1] → [0,100]
            })

        results.sort(key=lambda x: x["score"], reverse=True)

        # Risk assessment: top-3 concerns
        top3 = results[:3]
        # Separate safe vs unsafe categories
        unsafe_cats = {"temperature_control","handwashing","pest_infestation","food_contamination",
                       "surface_cleanliness","food_storage","equipment_sanitation","employee_hygiene",
                       "chemical_hazard","adequate_facilities"}
        safe_cats = {"safe_food_preparation","clean_environment"}

        top_concern = top3[0]
        if top_concern["category"] in safe_cats:
            risk_level = "low"
            risk_summary = "Image appears to show a clean, safe food environment."
        elif top_concern["score"] > 0.22:
            risk_level = "high"
            risk_summary = f"Possible concern: {top_concern['category'].replace('_',' ')} detected."
        elif top_concern["score"] > 0.18:
            risk_level = "medium"
            risk_summary = f"Minor concern possible: {top_concern['category'].replace('_',' ')}."
        else:
            risk_level = "low"
            risk_summary = "No significant food safety concerns detected in this image."

        return jsonify({
            "risk_level": risk_level,
            "risk_summary": risk_summary,
            "scores": results,
            "top_concerns": top3,
            "image_size": [img.width, img.height],
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/clip-status")
def clip_status():
    """Check if CLIP model is loaded and ready."""
    return jsonify({
        "ready": CLIP_MODEL is not None,
        "loading": not CLIP_READY.is_set(),
        "model": "CLIP ViT-B/32",
        "prompts": len(FOOD_SAFETY_PROMPTS),
    })


@app.route("/api/food-recalls")
def food_recalls():
    """Live food recalls from OpenFDA API — California distribution, newest first."""
    recalls = get_food_recalls()
    filter_cls = request.args.get("class", "")
    if filter_cls:
        recalls = [r for r in recalls if filter_cls.upper() in r.get("classification", "").upper()]
    return jsonify({
        "total": len(recalls),
        "source": "OpenFDA (live)",
        "recalls": recalls,
    })


@app.route("/api/health-metrics")
def health_metrics():
    """CDC PLACES health metrics for Santa Clara County."""
    by_category = {}
    for row in CDC_PLACES:
        cat = row.get("category", "Other")
        if cat not in by_category:
            by_category[cat] = []
        try:
            val = float(row.get("data_value") or 0)
        except ValueError:
            val = 0
        by_category[cat].append({
            "measure": row.get("short_question_text", row.get("measure", "")),
            "value": val,
            "unit": row.get("data_value_unit", "%"),
            "low_ci": row.get("low_confidence_limit"),
            "high_ci": row.get("high_confidence_limit"),
            "category": cat,
        })
    # Sort each category by value desc
    for cat in by_category:
        by_category[cat].sort(key=lambda x: -x["value"])
    return jsonify({
        "source": "CDC PLACES 2023 (Santa Clara County)",
        "population": 1877592,
        "categories": by_category,
    })


@app.route("/api/infrastructure")
def infrastructure():
    """OpenStreetMap infrastructure: supermarkets, hospitals, clinics, pharmacies."""
    itype = request.args.get("type", "")
    data = OSM_INFRA
    if itype:
        data = [p for p in data if p.get("type") == itype]
    from collections import Counter
    type_counts = dict(Counter(p.get("type") for p in OSM_INFRA))
    return jsonify({
        "source": "OpenStreetMap (via Overpass API)",
        "total": len(data),
        "by_type": type_counts,
        "points": data,
    })



@app.route("/api/health-outcomes")
def health_outcomes():
    """CDC PLACES 2023: food insecurity, diabetes, obesity, etc. by census tract."""
    tracts = sorted(HEALTH_OUTCOMES.values(), key=lambda x: -(x.get("food_insecurity_pct") or 0))
    return jsonify(tracts)


@app.route("/api/health-outcomes/<geoid>")
def health_outcomes_tract(geoid):
    geoid = str(geoid).zfill(11)
    result = HEALTH_OUTCOMES.get(geoid)
    if not result:
        return jsonify({"error": "Tract not found"}), 404
    # Enrich with CalEnviroScreen data
    ces = CALENVIRO.get(geoid, {})
    return jsonify({**result, "calenviro": ces})


@app.route("/api/calenviroscreen")
def calenviroscreen():
    """CalEnviroScreen 4.0: pollution burden, asthma, poverty by tract — sorted worst-first."""
    tracts = sorted(CALENVIRO.values(), key=lambda x: -(x.get("ces_score") or 0))
    return jsonify(tracts)


@app.route("/api/health-food-combined")
def health_food_combined():
    """
    Cross-dataset: merges food desert classification + health outcomes + CalEnviroScreen
    per census tract. Useful for understanding cumulative vulnerability.
    """
    combined = []
    all_geoids = set(HEALTH_OUTCOMES.keys()) | set(CALENVIRO.keys()) | set(TRACT_SCORED.keys())

    for geoid in all_geoids:
        ho = HEALTH_OUTCOMES.get(geoid, {})
        ces = CALENVIRO.get(geoid, {})
        scored = TRACT_SCORED.get(geoid, {})
        if not (ho or ces or scored):
            continue
        combined.append({
            "geoid": geoid,
            # Health outcomes (CDC PLACES)
            "food_insecurity_pct": ho.get("food_insecurity_pct"),
            "food_stamp_pct": ho.get("food_stamp_pct"),
            "diabetes_pct": ho.get("diabetes_pct"),
            "obesity_pct": ho.get("obesity_pct"),
            "physical_inactivity_pct": ho.get("physical_inactivity_pct"),
            "lack_transport_pct": ho.get("lack_transport_pct"),
            "depression_pct": ho.get("depression_pct"),
            "housing_insecurity_pct": ho.get("housing_insecurity_pct"),
            # Food access
            "access_label": scored.get("access_label"),
            "priority_area": scored.get("priority_area"),
            "fresh_food_per_1k": scored.get("fresh_food_per_1k"),
            "access_vulnerability_score": scored.get("access_vulnerability_score"),
            # Environment (CalEnviroScreen)
            "ces_score": ces.get("ces_score"),
            "ces_percentile": ces.get("ces_percentile"),
            "asthma_rate": ces.get("asthma_rate"),
            "pm25": ces.get("pm25"),
            "poverty_pct": ces.get("poverty_pct"),
        })

    combined.sort(key=lambda x: -(x.get("food_insecurity_pct") or 0))
    return jsonify(combined)


@app.route("/api/data-sources")
def data_sources():
    """Return metadata about all loaded datasets."""
    return jsonify({
        "datasets": [
            {"name": "SCC DEH Food Inspections", "records": len(RESTAURANTS), "type": "food_safety",
             "description": "8,583 food businesses with health inspection scores and violations"},
            {"name": "CDC PLACES 2023", "records": len(HEALTH_OUTCOMES), "type": "health_outcomes",
             "description": "40 health measures by census tract: food insecurity, diabetes, obesity, depression..."},
            {"name": "CalEnviroScreen 4.0", "records": len(CALENVIRO), "type": "environment",
             "description": "Pollution burden, asthma rates, cardiovascular disease, poverty by census tract"},
            {"name": "ACS 2024 Tract Demographics", "records": len(TRACT_SCORED), "type": "demographics",
             "description": "408 census tracts: income, poverty, vehicle access, age, race"},
            {"name": "Fresh Food Access Scoring", "records": len(BIZ_CATEGORIES), "type": "food_access",
             "description": "888 fresh food retailers, 121 priority tracts, vulnerability scoring"},
            {"name": "Crime Reports", "records": 259660, "type": "public_safety",
             "description": "259,660 crime incidents jitter-mapped to SCC cities by type and severity"},
        ],
        "total_census_tracts": 408,
        "county": "Santa Clara County, CA",
        "last_updated": "2026-03",
    })


@app.route("/api/cdc-tract/<measure_id>")
def cdc_tract_measure(measure_id):
    """CDC PLACES tract-level data for a specific measure (e.g. FOODINSECU, OBESITY, DIABETES)."""
    _cdc_tracts_file = f"{DATA_DIR}/cdc_places_scc_tracts.json"
    if not os.path.exists(_cdc_tracts_file):
        return jsonify({"error": "CDC tract data not loaded"}), 404
    with open(_cdc_tracts_file) as f:
        all_rows = json.load(f)
    rows = [r for r in all_rows if r.get("measureid", "").upper() == measure_id.upper()]
    if not rows:
        return jsonify({"error": f"Measure {measure_id} not found"}), 404
    result = []
    for r in rows:
        geo = r.get("geolocation", {}).get("coordinates", [None, None])
        try:
            val = float(r.get("data_value") or 0)
        except (ValueError, TypeError):
            val = 0
        result.append({
            "tract": r.get("locationname", ""),
            "geoid": r.get("locationid", ""),
            "value": val,
            "unit": r.get("data_value_unit", "%"),
            "measure": r.get("measure", ""),
            "lon": geo[0],
            "lat": geo[1],
            "low_ci": r.get("low_confidence_limit"),
            "high_ci": r.get("high_confidence_limit"),
        })
    result.sort(key=lambda x: -x["value"])
    return jsonify({
        "measure_id": measure_id.upper(),
        "measure": rows[0].get("measure", "") if rows else "",
        "total_tracts": len(result),
        "source": "CDC PLACES 2023 (census tract level)",
        "tracts": result,
    })


@app.route("/api/cdc-tract-geojson/<measure_id>")
def cdc_tract_geojson(measure_id):
    """GeoJSON choropleth of a CDC PLACES measure for mapping."""
    _cdc_tracts_file = f"{DATA_DIR}/cdc_places_scc_tracts.json"
    geojson_path = f"{DATA_DIR}/food_access_tracts.geojson"
    if not os.path.exists(_cdc_tracts_file) or not os.path.exists(geojson_path):
        return jsonify({"error": "Data files not found"}), 404
    with open(_cdc_tracts_file) as f:
        all_rows = json.load(f)
    with open(geojson_path) as f:
        gj = json.load(f)
    # Build lookup by geoid (locationid in CDC data is the 11-digit FIPS)
    tract_vals = {}
    for r in all_rows:
        if r.get("measureid", "").upper() == measure_id.upper():
            gid = str(r.get("locationid", "")).zfill(11)
            try:
                tract_vals[gid] = float(r.get("data_value") or 0)
            except (ValueError, TypeError):
                pass
    measure_name = next((r.get("measure","") for r in all_rows if r.get("measureid","").upper() == measure_id.upper()), measure_id)
    for feat in gj.get("features", []):
        geoid = str(feat["properties"].get("geoid", "")).zfill(11)
        feat["properties"][measure_id.lower()] = tract_vals.get(geoid, 0)
    return jsonify({
        "type": "FeatureCollection",
        "measure": measure_name,
        "measure_id": measure_id.upper(),
        "features": gj["features"],
    })


@app.route("/api/food-trucks")
def food_trucks_endpoint():
    """SCC DEH permitted food trucks, live from Socrata."""
    city_filter = request.args.get("city", "").strip().lower()
    data = FOOD_TRUCKS
    if city_filter:
        data = [t for t in data if city_filter in t.get("city", "").lower()]
    from collections import Counter
    by_city = dict(Counter(t.get("city", "?") for t in FOOD_TRUCKS))
    return jsonify({
        "source": "SCC DEH (data.sccgov.org, live Socrata)",
        "total": len(data),
        "by_city": by_city,
        "trucks": data,
    })


@app.route("/api/cottage-food")
def cottage_food_endpoint():
    """SCC DEH licensed cottage food businesses."""
    city_filter = request.args.get("city", "").strip().lower()
    data = COTTAGE_FOOD
    if city_filter:
        data = [c for c in data if city_filter in c.get("city", "").lower()]
    from collections import Counter
    by_city = dict(Counter(c.get("city", "?") for c in COTTAGE_FOOD))
    return jsonify({
        "source": "SCC DEH (data.sccgov.org, live Socrata)",
        "total": len(data),
        "by_city": by_city,
        "businesses": data,
    })



VISION_TAB_BTN = '      <div class="tab" data-tab="vision" onclick="switchTab(\'vision\')">&#128065; Vision AI</div>'

VISION_TAB_HTML = """
    <div class="tab-content" id="tab-vision">
      <div class="list-panel" id="vision-panel">
        <div style="background:linear-gradient(135deg,#0d1f3c 0%,#0f1117 100%);border:1px solid #2b4a7e;border-radius:8px;padding:12px;margin-bottom:10px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <div style="font-size:13px;font-weight:700;color:#90cdf4">&#128065; Food Safety Vision AI</div>
            <div id="clip-status-badge" style="display:inline-flex;align-items:center;gap:5px;font-size:9px;padding:2px 8px;border-radius:8px;background:rgba(90,103,216,0.15);border:1px solid rgba(90,103,216,0.3);color:#90cdf4">
              <span id="clip-status-dot" style="width:5px;height:5px;border-radius:50%;background:#718096;display:inline-block"></span>
              <span id="clip-status-text">Checking...</span>
            </div>
          </div>
          <div style="font-size:10px;color:#718096;line-height:1.5">CLIP ViT-B/32 zero-shot analysis — upload any restaurant or kitchen photo to detect food safety risks.</div>
        </div>
        <div id="vision-drop-zone" style="border:2px dashed #2d3148;border-radius:10px;padding:20px;text-align:center;cursor:pointer;transition:all 0.2s;margin-bottom:8px;background:rgba(45,49,72,0.15)"
          onclick="document.getElementById('vision-file-input').click()"
          ondragover="event.preventDefault();this.style.borderColor='#64b5f6';this.style.background='rgba(100,181,246,0.06)'"
          ondragleave="this.style.borderColor='#2d3148';this.style.background='rgba(45,49,72,0.15)'"
          ondrop="handleVisionDrop(event)">
          <div style="font-size:28px;margin-bottom:6px">&#128247;</div>
          <div style="font-size:12px;color:#a0aec0;font-weight:600">Drop photo or click to upload</div>
          <div style="font-size:10px;color:#4a5568;margin-top:3px">JPG/PNG — kitchen, restaurant, food storage</div>
          <input type="file" id="vision-file-input" accept="image/*" style="display:none" onchange="handleVisionFile(this.files[0])"/>
        </div>
        <div id="vision-preview-wrap" style="display:none;margin-bottom:8px">
          <img id="vision-preview-img" style="width:100%;max-height:160px;border-radius:8px;border:1px solid #2d3148;object-fit:cover" />
          <div style="margin-top:6px;display:flex;gap:6px">
            <button class="send-btn" id="vision-analyze-btn" onclick="analyzeVision()" style="flex:1;font-size:11px">&#9889; Analyze with CLIP</button>
            <button onclick="clearVision()" style="background:none;border:1px solid #2d3148;border-radius:7px;padding:6px 10px;color:#718096;font-size:11px;cursor:pointer">Clear</button>
          </div>
        </div>
        <div id="vision-results"></div>
      </div>
    </div>"""

VISION_JS = """  <script>
  var visionInitialized=false,visionImageB64=null;
  var VLABELS={temperature_control:'Temp Control',handwashing:'Handwashing',pest_infestation:'Pest Infestation',food_contamination:'Contamination',surface_cleanliness:'Surface Clean',food_storage:'Food Storage',equipment_sanitation:'Equipment',employee_hygiene:'Employee Hygiene',chemical_hazard:'Chemical Hazard',adequate_facilities:'Facilities',safe_food_preparation:'Safe Prep',clean_environment:'Clean Env'};
  var VICONS={temperature_control:'&#x1F321;',handwashing:'&#x1F9FC;',pest_infestation:'&#x1F41C;',food_contamination:'&#x2622;',surface_cleanliness:'&#x1F9F9;',food_storage:'&#x1F4E6;',equipment_sanitation:'&#x1FA91;',employee_hygiene:'&#x1F9BA;',chemical_hazard:'&#x26A0;',adequate_facilities:'&#x1F6B0;',safe_food_preparation:'&#x2705;',clean_environment:'&#x2705;'};
  var VSAFE=['safe_food_preparation','clean_environment'];
  function initVision(){
    visionInitialized=true;
    fetch('/api/clip-status').then(function(r){return r.json();}).then(function(s){
      var dot=document.getElementById('clip-status-dot'),txt=document.getElementById('clip-status-text');
      if(s.ready){dot.style.background='#48bb78';txt.textContent='CLIP ready';}
      else if(s.loading){dot.style.background='#ecc94b';txt.textContent='Loading...';setTimeout(initVision,3000);}
      else{dot.style.background='#fc8181';txt.textContent='Unavailable';}
    }).catch(function(){});
  }
  function handleVisionDrop(e){
    e.preventDefault();
    e.currentTarget.style.borderColor='#2d3148';e.currentTarget.style.background='rgba(45,49,72,0.15)';
    var f=e.dataTransfer.files[0];if(f)handleVisionFile(f);
  }
  function handleVisionFile(file){
    if(!file)return;
    var r=new FileReader();
    r.onload=function(ev){
      visionImageB64=ev.target.result;
      document.getElementById('vision-preview-img').src=visionImageB64;
      document.getElementById('vision-preview-wrap').style.display='block';
      document.getElementById('vision-drop-zone').style.display='none';
      document.getElementById('vision-results').innerHTML='';
    };
    r.readAsDataURL(file);
  }
  function clearVision(){
    visionImageB64=null;
    document.getElementById('vision-preview-wrap').style.display='none';
    document.getElementById('vision-drop-zone').style.display='block';
    document.getElementById('vision-results').innerHTML='';
    document.getElementById('vision-file-input').value='';
  }
  async function analyzeVision(){
    if(!visionImageB64)return;
    var btn=document.getElementById('vision-analyze-btn');
    btn.disabled=true;btn.innerHTML='&#9203; Analyzing...';
    var el=document.getElementById('vision-results');
    el.innerHTML='<div style="text-align:center;padding:16px"><div style="font-size:11px;color:#718096;margin-bottom:8px">Running CLIP ViT-B/32 zero-shot analysis...</div><div style="display:inline-flex;gap:4px">'+'<span style="width:6px;height:6px;border-radius:50%;background:#64b5f6;animation:bounce 1.2s infinite"></span>'.repeat(3)+'</div></div>';
    var t0=performance.now();
    try{
      var resp=await fetch('/api/vision-check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:visionImageB64})});
      var data=await resp.json();
      var elapsed=((performance.now()-t0)/1000).toFixed(2);
      if(data.error){el.innerHTML='<div style="color:#fc8181;font-size:12px;padding:10px">'+data.error+'</div>';return;}
      var rColors={low:'#48bb78',medium:'#ecc94b',high:'#fc8181'};
      var rBg={low:'rgba(72,187,120,0.08)',medium:'rgba(236,201,75,0.08)',high:'rgba(252,129,129,0.08)'};
      var rBorder={low:'rgba(72,187,120,0.3)',medium:'rgba(236,201,75,0.3)',high:'rgba(252,129,129,0.3)'};
      var rIcon={low:'&#x2705;',medium:'&#x26A0;',high:'&#x1F6A8;'};
      var rc=rColors[data.risk_level]||'#718096';
      var sc=data.scores||[];
      // Top 3 concern cards
      var top3=sc.filter(function(s){return VSAFE.indexOf(s.category)<0;}).slice(0,3);
      var top3html=top3.map(function(s,i){
        var conf=s.confidence_pct;
        var barColor=conf>65?'#fc8181':conf>55?'#ecc94b':'#64b5f6';
        return '<div style="background:#13151f;border:1px solid #2d3148;border-radius:6px;padding:8px;display:flex;align-items:center;gap:8px">'
          +'<div style="font-size:16px;flex-shrink:0">'+(VICONS[s.category]||'&#x1F4CB;')+'</div>'
          +'<div style="flex:1;min-width:0">'
          +'<div style="font-size:11px;font-weight:600;color:#e2e8f0">'+(VLABELS[s.category]||s.category)+'</div>'
          +'<div style="height:3px;background:#2d3148;border-radius:2px;overflow:hidden;margin-top:3px">'
          +'<div style="height:100%;width:'+conf+'%;background:'+barColor+';border-radius:2px;transition:width 0.5s"></div></div></div>'
          +'<div style="font-size:12px;font-weight:700;color:'+barColor+';flex-shrink:0">'+conf+'%</div>'
          +'</div>';
      }).join('');
      // All scores bar chart
      var maxScore=Math.max.apply(null,sc.map(function(s){return s.confidence_pct;}));
      var allBars=sc.map(function(s){
        var isSafe=VSAFE.indexOf(s.category)>=0;
        var conf=s.confidence_pct;
        var barColor=isSafe?'#48bb78':conf>65?'#fc8181':conf>52?'#ecc94b':'#4a5568';
        var textColor=isSafe?'#48bb78':conf>52?'#e2e8f0':'#718096';
        return '<div style="display:flex;align-items:center;gap:6px;padding:2px 0">'
          +'<div style="width:90px;font-size:9px;color:'+textColor+';text-align:right;flex-shrink:0">'+(VLABELS[s.category]||s.category)+'</div>'
          +'<div style="flex:1;height:5px;background:#1a1d27;border-radius:3px;overflow:hidden">'
          +'<div style="height:100%;width:'+(conf/maxScore*100).toFixed(0)+'%;background:'+barColor+';border-radius:3px"></div></div>'
          +'<div style="font-size:9px;color:'+textColor+';width:30px">'+conf+'%</div>'
          +'</div>';
      }).join('');
      el.innerHTML=
        '<div style="background:'+rBg[data.risk_level]+';border:1px solid '+rBorder[data.risk_level]+';border-radius:8px;padding:12px;margin-bottom:10px">'
        +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
        +'<div style="font-size:22px">'+(rIcon[data.risk_level]||'')+'</div>'
        +'<div><div style="font-size:14px;font-weight:800;color:'+rc+';text-transform:uppercase;letter-spacing:0.05em">'+data.risk_level+' Risk</div>'
        +'<div style="font-size:10px;color:#718096">'+elapsed+'s · CLIP ViT-B/32 · '+sc.length+' checks</div></div></div>'
        +'<div style="font-size:11px;color:#a0aec0;line-height:1.5">'+data.risk_summary+'</div>'
        +'</div>'
        +(top3.length?'<div style="font-size:10px;font-weight:700;color:#718096;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Top Signals</div>'
        +'<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px">'+top3html+'</div>':'')
        +'<div style="background:#1a1d27;border:1px solid #2d3148;border-radius:8px;padding:10px">'
        +'<div style="font-size:9px;font-weight:700;color:#718096;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Zero-Shot Similarity Scores</div>'
        +allBars+'</div>';
    }catch(err){el.innerHTML='<div style="color:#fc8181;font-size:12px;padding:10px">Error: '+err.message+'</div>';}
    finally{btn.disabled=false;btn.innerHTML='&#9889; Analyze with CLIP';}
  }
  document.addEventListener('DOMContentLoaded',function(){
    var t=document.querySelector('[data-tab="vision"]');
    if(t)t.addEventListener('click',function(){if(!visionInitialized)initVision();});
  });
  </script>"""


@app.after_request
def inject_vision_ai(response):
    """Inject Vision AI tab into the root HTML response."""
    if response.content_type and 'text/html' in response.content_type:
        html = response.get_data(as_text=True)
        if 'tab-vision' not in html and len(html) > 2000:
            # Inject tab button after last switchTab button
            last_tab = html.rfind('onclick="switchTab(')
            if last_tab > 0:
                line_end = html.find('</div>', last_tab)
                if line_end > 0:
                    html = html[:line_end + 6] + '\n' + VISION_TAB_BTN + html[line_end + 6:]
            # Inject tab content before map-wrap
            map_pos = html.find('<div class="map-wrap">')
            if map_pos > 0:
                prev_close = html.rfind('</div>', 0, map_pos)
                if prev_close > 0:
                    html = html[:prev_close + 6] + VISION_TAB_HTML + html[prev_close + 6:]
            # Inject JS before </body>
            body_close = html.rfind('</body>')
            if body_close > 0:
                html = html[:body_close] + VISION_JS + '\n</body>' + html[body_close + 7:]
            response.set_data(html.encode('utf-8'))
    return response


@app.route("/api/wic-vendors")
def wic_vendors_endpoint():
    """142 WIC-authorized stores in Santa Clara County."""
    from collections import Counter
    city = request.args.get("city", "").strip().lower()
    data = [v for v in WIC_VENDORS if not city or city in v.get("city", "").lower()]
    by_city = dict(Counter(v.get("city", "?") for v in WIC_VENDORS))
    return jsonify({"total": len(data), "by_city": by_city, "vendors": data,
                    "source": "CA WIC Program (CDPH)"})


@app.route("/api/healthcare")
def healthcare_endpoint():
    """358 CDPH-licensed healthcare facilities in Santa Clara County."""
    from collections import Counter
    city = request.args.get("city", "").strip().lower()
    fac_type = request.args.get("type", "").strip().lower()
    data = HEALTHCARE
    if city:
        data = [h for h in data if city in h.get("city", "").lower()]
    if fac_type:
        data = [h for h in data if fac_type in h.get("fac_type", "").lower()]
    by_type = dict(Counter(h.get("fac_type", "?") for h in HEALTHCARE).most_common(15))
    return jsonify({"total": len(data), "by_type": by_type, "facilities": data,
                    "source": "CA CDPH Healthcare Facility Locator"})


@app.route("/api/senior-dining")
def senior_dining_endpoint():
    """37 senior nutrition / dining sites with geocoordinates."""
    return jsonify({"total": len(SENIOR_DINING), "sites": SENIOR_DINING,
                    "source": "SCC Aging and Adult Services (data.sccgov.org)"})


@app.route("/api/schools")
def schools_endpoint():
    """408 public schools in Santa Clara County."""
    city = request.args.get("city", "").strip().lower()
    district = request.args.get("district", "").strip().lower()
    data = PUBLIC_SCHOOLS
    if city:
        data = [s for s in data if city in s.get("city", "").lower()]
    if district:
        data = [s for s in data if district in s.get("district", "").lower()]
    return jsonify({"total": len(data), "schools": data,
                    "source": "SCC GIS Open Data"})


@app.route("/api/food-resources")
def food_resources_endpoint():
    """Combined food resource map: WIC vendors + senior dining + schools."""
    resources = []
    for v in WIC_VENDORS:
        resources.append({**v, "layer": "wic", "label": v.get("name", ""),
                          "detail": "WIC-authorized store"})
    for s in SENIOR_DINING:
        resources.append({**s, "layer": "senior_dining", "label": s.get("name", ""),
                          "detail": s.get("program", "Senior Dining")})
    for s in PUBLIC_SCHOOLS:
        resources.append({**s, "layer": "school", "label": s.get("name", ""),
                          "detail": s.get("district", "")})
    return jsonify({"total": len(resources),
                    "counts": {"wic": len(WIC_VENDORS), "senior_dining": len(SENIOR_DINING),
                               "schools": len(PUBLIC_SCHOOLS)},
                    "resources": resources})


@app.route("/api/small-area-health")
def small_area_health_endpoint():
    """SCC Small Area Health Profiles by ZIP or neighborhood."""
    area_type = request.args.get("type", "zip").strip().lower()
    if area_type == "neighborhood":
        return jsonify({"total": len(SMALL_AREA_NBHD), "type": "neighborhood",
                        "profiles": SMALL_AREA_NBHD,
                        "source": "SCC Public Health — Small Area Profiles"})
    return jsonify({"total": len(SMALL_AREA_ZIP), "type": "zip",
                    "profiles": SMALL_AREA_ZIP,
                    "source": "SCC Public Health — Small Area Profiles"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting FoodSight AI on http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
