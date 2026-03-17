#!/usr/bin/env python3
"""
SafeEats SCC - Data Processing Pipeline
Joins food business, inspection, and violation data from Santa Clara County.
Outputs:
  data/restaurants.json   - per-restaurant summary for map/API
  data/violations_text.jsonl - text chunks for RAG
"""

import pandas as pd
import json
import re
import os

DATA_DIR = "/home/nvidia/data"
OUT_DIR = "/home/nvidia/safeeats/data"
os.makedirs(OUT_DIR, exist_ok=True)

print("Loading CSVs...")
biz = pd.read_csv(f"{DATA_DIR}/SCC_DEH_Food_Data_BUSINESS_20260306.csv")
insp = pd.read_csv(f"{DATA_DIR}/SCC_DEH_Food_Data_INSPECTIONS_20260306.csv")
viol = pd.read_csv(f"{DATA_DIR}/SCC_DEH_Food_Data_VIOLATIONS_20260306.csv")

print(f"  Businesses:  {len(biz):,}")
print(f"  Inspections: {len(insp):,}")
print(f"  Violations:  {len(viol):,}")

# --- Clean inspections ---
insp["date"] = pd.to_datetime(insp["date"], format="%Y%m%d", errors="coerce")
insp["SCORE"] = pd.to_numeric(insp["SCORE"], errors="coerce")

# Latest inspection per business
latest = (
    insp.sort_values("date", ascending=False)
    .groupby("business_id")
    .first()
    .reset_index()[["business_id", "date", "SCORE", "result", "inspection_id"]]
)
latest.columns = ["business_id", "latest_date", "latest_score", "latest_result", "latest_insp_id"]

# Average score per business
avg_score = insp.groupby("business_id")["SCORE"].mean().reset_index()
avg_score.columns = ["business_id", "avg_score"]

# Inspection count
insp_count = insp.groupby("business_id").size().reset_index(name="inspection_count")

# --- Clean violations ---
viol["critical"] = viol["critical"].astype(str).str.lower() == "true"
crit_count = viol.groupby("inspection_id")["critical"].sum().reset_index(name="critical_violations")
total_viol = viol.groupby("inspection_id").size().reset_index(name="total_violations")

# Join violation counts to inspections
insp2 = insp.merge(crit_count, on="inspection_id", how="left")
insp2 = insp2.merge(total_viol, on="inspection_id", how="left")
insp2["critical_violations"] = insp2["critical_violations"].fillna(0).astype(int)
insp2["total_violations"] = insp2["total_violations"].fillna(0).astype(int)

# Total critical violations per business
biz_crit = insp2.groupby("business_id")["critical_violations"].sum().reset_index(name="total_critical")
biz_total_viol = insp2.groupby("business_id")["total_violations"].sum().reset_index(name="total_violations")

# --- Merge everything ---
df = biz.merge(latest, on="business_id", how="left")
df = df.merge(avg_score, on="business_id", how="left")
df = df.merge(insp_count, on="business_id", how="left")
df = df.merge(biz_crit, on="business_id", how="left")
df = df.merge(biz_total_viol, on="business_id", how="left")

df["latest_date"] = df["latest_date"].astype(str)
df["avg_score"] = df["avg_score"].round(1)
df["inspection_count"] = df["inspection_count"].fillna(0).astype(int)
df["total_critical"] = df["total_critical"].fillna(0).astype(int)
df["total_violations"] = df["total_violations"].fillna(0).astype(int)
df["latest_score"] = df["latest_score"].fillna(0).astype(int)

# Safety tier based on latest score
def safety_tier(score):
    if score >= 90:
        return "green"
    elif score >= 75:
        return "yellow"
    elif score > 0:
        return "red"
    return "gray"

df["tier"] = df["latest_score"].apply(safety_tier)

# Drop rows without lat/lon
df = df.dropna(subset=["latitude", "longitude"])

print(f"\nRestaurants with location data: {len(df):,}")

# --- Output restaurants.json ---
records = df[[
    "business_id", "name", "address", "CITY", "postal_code",
    "latitude", "longitude", "phone_number",
    "latest_date", "latest_score", "latest_result", "avg_score",
    "inspection_count", "total_critical", "total_violations", "tier"
]].rename(columns={"CITY": "city"}).to_dict(orient="records")

with open(f"{OUT_DIR}/restaurants.json", "w") as f:
    json.dump(records, f)
print(f"Wrote {OUT_DIR}/restaurants.json ({len(records):,} restaurants)")

# --- Output violations_text.jsonl for RAG ---
# Build per-business inspection+violation text chunks
print("\nBuilding RAG chunks...")

# Get all inspections with violation text
viol_with_insp = viol.merge(
    insp[["inspection_id", "business_id", "date", "SCORE", "type"]],
    on="inspection_id", how="left"
)
viol_with_insp = viol_with_insp.merge(
    biz[["business_id", "name", "address", "CITY"]],
    on="business_id", how="left"
)
viol_with_insp["date"] = pd.to_datetime(viol_with_insp["date"], format="%Y%m%d", errors="coerce")

chunks = []
grouped = viol_with_insp.groupby(["business_id", "inspection_id"])

for (biz_id, insp_id), group in grouped:
    row = group.iloc[0]
    biz_name = str(row.get("name", "Unknown"))
    address = str(row.get("address", ""))
    city = str(row.get("CITY", ""))
    date_str = str(row.get("date", ""))[:10]
    score = row.get("SCORE", "N/A")
    insp_type = str(row.get("type", ""))

    viols = []
    for _, v in group.iterrows():
        flag = "[CRITICAL] " if v.get("critical") == True else ""
        desc = str(v.get("DESCRIPTION", ""))
        comment = str(v.get("violation_comment", ""))
        viols.append(f"{flag}{desc}: {comment}")

    text = (
        f"Restaurant: {biz_name}\n"
        f"Location: {address}, {city}\n"
        f"Inspection date: {date_str} | Score: {score} | Type: {insp_type}\n"
        f"Violations ({len(viols)}):\n" +
        "\n".join(f"  - {v}" for v in viols)
    )

    chunks.append({
        "business_id": biz_id,
        "inspection_id": insp_id,
        "name": biz_name,
        "city": city,
        "score": score,
        "date": date_str,
        "text": text
    })

with open(f"{OUT_DIR}/violations_text.jsonl", "w") as f:
    for chunk in chunks:
        f.write(json.dumps(chunk) + "\n")

print(f"Wrote {OUT_DIR}/violations_text.jsonl ({len(chunks):,} inspection chunks)")

# --- Build a business name index for fast lookup ---
name_index = {}
for r in records:
    key = str(r["name"]).lower().strip()
    if key not in name_index:
        name_index[key] = []
    name_index[key].append(r["business_id"])

with open(f"{OUT_DIR}/name_index.json", "w") as f:
    json.dump(name_index, f)
print(f"Wrote name_index.json ({len(name_index):,} unique names)")

print("\nDone!")
