#!/usr/bin/env python3
"""
SafeEats SCC — Food Access Pipeline

Combines:
  - SCC_DEH_Food_Data_BUSINESS (8,588 food businesses with lat/lon)
  - Santa_Clara_County_ACS_2024_tract_demographics (408 census tracts)
  - Santa_Clara_County_ACS_2024_block_group_demographics (1,173 block groups)
  - Census TIGER tract shapefiles (for spatial join)

Outputs:
  data/food_access_tracts.csv       — per-tract demographics + food access metrics + food desert flag
  data/food_access_tracts.geojson   — same with geometry for mapping
  data/businesses_with_tract.csv    — each business tagged with its census tract
  data/food_desert_summary.json     — summary stats for the app
  data/block_group_demographics.csv — cleaned block group data

Food desert definition (USDA ERS-inspired, adapted to SCC data):
  A tract is a FOOD DESERT if BOTH:
    1. LOW-INCOME: poverty_rate >= 20% OR median_household_income <= 80% of county median
    2. LOW-ACCESS: fewer than 3 food businesses per 1,000 residents

  Severity upgrades to SEVERE if ANY additional:
    - households_no_vehicle_pct >= 10%
    - age 65+ share >= 15% AND low access
    - zero food businesses in the tract entirely
"""

import pandas as pd
import geopandas as gpd
import numpy as np
import json
import os
from shapely.geometry import Point

DATA_DIR = "/home/nvidia/data"
OUT_DIR = "/home/nvidia/safeeats/data"
TIGER_ZIP = "/tmp/ca_tracts.zip"
SCC_COUNTY_FIPS = "085"
os.makedirs(OUT_DIR, exist_ok=True)

# Thresholds
LOW_ACCESS_BIZ_PER_1K = 3.0    # fewer than 3 food businesses per 1,000 people
POVERTY_THRESHOLD = 20.0        # poverty rate >= 20%
INCOME_RATIO = 0.80             # income <= 80% of county median
NO_VEHICLE_SEVERE = 10.0        # >= 10% households without a vehicle
ELDERLY_SEVERE = 15.0           # >= 15% population age 65+

# ═══════════════════════════════════════════════════════════════════════
# STEP 1: Load and clean food business data
# ═══════════════════════════════════════════════════════════════════════
print("=" * 60)
print("STEP 1: Load and clean food business data")
print("=" * 60)

biz = pd.read_csv(f"{DATA_DIR}/SCC_DEH_Food_Data_BUSINESS_20260306.csv")
print(f"  Raw businesses: {len(biz):,}")

# Drop columns not needed for food access analysis
biz = biz.drop(columns=["STATE", "Geo_Address", "phone_number"], errors="ignore")
biz.columns = ["business_id", "name", "address", "city", "postal_code", "lat", "lon"]

# Drop rows without valid coordinates
biz = biz.dropna(subset=["lat", "lon"])
biz = biz[biz["lat"].between(36.8, 37.6) & biz["lon"].between(-122.4, -121.2)]
biz["city"] = biz["city"].str.strip().str.title()
print(f"  With valid coordinates: {len(biz):,}")

# Convert to GeoDataFrame
biz_gdf = gpd.GeoDataFrame(
    biz, geometry=gpd.points_from_xy(biz.lon, biz.lat), crs="EPSG:4326"
)

# ═══════════════════════════════════════════════════════════════════════
# STEP 2: Load Census TIGER tract boundaries
# ═══════════════════════════════════════════════════════════════════════
print(f"\n{'=' * 60}")
print("STEP 2: Load Census TIGER tract boundaries")
print("=" * 60)

tracts_shp = gpd.read_file(f"zip://{TIGER_ZIP}")
tracts_shp = tracts_shp[tracts_shp["COUNTYFP"] == SCC_COUNTY_FIPS].copy()
print(f"  Santa Clara County tracts in shapefile: {len(tracts_shp):,}")

