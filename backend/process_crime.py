#!/usr/bin/env python3
"""
Process crime data into aggregated heatmap points for the map overlay.
Output: data/crime_points.json  - list of {lat, lon, weight, type}
        data/crime_by_type.json - top incident types with counts
"""

import pandas as pd
import json, re, os

DATA_DIR = "/home/nvidia/data"
OUT_DIR = "/home/nvidia/safeeats/data"

print("Loading crime data...")
df = pd.read_csv(f"{DATA_DIR}/Crime_Reports_20260306.csv")
print(f"  Total records: {len(df):,}")

# Extract lat/lon from address — not in this CSV directly.
# Parse city and aggregate by block address
# The address field has "500 Block BLOSSOM HILL RD" etc.
# We'll geocode by known SCC city centroids for a heatmap approximation,
# then jitter slightly for visual spread.

import random
random.seed(42)

# Santa Clara County city centroids
CITY_CENTROIDS = {
    "Santa Clara County": (37.35, -121.95),
    "San Jose": (37.3382, -121.8863),
    "Sunnyvale": (37.3688, -122.0363),
    "Santa Clara": (37.3541, -121.9552),
    "Milpitas": (37.4323, -121.8996),
    "Campbell": (37.2872, -121.9500),
    "Los Gatos": (37.2358, -121.9624),
    "Saratoga": (37.2638, -122.0231),
    "Cupertino": (37.3230, -122.0322),
    "Mountain View": (37.3861, -122.0839),
    "Los Altos": (37.3852, -122.1141),
    "Palo Alto": (37.4419, -122.1430),
    "Morgan Hill": (37.1305, -121.6543),
    "Gilroy": (37.0058, -121.5683),
}

def jitter(val, spread=0.03):
    return val + (random.random() - 0.5) * spread

# Incident type weights for severity
SEVERITY = {
    "Robbery": 3, "Assault": 3, "Homicide": 4, "Sexual Assault": 4,
    "Burglary": 2, "Theft": 1, "Auto Theft": 2, "Vandalism": 1,
    "Disorder": 1, "Drugs": 2, "DUI": 2, "Weapons": 3,
    "Other": 1, "Community Policing": 0,
}

points = []
for _, row in df.iterrows():
    city = str(row.get("city", "")).strip()
    parent_type = str(row.get("parent_incident_type", "Other")).strip()
    inc_type = str(row.get("incident_type_primary", "Other")).strip()

    center = CITY_CENTROIDS.get(city, CITY_CENTROIDS["Santa Clara County"])
    weight = SEVERITY.get(parent_type, 1)
    if weight == 0:
        continue  # skip community policing

    points.append({
        "lat": round(jitter(center[0]), 6),
        "lon": round(jitter(center[1]), 6),
        "w": weight,
        "t": inc_type,
    })

with open(f"{OUT_DIR}/crime_points.json", "w") as f:
    json.dump(points, f)
print(f"Wrote crime_points.json ({len(points):,} points)")

# Top incident types
type_counts = df["parent_incident_type"].value_counts().head(15).to_dict()
with open(f"{OUT_DIR}/crime_by_type.json", "w") as f:
    json.dump(type_counts, f)
print(f"Wrote crime_by_type.json")
print("Done!")
