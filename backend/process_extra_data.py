#!/usr/bin/env python3
"""
Process remaining datasets: Crime correlation, Employee/workforce demographics,
County photographers (culture), inspection trends, and violation type breakdowns.
"""

import pandas as pd
import numpy as np
import json
import os

DATA_DIR = "/home/nvidia/data"
OUT_DIR = "/home/nvidia/safeeats/data"

# ═══════════════════════════════════════════════════════════════
# 1. INSPECTION TRENDS (monthly avg scores)
# ═══════════════════════════════════════════════════════════════
print("Processing inspection trends...")
insp = pd.read_csv(f"{DATA_DIR}/SCC_DEH_Food_Data_INSPECTIONS_20260306.csv")
insp["date"] = pd.to_datetime(insp["date"], format="%Y%m%d", errors="coerce")
insp["SCORE"] = pd.to_numeric(insp["SCORE"], errors="coerce")
insp["month"] = insp["date"].dt.to_period("M").astype(str)

monthly = (
    insp.dropna(subset=["SCORE", "month"])
    .groupby("month")
    .agg(avg_score=("SCORE", "mean"), count=("SCORE", "count"))
    .reset_index()
)
monthly["avg_score"] = monthly["avg_score"].round(1)
trends = {
    "months": monthly.to_dict(orient="records"),
    "total_inspections": int(len(insp)),
    "avg_score_overall": round(float(insp["SCORE"].mean()), 1),
}
with open(f"{OUT_DIR}/trends.json", "w") as f:
    json.dump(trends, f)
print(f"  Wrote trends.json ({len(monthly)} months)")

# ═══════════════════════════════════════════════════════════════
# 2. VIOLATION TYPE BREAKDOWN
# ═══════════════════════════════════════════════════════════════
print("Processing violation types...")
viol = pd.read_csv(f"{DATA_DIR}/SCC_DEH_Food_Data_VIOLATIONS_20260306.csv")
viol["critical"] = viol["critical"].astype(str).str.lower() == "true"

viol_types = viol.groupby("DESCRIPTION").agg(
    count=("DESCRIPTION", "size"),
    critical_count=("critical", "sum"),
).reset_index()
viol_types["critical_pct"] = (viol_types["critical_count"] / viol_types["count"] * 100).round(0).astype(int)
viol_types = viol_types.sort_values("count", ascending=False)
viol_types.columns = ["type", "count", "critical_count", "critical_pct"]

with open(f"{OUT_DIR}/violation_types.json", "w") as f:
    json.dump(viol_types.head(20).to_dict(orient="records"), f)
print(f"  Wrote violation_types.json (top 20)")

# ═══════════════════════════════════════════════════════════════
# 3. EMPLOYEE / WORKFORCE DEMOGRAPHICS
# ═══════════════════════════════════════════════════════════════
print("Processing employee demographics...")
emp = pd.read_csv(f"{DATA_DIR}/Employee_Breakdown_by_Equal_Employment_Opportunity_Categories_20260306.csv")
emp.columns = emp.columns.str.strip()

# Overall workforce diversity
total = len(emp)
ethnicity_counts = emp["Ethnicity"].value_counts().to_dict()
gender_counts = emp["Gender"].value_counts().to_dict()
age_counts = emp["Age"].value_counts().to_dict()

# Department breakdown
dept_stats = []
for dept, group in emp.groupby("Department"):
    dept_stats.append({
        "department": dept.strip(),
        "total": len(group),
        "gender": group["Gender"].value_counts().to_dict(),
        "ethnicity": group["Ethnicity"].value_counts().to_dict(),
        "top_age": group["Age"].value_counts().index[0] if len(group) > 0 else "N/A",
    })
dept_stats.sort(key=lambda x: x["total"], reverse=True)

# Public health specific (most relevant to food safety)
health_depts = emp[emp["EEO Function"].isin(["Health", "Hospitals & Sanatoriums"])]
health_ethnicity = health_depts["Ethnicity"].value_counts().to_dict()
health_total = len(health_depts)

# Diversity index: how many different ethnicities in a department
def diversity_index(group):
    counts = group["Ethnicity"].value_counts(normalize=True)
    return round(1 - sum(counts ** 2), 3)  # Simpson's diversity

dept_diversity = []
for dept, group in emp.groupby("Department"):
    if len(group) >= 20:
        dept_diversity.append({
            "department": dept.strip(),
            "total": len(group),
            "diversity_index": diversity_index(group),
        })