# Build 11-digit geoid string
tracts_shp["geoid"] = tracts_shp["STATEFP"] + tracts_shp["COUNTYFP"] + tracts_shp["TRACTCE"]

# Compute tract centroids and area
tracts_proj = tracts_shp.to_crs("EPSG:3857")
tracts_shp["centroid_lat"] = tracts_shp.geometry.centroid.y
tracts_shp["centroid_lon"] = tracts_shp.geometry.centroid.x
tracts_shp["area_sq_mi"] = (tracts_proj.geometry.area / 2.59e6).round(3)

# ═══════════════════════════════════════════════════════════════════════
# STEP 3: Load and clean ACS 2024 demographics
# ═══════════════════════════════════════════════════════════════════════
print(f"\n{'=' * 60}")
print("STEP 3: Load and clean ACS 2024 tract demographics")
print("=" * 60)

demos = pd.read_csv(f"{DATA_DIR}/Santa_Clara_County_ACS_2024_tract_demographics.csv")
print(f"  Raw: {len(demos):,} tracts, {len(demos.columns)} columns")

# Drop redundant geographic columns (encoded in geoid already)
demos = demos.drop(columns=["name", "state", "county", "tract"], errors="ignore")

# Normalize geoid to 11-char string to match shapefile
demos["geoid"] = demos["geoid"].astype(str).str.zfill(11)

# Compute percentages
demos["pct_under_18"] = (demos["under_18_population"] / demos["total_population"] * 100).round(1)
demos["pct_65_plus"] = (demos["age_65_plus_population"] / demos["total_population"] * 100).round(1)
demos["pct_white"] = (demos["white_alone_population"] / demos["total_population"] * 100).round(1)
demos["pct_black"] = (demos["black_alone_population"] / demos["total_population"] * 100).round(1)
demos["pct_asian"] = (demos["asian_alone_population"] / demos["total_population"] * 100).round(1)
demos["pct_hispanic"] = (demos["hispanic_or_latino_population"] / demos["total_population"] * 100).round(1)

# County-level baseline
county_median_income = demos["median_household_income"].median()
print(f"  County median household income: ${county_median_income:,.0f}")
print(f"  80% threshold: ${county_median_income * INCOME_RATIO:,.0f}")

# ═══════════════════════════════════════════════════════════════════════
# STEP 4: Spatial join — assign each business to a census tract
# ═══════════════════════════════════════════════════════════════════════
print(f"\n{'=' * 60}")
print("STEP 4: Spatial join — businesses into census tracts")
print("=" * 60)

biz_gdf = biz_gdf.to_crs(tracts_shp.crs)
biz_joined = gpd.sjoin(
    biz_gdf,
    tracts_shp[["geoid", "geometry", "centroid_lat", "centroid_lon", "area_sq_mi"]],
    how="left", predicate="within",
)
matched = biz_joined["geoid"].notna().sum()
print(f"  Businesses matched to a tract: {matched:,} / {len(biz_gdf):,}")

# Save businesses with tract assignment
biz_out = biz_joined.drop(columns=["geometry", "index_right"], errors="ignore")
biz_out.to_csv(f"{OUT_DIR}/businesses_with_tract.csv", index=False)
print(f"  Wrote businesses_with_tract.csv")

# ═══════════════════════════════════════════════════════════════════════
# STEP 5: Compute food access metrics per tract
# ═══════════════════════════════════════════════════════════════════════
print(f"\n{'=' * 60}")
print("STEP 5: Aggregate food access metrics per tract")
print("=" * 60)

biz_counts = biz_joined.groupby("geoid").agg(
    food_biz_count=("business_id", "count"),
    unique_biz_names=("name", "nunique"),
).reset_index()

# Merge: tract geometry + demographics + business counts
merged = tracts_shp[["geoid", "geometry", "centroid_lat", "centroid_lon", "area_sq_mi"]].merge(
    demos, on="geoid", how="left"
)
merged = merged.merge(biz_counts, on="geoid", how="left")

