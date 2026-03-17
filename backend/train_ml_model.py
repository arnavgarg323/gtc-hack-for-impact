#!/usr/bin/env python3
"""
Train a food desert risk prediction model using scikit-learn.
Outputs:
  data/ml_risk_scores.json   - risk score [0-100] for each tract + feature importances
  data/ml_model_stats.json   - model accuracy, confusion matrix, feature importances
"""

import pandas as pd
import numpy as np
import json
import pickle
import os
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.calibration import CalibratedClassifierCV

OUT_DIR = "/home/nvidia/safeeats/data"

print("=" * 60)
print("SafeEats ML: Food Desert Risk Prediction")
print("=" * 60)

# Load data
df = pd.read_csv(f"{OUT_DIR}/food_access_tracts.csv")
print(f"  Loaded {len(df)} census tracts")

# Drop tracts with no population (uninhabitable)
df = df[df["total_population"] > 0].copy()
print(f"  Tracts with population: {len(df)}")

# Feature engineering
FEATURES = [
    "poverty_rate_pct",
    "median_household_income",
    "households_no_vehicle_pct",
    "pct_65_plus",
    "pct_under_18",
    "pct_hispanic",
    "pct_black",
    "pct_asian",
    "pct_white",
    "food_biz_count",
    "biz_per_1k_pop",
    "biz_per_sq_mi",
    "total_population",
    "area_sq_mi",
]

# Fill missing values with median
for col in FEATURES:
    df[col] = pd.to_numeric(df[col], errors="coerce")
    df[col] = df[col].fillna(df[col].median())

X = df[FEATURES].values

# Target: binary food desert (food_desert + severe_food_desert)
y_binary = (df["is_food_desert"].astype(bool)).astype(int).values

# 5-class target for detailed risk
label_map = {
    "no_population": -1,
    "adequate": 0,
    "low_income_only": 1,
    "low_access_only": 2,
    "food_desert": 3,
    "severe_food_desert": 4,
}
y_risk = df["classification"].map(label_map).fillna(0).astype(int).values

print(f"\n  Class distribution:")
for label, val in label_map.items():
    count = (y_risk == val).sum()
    if count > 0:
        print(f"    {label:<25s}: {count:>3d}")

# ── Model 1: Binary food desert classifier ──────────────────────────────────
print("\n" + "=" * 60)
print("MODEL 1: Binary food desert classifier (GradientBoosting)")
print("=" * 60)

gb = GradientBoostingClassifier(
    n_estimators=200,
    learning_rate=0.05,
    max_depth=4,
    min_samples_leaf=5,
    random_state=42,
)
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
scores = cross_val_score(gb, X, y_binary, cv=cv, scoring="roc_auc")
print(f"  5-fold CV ROC-AUC: {scores.mean():.3f} ± {scores.std():.3f}")

# Fit final model
gb.fit(X, y_binary)
calibrated = CalibratedClassifierCV(gb, cv=5)
calibrated.fit(X, y_binary)

# Get probabilities (calibrated)
risk_proba = calibrated.predict_proba(X)[:, 1]  # P(food desert)

# ── Model 2: Multi-class risk level (Random Forest) ──────────────────────────
print("\n" + "=" * 60)
print("MODEL 2: Risk level classifier (RandomForest, 4 classes)")
print("=" * 60)

# Use 4 classes: adequate/low_income_only/low_access_only/food_desert+severe
y4 = np.where(y_risk <= 0, 0,
     np.where(y_risk == 1, 1,
     np.where(y_risk == 2, 2, 3)))

rf = RandomForestClassifier(
    n_estimators=300,
    max_depth=8,
    min_samples_leaf=3,
    random_state=42,
    class_weight="balanced",
)
scores4 = cross_val_score(rf, X, y4, cv=cv, scoring="f1_weighted")
print(f"  5-fold CV F1 (weighted): {scores4.mean():.3f} ± {scores4.std():.3f}")
rf.fit(X, y4)

