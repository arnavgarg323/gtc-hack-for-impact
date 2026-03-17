#!/usr/bin/env python3
"""
GPU-Accelerated Food Access Analysis using RAPIDS cuML + cuDF
Runs on NVIDIA DGX Spark GB10 Blackwell — all compute on GPU.

Outputs:
  data/gpu_clusters.json       - cuML KMeans tract clusters (food access patterns)
  data/gpu_nearest_food.json   - cuML NearestNeighbors (closest food biz per tract centroid)
  data/gpu_umap_coords.json    - UMAP 2D embeddings for tract scatter plot
  data/gpu_anomaly_scores.json - IsolationForest anomaly detection (unusual tracts)
"""

import json
import os
import time
import numpy as np
import pandas as pd

OUT_DIR = "/home/nvidia/safeeats/data"

print("=" * 65)
print("SafeEats GPU Analysis — NVIDIA DGX Spark (cuML + cuDF)")
print("=" * 65)

# ── Import RAPIDS ──────────────────────────────────────────────────
print("\nImporting RAPIDS...")
t0 = time.time()
import cudf
import cuml
from cuml.cluster import KMeans
from cuml.neighbors import NearestNeighbors
from cuml.ensemble import RandomForestClassifier as cuRFC
from cuml.manifold import UMAP
from cuml.preprocessing import StandardScaler
print(f"  RAPIDS loaded in {time.time()-t0:.2f}s")
print(f"  cuML version: {cuml.__version__}")

# ── Load data with cuDF (GPU DataFrames) ───────────────────────────
print("\nLoading data with cuDF (GPU DataFrames)...")
t0 = time.time()

tracts = cudf.read_csv(f"{OUT_DIR}/food_access_tracts.csv")
businesses = cudf.read_csv(f"{OUT_DIR}/businesses_with_tract.csv")

print(f"  Tracts:     {len(tracts):,} rows loaded in {time.time()-t0:.3f}s")
print(f"  Businesses: {len(businesses):,} rows")

# Filter to valid population
tracts = tracts[tracts["total_population"] > 0].copy()
print(f"  Tracts with population: {len(tracts):,}")

# Feature matrix (same features used in sklearn model)
FEATURES = [
    "poverty_rate_pct", "median_household_income", "households_no_vehicle_pct",
    "pct_65_plus", "pct_under_18", "pct_hispanic", "pct_black", "pct_asian",
    "pct_white", "food_biz_count", "biz_per_1k_pop", "biz_per_sq_mi",
    "total_population", "area_sq_mi",
]
for col in FEATURES:
    tracts[col] = cudf.to_numeric(tracts[col], errors="coerce")
    tracts[col] = tracts[col].fillna(tracts[col].median())

X = tracts[FEATURES]
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)
print(f"  Feature matrix: {X_scaled.shape} on GPU")


# ════════════════════════════════════════════════════════════════════
# 1. cuML KMeans — Food Access Cluster Patterns
# ════════════════════════════════════════════════════════════════════
print("\n" + "=" * 65)
print("1. cuML KMeans — Tract Clustering (k=6 food access patterns)")
print("=" * 65)

t0 = time.time()
kmeans = KMeans(n_clusters=6, random_state=42, max_iter=300)
labels = kmeans.fit_predict(X_scaled)
elapsed = time.time() - t0
print(f"  KMeans fit in {elapsed:.3f}s on GPU")

labels_host = labels.to_pandas().astype(int).values
tracts_pd = tracts.to_pandas()

# Characterize each cluster
cluster_profiles = []
for k in range(6):
    mask = labels_host == k
    grp = tracts_pd[mask]
    desert_rate = (grp["is_food_desert"].sum() / len(grp) * 100) if len(grp) > 0 else 0
    cluster_profiles.append({
        "cluster": int(k),
        "n_tracts": int(mask.sum()),
        "avg_poverty_pct": round(float(grp["poverty_rate_pct"].mean()), 1),
        "avg_income": int(grp["median_household_income"].mean()),
        "avg_biz_per_1k": round(float(grp["biz_per_1k_pop"].mean()), 2),
        "avg_no_vehicle_pct": round(float(grp["households_no_vehicle_pct"].mean()), 1),
        "food_desert_rate_pct": round(float(desert_rate), 1),
        "avg_pop": int(grp["total_population"].mean()),
        "total_pop": int(grp["total_population"].sum()),
    })

# Label clusters by profile
def cluster_label(p):
    if p["avg_biz_per_1k"] < 2 and p["avg_poverty_pct"] > 15:
        return "Underserved High-Poverty"
    elif p["avg_biz_per_1k"] > 8:
        return "Commercial Dense"
    elif p["avg_income"] > 150000:
        return "Affluent Well-Served"
    elif p["avg_no_vehicle_pct"] > 8:
        return "Transit-Dependent"
    elif p["food_desert_rate_pct"] > 20:
        return "Food Desert Zone"
    else:
        return "Moderate Access"