# Fill tracts with no businesses
merged["food_biz_count"] = merged["food_biz_count"].fillna(0).astype(int)
merged["unique_biz_names"] = merged["unique_biz_names"].fillna(0).astype(int)

# Key metric: businesses per 1,000 residents
merged["biz_per_1k_pop"] = np.where(
    merged["total_population"] > 0,
    (merged["food_biz_count"] / merged["total_population"] * 1000).round(2),
    0.0,
)

# Density: businesses per square mile
merged["biz_per_sq_mi"] = np.where(
    merged["area_sq_mi"] > 0,
    (merged["food_biz_count"] / merged["area_sq_mi"]).round(2),
    0.0,
)

print(f"  Tracts with 0 food businesses: {(merged['food_biz_count'] == 0).sum()}")
print(f"  Median biz per tract: {merged['food_biz_count'].median():.0f}")
print(f"  Median biz per 1k pop: {merged['biz_per_1k_pop'].median():.2f}")
print(f"  Median biz per sq mi: {merged['biz_per_sq_mi'].median():.1f}")

# ═══════════════════════════════════════════════════════════════════════
# STEP 6: Classify food deserts (USDA-inspired)
# ═══════════════════════════════════════════════════════════════════════
print(f"\n{'=' * 60}")
print("STEP 6: Classify food deserts")
print("=" * 60)

# Condition 1: LOW INCOME
merged["is_low_income"] = (
    (merged["poverty_rate_pct"] >= POVERTY_THRESHOLD) |
    (merged["median_household_income"] <= INCOME_RATIO * county_median_income)
)

# Condition 2: LOW ACCESS
merged["is_low_access"] = merged["biz_per_1k_pop"] < LOW_ACCESS_BIZ_PER_1K

# FOOD DESERT = both conditions
merged["is_food_desert"] = merged["is_low_income"] & merged["is_low_access"]

# SEVERE FOOD DESERT = food desert + additional vulnerability
merged["is_severe"] = merged["is_food_desert"] & (
    (merged["households_no_vehicle_pct"] >= NO_VEHICLE_SEVERE) |
    (merged["pct_65_plus"] >= ELDERLY_SEVERE) |
    (merged["food_biz_count"] == 0)
)

# Classification label
def classify(row):
    if pd.isna(row.get("total_population")) or row["total_population"] == 0:
        return "no_population"
    if row["is_severe"]:
        return "severe_food_desert"
    if row["is_food_desert"]:
        return "food_desert"
    if row["is_low_access"]:
        return "low_access_only"
    if row["is_low_income"]:
        return "low_income_only"
    return "adequate"

merged["classification"] = merged.apply(classify, axis=1)

# Print summary
print(f"\n  {'Classification':<25s}  {'Tracts':>6s}  {'Pct':>5s}  {'Population':>12s}")
print(f"  {'-'*25}  {'-'*6}  {'-'*5}  {'-'*12}")
for label in ["severe_food_desert", "food_desert", "low_access_only", "low_income_only", "adequate", "no_population"]:
    mask = merged["classification"] == label
    count = mask.sum()
    pct = count / len(merged) * 100
    pop = merged.loc[mask, "total_population"].sum()
    print(f"  {label:<25s}  {count:>6d}  {pct:>4.1f}%  {pop:>12,}")

total_desert_pop = merged.loc[merged["is_food_desert"], "total_population"].sum()
total_pop = merged["total_population"].sum()
print(f"\n  Population in food deserts: {total_desert_pop:,} / {total_pop:,} ({total_desert_pop/total_pop*100:.1f}%)")
print(f"  Low-income tracts: {merged['is_low_income'].sum()}")
print(f"  Low-access tracts: {merged['is_low_access'].sum()}")

# ═══════════════════════════════════════════════════════════════════════
# STEP 7: Write output files
# ═══════════════════════════════════════════════════════════════════════
print(f"\n{'=' * 60}")
print("STEP 7: Write output files")
print("=" * 60)