# Feature importances (from Random Forest)
importances = rf.feature_importances_
feat_imp = sorted(
    zip(FEATURES, importances.tolist()),
    key=lambda x: x[1], reverse=True
)
print("\n  Top feature importances:")
for feat, imp in feat_imp[:8]:
    bar = "█" * int(imp * 100)
    print(f"    {feat:<30s} {imp:.3f}  {bar}")

# ── Composite risk score [0-100] ─────────────────────────────────────────────
# Weight: 60% GB probability + 40% RF risk class
rf_risk_class = rf.predict(X)  # 0-3
composite = (risk_proba * 60) + (rf_risk_class / 3 * 40)
composite = np.clip(composite, 0, 100)

# Assign risk tier labels
def risk_tier(score):
    if score >= 70:
        return "critical"
    elif score >= 50:
        return "high"
    elif score >= 30:
        return "moderate"
    elif score >= 15:
        return "low"
    else:
        return "minimal"

# ── Output files ─────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("Writing output files")
print("=" * 60)

# Per-tract risk scores
records = []
for i, row in df.iterrows():
    idx = df.index.get_loc(i)
    score = float(composite[idx])
    records.append({
        "geoid": str(row["geoid"]),
        "risk_score": round(score, 1),
        "risk_tier": risk_tier(score),
        "desert_probability": round(float(risk_proba[idx]) * 100, 1),
        "actual_classification": row["classification"],
        "centroid_lat": row["centroid_lat"],
        "centroid_lon": row["centroid_lon"],
        "total_population": int(row["total_population"]),
        "poverty_rate_pct": round(float(row["poverty_rate_pct"]), 1) if pd.notna(row["poverty_rate_pct"]) else None,
        "median_household_income": int(row["median_household_income"]) if pd.notna(row["median_household_income"]) else None,
        "biz_per_1k_pop": round(float(row["biz_per_1k_pop"]), 2),
        "food_biz_count": int(row["food_biz_count"]),
    })

records.sort(key=lambda x: x["risk_score"], reverse=True)

with open(f"{OUT_DIR}/ml_risk_scores.json", "w") as f:
    json.dump(records, f)
print(f"  ml_risk_scores.json — {len(records)} tracts")

# Distribution of risk tiers
from collections import Counter
tier_counts = Counter(r["risk_tier"] for r in records)
print("  Risk tier distribution:")
for tier in ["critical", "high", "moderate", "low", "minimal"]:
    print(f"    {tier:<10s}: {tier_counts.get(tier, 0):>3d} tracts")

# Model stats
model_stats = {
    "binary_classifier": {
        "model": "GradientBoostingClassifier (calibrated)",
        "cv_roc_auc_mean": round(float(scores.mean()), 3),
        "cv_roc_auc_std": round(float(scores.std()), 3),
    },
    "multiclass_classifier": {
        "model": "RandomForestClassifier (balanced)",
        "cv_f1_weighted_mean": round(float(scores4.mean()), 3),
        "cv_f1_weighted_std": round(float(scores4.std()), 3),
    },
    "feature_importances": [
        {"feature": feat, "importance": round(imp, 4)}
        for feat, imp in feat_imp
    ],
    "risk_tier_counts": dict(tier_counts),
    "top_at_risk_tracts": [
        r for r in records[:10]
        if r["risk_tier"] in ("critical", "high")
    ],
}

with open(f"{OUT_DIR}/ml_model_stats.json", "w") as f:
    json.dump(model_stats, f, indent=2)
print(f"  ml_model_stats.json")

print("\n  Top 10 highest-risk tracts:")
print(f"  {'GeoID':<15s} {'Score':>6s} {'Tier':<10s} {'Pop':>8s} {'Poverty':>8s} {'Biz/1k':>8s}")
print(f"  {'-'*15}  {'-'*6}  {'-'*10}  {'-'*8}  {'-'*8}  {'-'*8}")
for r in records[:10]:
    print(f"  {r['geoid']:<15s} {r['risk_score']:>6.1f}  {r['risk_tier']:<10s} {r['total_population']:>8,d}  {r.get('poverty_rate_pct', 0) or 0:>7.1f}%  {r['biz_per_1k_pop']:>8.2f}")

print("\n" + "=" * 60)
print("DONE")
print("=" * 60)