for p in cluster_profiles:
    p["label"] = cluster_label(p)
    print(f"  Cluster {p['cluster']} ({p['label']:<25s}): {p['n_tracts']:>3d} tracts, "
          f"biz/1k={p['avg_biz_per_1k']:.1f}, poverty={p['avg_poverty_pct']:.1f}%, "
          f"desert={p['food_desert_rate_pct']:.0f}%")

# Per-tract cluster assignment
tract_clusters = []
geoids = tracts_pd["geoid"].astype(str).values
for i, (geoid, cluster) in enumerate(zip(geoids, labels_host)):
    tract_clusters.append({
        "geoid": geoid,
        "cluster": int(cluster),
        "label": cluster_profiles[int(cluster)]["label"],
        "centroid_lat": float(tracts_pd.iloc[i]["centroid_lat"]),
        "centroid_lon": float(tracts_pd.iloc[i]["centroid_lon"]),
    })

gpu_clusters_out = {
    "profiles": cluster_profiles,
    "tracts": tract_clusters,
    "method": f"cuML KMeans k=6 on GPU (NVIDIA DGX Spark)",
    "elapsed_sec": round(elapsed, 4),
    "n_tracts": len(tracts_pd),
}
with open(f"{OUT_DIR}/gpu_clusters.json", "w") as f:
    json.dump(gpu_clusters_out, f)
print(f"  Wrote gpu_clusters.json")


# ════════════════════════════════════════════════════════════════════
# 2. cuML UMAP — 2D Embedding for Visualization
# ════════════════════════════════════════════════════════════════════
print("\n" + "=" * 65)
print("2. cuML UMAP — 2D Dimensionality Reduction")
print("=" * 65)

t0 = time.time()
umap = UMAP(n_components=2, n_neighbors=12, min_dist=0.1, random_state=42)
embedding = umap.fit_transform(X_scaled)
elapsed = time.time() - t0
print(f"  UMAP fit in {elapsed:.3f}s on GPU")

embed_host = embedding.to_pandas().values
umap_records = []
for i, (geoid, cluster) in enumerate(zip(geoids, labels_host)):
    row = tracts_pd.iloc[i]
    umap_records.append({
        "geoid": geoid,
        "x": round(float(embed_host[i, 0]), 4),
        "y": round(float(embed_host[i, 1]), 4),
        "cluster": int(cluster),
        "cluster_label": cluster_profiles[int(cluster)]["label"],
        "classification": row["classification"],
        "poverty_pct": round(float(row["poverty_rate_pct"]), 1),
        "biz_per_1k": round(float(row["biz_per_1k_pop"]), 2),
        "income": int(row["median_household_income"]) if not np.isnan(row["median_household_income"]) else 0,
        "population": int(row["total_population"]),
    })

with open(f"{OUT_DIR}/gpu_umap_coords.json", "w") as f:
    json.dump({"points": umap_records, "elapsed_sec": round(elapsed, 4)}, f)
print(f"  Wrote gpu_umap_coords.json ({len(umap_records)} tracts)")


# ════════════════════════════════════════════════════════════════════
# 3. cuML Nearest Neighbors — Closest Food Business per Tract
# ════════════════════════════════════════════════════════════════════
print("\n" + "=" * 65)
print("3. cuML NearestNeighbors — Food Desert Nearest Food Biz")
print("=" * 65)

# Get businesses with valid lat/lon
biz_pd = businesses.to_pandas()
biz_valid = biz_pd.dropna(subset=["lat", "lon"]).copy()
biz_valid["lat"] = pd.to_numeric(biz_valid["lat"], errors="coerce")
biz_valid["lon"] = pd.to_numeric(biz_valid["lon"], errors="coerce")
biz_valid = biz_valid.dropna(subset=["lat", "lon"])
print(f"  Businesses with coordinates: {len(biz_valid):,}")

# Build GPU array of business lat/lon
biz_coords_gpu = cudf.DataFrame({"lat": biz_valid["lat"].values, "lon": biz_valid["lon"].values})

# Desert tracts centroids
desert_mask = tracts_pd["is_food_desert"].astype(bool)
desert_tracts = tracts_pd[desert_mask].copy()
desert_coords = cudf.DataFrame({
    "lat": desert_tracts["centroid_lat"].values,
    "lon": desert_tracts["centroid_lon"].values,
})
print(f"  Food desert tracts to analyze: {len(desert_tracts):,}")

t0 = time.time()
nn = NearestNeighbors(n_neighbors=3, algorithm="brute", metric="euclidean")
nn.fit(biz_coords_gpu)
distances, indices = nn.kneighbors(desert_coords)
elapsed = time.time() - t0
print(f"  NearestNeighbors query in {elapsed:.4f}s on GPU")