# CSV (no geometry)
csv_cols = [
    "geoid", "centroid_lat", "centroid_lon", "area_sq_mi",
    "total_population", "under_18_population", "age_65_plus_population",
    "pct_under_18", "pct_65_plus",
    "white_alone_population", "black_alone_population", "asian_alone_population",
    "hispanic_or_latino_population",
    "pct_white", "pct_black", "pct_asian", "pct_hispanic",
    "median_household_income", "households_total",
    "households_no_vehicle", "households_no_vehicle_pct", "poverty_rate_pct",
    "is_low_income",
    "food_biz_count", "unique_biz_names", "biz_per_1k_pop", "biz_per_sq_mi",
    "is_low_access", "is_food_desert", "is_severe", "classification",
]
merged[csv_cols].to_csv(f"{OUT_DIR}/food_access_tracts.csv", index=False)
print(f"  food_access_tracts.csv — {len(merged)} tracts, {len(csv_cols)} columns")

# GeoJSON for map
geo_out = merged[csv_cols + ["geometry"]].copy()
geo_out = gpd.GeoDataFrame(geo_out, geometry="geometry", crs=tracts_shp.crs)
geo_out.to_file(f"{OUT_DIR}/food_access_tracts.geojson", driver="GeoJSON")
print(f"  food_access_tracts.geojson — with tract polygons for choropleth")

# Summary JSON
summary = {
    "county_median_income": int(county_median_income),
    "low_income_threshold": int(county_median_income * INCOME_RATIO),
    "total_tracts": int(len(merged)),
    "total_population": int(total_pop),
    "food_desert_tracts": int(merged["is_food_desert"].sum()),
    "severe_food_desert_tracts": int(merged["is_severe"].sum()),
    "food_desert_population": int(total_desert_pop),
    "food_desert_population_pct": round(total_desert_pop / total_pop * 100, 1),
    "low_access_tracts": int(merged["is_low_access"].sum()),
    "low_income_tracts": int(merged["is_low_income"].sum()),
    "zero_business_tracts": int((merged["food_biz_count"] == 0).sum()),
    "classification_counts": {k: int(v) for k, v in merged["classification"].value_counts().items()},
    "thresholds_used": {
        "low_income_poverty_rate_pct": POVERTY_THRESHOLD,
        "low_income_median_income_pct_of_county": INCOME_RATIO * 100,
        "low_access_biz_per_1k_pop": LOW_ACCESS_BIZ_PER_1K,
        "severe_no_vehicle_pct": NO_VEHICLE_SEVERE,
        "severe_elderly_pct": ELDERLY_SEVERE,
    },
}
with open(f"{OUT_DIR}/food_desert_summary.json", "w") as f:
    json.dump(summary, f, indent=2)
print(f"  food_desert_summary.json")

# Block group data (cleaned)
bg = pd.read_csv(f"{DATA_DIR}/Santa_Clara_County_ACS_2024_block_group_demographics.csv")
bg = bg.drop(columns=["name", "state", "county"], errors="ignore")
bg.to_csv(f"{OUT_DIR}/block_group_demographics.csv", index=False)
print(f"  block_group_demographics.csv — {len(bg)} block groups")

# ═══════════════════════════════════════════════════════════════════════
# Show the worst food deserts
# ═══════════════════════════════════════════════════════════════════════
print(f"\n{'=' * 60}")
print("TOP FOOD DESERT TRACTS (by severity)")
print("=" * 60)

show_cols = ["geoid", "total_population", "median_household_income",
             "poverty_rate_pct", "households_no_vehicle_pct",
             "food_biz_count", "biz_per_1k_pop", "classification"]
deserts = merged[merged["is_food_desert"]].sort_values(
    ["is_severe", "biz_per_1k_pop"], ascending=[False, True]
)
print(deserts[show_cols].head(15).to_string(index=False))

print(f"\n{'=' * 60}")
print("DONE")
print("=" * 60)