dept_diversity.sort(key=lambda x: x["diversity_index"], reverse=True)

employee_data = {
    "total_employees": total,
    "ethnicity": ethnicity_counts,
    "gender": gender_counts,
    "age_distribution": age_counts,
    "departments": dept_stats[:20],
    "health_workforce": {
        "total": health_total,
        "ethnicity": health_ethnicity,
    },
    "diversity_ranking": dept_diversity[:15],
}

with open(f"{OUT_DIR}/employee_demographics.json", "w") as f:
    json.dump(employee_data, f)
print(f"  Wrote employee_demographics.json ({total:,} employees, {len(dept_stats)} departments)")

# ═══════════════════════════════════════════════════════════════
# 4. COUNTY PHOTOGRAPHERS COLLECTION (Culture)
# ═══════════════════════════════════════════════════════════════
print("Processing photographers collection...")
ph = pd.read_csv(f"{DATA_DIR}/County_Photographers'_Collection_20260306.csv")

# Extract key themes from subjects using keyword matching
themes = {
    "portraits": 0, "agriculture": 0, "infrastructure": 0,
    "government": 0, "health": 0, "education": 0,
    "parks_recreation": 0, "justice_safety": 0, "community": 0,
}
for subj in ph["Subject(s)"].dropna().str.lower():
    if "portrait" in subj: themes["portraits"] += 1
    if any(w in subj for w in ["agriculture", "farm", "fruit", "crop"]): themes["agriculture"] += 1
    if any(w in subj for w in ["building", "road", "bridge", "construction", "highway"]): themes["infrastructure"] += 1
    if any(w in subj for w in ["supervisor", "mayor", "council", "board", "election"]): themes["government"] += 1
    if any(w in subj for w in ["hospital", "health", "medical", "nurse"]): themes["health"] += 1
    if any(w in subj for w in ["school", "education", "student", "library"]): themes["education"] += 1
    if any(w in subj for w in ["park", "recreation", "garden", "trail"]): themes["parks_recreation"] += 1
    if any(w in subj for w in ["sheriff", "court", "police", "jail", "probation"]): themes["justice_safety"] += 1
    if any(w in subj for w in ["community", "ceremony", "event", "fair", "festival"]): themes["community"] += 1

dept_photo_counts = ph["Department"].value_counts().head(15).to_dict()
color_counts = ph["Color"].value_counts().to_dict()

photo_data = {
    "total_photos": len(ph),
    "themes": themes,
    "departments": dept_photo_counts,
    "color_breakdown": color_counts,
    "sample_subjects": ph["Subject(s)"].dropna().sample(min(20, len(ph)), random_state=42).tolist(),
}

with open(f"{OUT_DIR}/photographers_collection.json", "w") as f:
    json.dump(photo_data, f)
print(f"  Wrote photographers_collection.json ({len(ph):,} photos)")

# ═══════════════════════════════════════════════════════════════
# 5. CRIME + FOOD DESERT CORRELATION
# ═══════════════════════════════════════════════════════════════
print("Processing crime-food desert correlation...")
crime = pd.read_csv(f"{DATA_DIR}/Crime_Reports_20260306.csv")

# Crime type breakdown
crime_types = crime["parent_incident_type"].value_counts().head(15).to_dict()

# Crime by city (to correlate with food access by city)
crime_by_city = crime["city"].value_counts().to_dict()

# Severity breakdown
severity_types = {
    "violent": ["Assault", "Robbery", "Homicide", "Sexual Assault"],
    "property": ["Theft", "Burglary", "Auto Theft", "Vandalism"],
    "disorder": ["Disorder", "Drugs", "DUI"],
    "other": [],
}
crime["severity"] = "other"
for sev, types in severity_types.items():
    if types:
        crime.loc[crime["parent_incident_type"].isin(types), "severity"] = sev

severity_counts = crime["severity"].value_counts().to_dict()

crime_data = {
    "total_incidents": len(crime),
    "incident_types": crime_types,
    "by_city": crime_by_city,
    "severity_breakdown": severity_counts,
}

with open(f"{OUT_DIR}/crime_analysis.json", "w") as f:
    json.dump(crime_data, f)
print(f"  Wrote crime_analysis.json ({len(crime):,} incidents)")

print("\nDone! All extra datasets processed.")