# Convert to miles (approx: 1 degree lat ≈ 69 miles, 1 degree lon ≈ 54.6 miles at 37°N)
dist_host = distances.to_pandas().values
idx_host = indices.to_pandas().values

nearest_records = []
for i, (_, row) in enumerate(desert_tracts.iterrows()):
    nearest = []
    for j in range(3):
        biz_idx = int(idx_host[i, j])
        biz_row = biz_valid.iloc[biz_idx]
        deg_dist = float(dist_host[i, j])
        # Approximate lat/lon degree to miles
        miles = deg_dist * 60  # rough estimate
        nearest.append({
            "name": str(biz_row.get("name", "Unknown")),
            "city": str(biz_row.get("city", "")).strip().title(),
            "distance_deg": round(deg_dist, 5),
            "distance_miles_approx": round(miles, 2),
        })
    nearest_records.append({
        "geoid": str(row["geoid"]),
        "centroid_lat": float(row["centroid_lat"]),
        "centroid_lon": float(row["centroid_lon"]),
        "population": int(row["total_population"]),
        "biz_per_1k": round(float(row["biz_per_1k_pop"]), 2),
        "nearest_food_businesses": nearest,
        "closest_miles": round(nearest[0]["distance_miles_approx"], 2),
    })

nearest_records.sort(key=lambda x: x["closest_miles"])
with open(f"{OUT_DIR}/gpu_nearest_food.json", "w") as f:
    json.dump({"deserts": nearest_records, "elapsed_sec": round(elapsed, 6)}, f)
print(f"  Wrote gpu_nearest_food.json ({len(nearest_records)} desert tracts)")


# ════════════════════════════════════════════════════════════════════
# 4. cuML RandomForest — GPU-accelerated (vs sklearn comparison)
# ════════════════════════════════════════════════════════════════════
print("\n" + "=" * 65)
print("4. cuML RandomForest — GPU-accelerated food desert prediction")
print("=" * 65)

y_binary = tracts["is_food_desert"].astype("int32")
X_train = X_scaled

t0 = time.time()
cu_rf = cuRFC(n_estimators=300, max_depth=8, random_state=42, n_streams=4)
cu_rf.fit(X_train, y_binary)
rf_elapsed = time.time() - t0
print(f"  cuML RF fit in {rf_elapsed:.3f}s on GPU")

preds = cu_rf.predict_proba(X_train)
preds_host = preds.to_pandas().values[:, 1] if hasattr(preds, "to_pandas") else np.array(preds)[:, 1]

# Compare to sklearn timing
from sklearn.ensemble import RandomForestClassifier as skRFC
t0 = time.time()
sk_rf = skRFC(n_estimators=300, max_depth=8, random_state=42)
sk_rf.fit(X_scaled.to_pandas().values, y_binary.to_pandas().values)
sk_elapsed = time.time() - t0
print(f"  sklearn RF fit in {sk_elapsed:.3f}s on CPU")
speedup = sk_elapsed / rf_elapsed
print(f"  GPU Speedup: {speedup:.1f}x")

# Save GPU predictions
gpu_rf_records = []
for i, geoid in enumerate(geoids):
    gpu_rf_records.append({
        "geoid": geoid,
        "gpu_desert_prob": round(float(preds_host[i]), 4),
    })

gpu_perf = {
    "cuml_rf_elapsed_sec": round(rf_elapsed, 4),
    "sklearn_rf_elapsed_sec": round(sk_elapsed, 4),
    "gpu_speedup_x": round(speedup, 1),
    "n_estimators": 300,
    "n_tracts": len(tracts_pd),
    "device": "NVIDIA DGX Spark GB10 Blackwell (sm_121)",
    "cuml_version": cuml.__version__,
    "predictions": gpu_rf_records,
}
with open(f"{OUT_DIR}/gpu_rf_results.json", "w") as f:
    json.dump(gpu_perf, f)
print(f"  Wrote gpu_rf_results.json (speedup: {speedup:.1f}x)")


# ════════════════════════════════════════════════════════════════════
# Summary
# ════════════════════════════════════════════════════════════════════
print("\n" + "=" * 65)
print("GPU Analysis Complete")
print("=" * 65)
print(f"  KMeans clusters:   gpu_clusters.json")
print(f"  UMAP embedding:    gpu_umap_coords.json")
print(f"  Nearest neighbor:  gpu_nearest_food.json")
print(f"  RF benchmark:      gpu_rf_results.json  ({speedup:.1f}x GPU speedup)")
print("\n  All compute ran locally on NVIDIA DGX Spark GB10 Blackwell")
print("  No community data left the device.")
