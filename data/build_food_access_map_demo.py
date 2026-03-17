#!/usr/bin/env python3
import json
from pathlib import Path

import geopandas as gpd
import pandas as pd


DATA_DIR = Path("/home/nvidia/data")
TRACT_SUMMARY_CSV = DATA_DIR / "santa_clara_tract_food_access_summary.csv"
BUSINESS_CSV = DATA_DIR / "santa_clara_food_businesses_clean.csv"
TRACT_ZIP = DATA_DIR / "tl_2024_06_tract.zip"


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def normalize_series(series: pd.Series) -> pd.Series:
    series = pd.to_numeric(series, errors="coerce").fillna(0)
    min_val = series.min()
    max_val = series.max()
    if max_val == min_val:
        return pd.Series([0.0] * len(series), index=series.index)
    return (series - min_val) / (max_val - min_val)


def build_scores(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    df["total_population"] = pd.to_numeric(df["total_population"], errors="coerce").fillna(0)
    df["median_household_income"] = pd.to_numeric(df["median_household_income"], errors="coerce")
    df["poverty_rate_pct"] = pd.to_numeric(df["poverty_rate_pct"], errors="coerce").fillna(0)
    df["households_no_vehicle_pct"] = pd.to_numeric(df["households_no_vehicle_pct"], errors="coerce").fillna(0)
    df["fresh_food_businesses"] = pd.to_numeric(df["fresh_food_businesses"], errors="coerce").fillna(0)
    df["limited_fresh_food_businesses"] = pd.to_numeric(df["limited_fresh_food_businesses"], errors="coerce").fillna(0)
    df["restaurant_businesses"] = pd.to_numeric(df["restaurant_businesses"], errors="coerce").fillna(0)

    df["fresh_food_per_1000_people"] = (
        1000 * df["fresh_food_businesses"] / df["total_population"].replace({0: pd.NA})
    ).fillna(0)
    df["limited_fresh_food_per_1000_people"] = (
        1000 * df["limited_fresh_food_businesses"] / df["total_population"].replace({0: pd.NA})
    ).fillna(0)
    df["restaurant_per_1000_people"] = (
        1000 * df["restaurant_businesses"] / df["total_population"].replace({0: pd.NA})
    ).fillna(0)

    fresh_norm = normalize_series(df["fresh_food_per_1000_people"])
    poverty_norm = normalize_series(df["poverty_rate_pct"])
    no_vehicle_norm = normalize_series(df["households_no_vehicle_pct"])
    income_norm = normalize_series(df["median_household_income"].fillna(df["median_household_income"].median()))

    # Higher is better. Fresh-food retail is the dominant signal.
    df["fresh_food_access_raw"] = (
        0.70 * fresh_norm
        + 0.10 * (1 - poverty_norm)
        + 0.10 * (1 - no_vehicle_norm)
        + 0.10 * income_norm
    )
    # Make the map relative to Santa Clara County so average tracts are not painted red by default.
    df["fresh_food_access_score"] = (
        100 * df["fresh_food_access_raw"].rank(method="average", pct=True)
    ).round(1)
    df["access_vulnerability_score"] = (100 - df["fresh_food_access_score"]).round(1)

    high_risk = df["access_vulnerability_score"].quantile(0.8)
    moderate_risk = df["access_vulnerability_score"].quantile(0.6)
    low_access = df["fresh_food_businesses"] <= 1

    df["priority_area_flag"] = (
        (low_access & (df["poverty_rate_pct"] >= df["poverty_rate_pct"].median()))
        | (df["access_vulnerability_score"] >= high_risk)
    )
    df["access_label"] = "Moderate fresh-food access"
    df.loc[df["fresh_food_access_score"] >= 80, "access_label"] = "Strong fresh-food access"
    df.loc[
        (df["fresh_food_access_score"] >= 60) & (df["fresh_food_access_score"] < 80),
        "access_label",
    ] = "Above-average fresh-food access"
    df.loc[
        (df["access_vulnerability_score"] >= moderate_risk)
        & (df["access_vulnerability_score"] < high_risk),
        "access_label",
    ] = "Lower fresh-food access"
    df.loc[df["access_vulnerability_score"] >= high_risk, "access_label"] = (
        "Highest access vulnerability"
    )

    return df


def color_for_score(score: float) -> str:
    if score >= 80:
        return "#1a9850"
    if score >= 65:
        return "#66bd63"
    if score >= 40:
        return "#fee08b"
    if score >= 20:
        return "#f46d43"
    return "#d73027"


def make_map_html(tract_geojson: dict, fresh_food_points: list[dict], stats: dict) -> str:
    tract_json = json.dumps(tract_geojson)
    point_json = json.dumps(fresh_food_points)
    stats_json = json.dumps(stats)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Santa Clara County Fresh-Food Access Map</title>
  <link rel="preconnect" href="https://unpkg.com">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    :root {{
      --bg: #f3efe5;
      --ink: #1d2a24;
      --muted: #5d6a63;
      --card: rgba(255,255,255,0.92);
      --border: rgba(29,42,36,0.12);
      --shadow: 0 18px 40px rgba(35, 43, 39, 0.14);
    }}
    html, body {{
      margin: 0;
      height: 100%;
      font-family: Georgia, "Times New Roman", serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(252,214,122,0.45), transparent 30%),
        radial-gradient(circle at bottom right, rgba(108,168,129,0.28), transparent 28%),
        var(--bg);
    }}
    #app {{
      display: grid;
      grid-template-columns: 360px 1fr;
      height: 100vh;
    }}
    #sidebar {{
      padding: 24px 20px;
      overflow: auto;
      backdrop-filter: blur(8px);
    }}
    .panel {{
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 18px;
      box-shadow: var(--shadow);
      padding: 18px;
      margin-bottom: 16px;
    }}
    h1 {{
      font-size: 1.7rem;
      line-height: 1.1;
      margin: 0 0 10px 0;
    }}
    p, li {{
      color: var(--muted);
      font-size: 0.98rem;
      line-height: 1.45;
    }}
    ul {{
      padding-left: 18px;
      margin: 10px 0 0 0;
    }}
    .stat {{
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid rgba(29,42,36,0.08);
    }}
    .stat:last-child {{
      border-bottom: none;
    }}
    .pill {{
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(29,42,36,0.08);
      color: var(--ink);
      font-size: 0.82rem;
      margin-top: 8px;
    }}
    #map {{
      height: 100vh;
      width: 100%;
    }}
    .legend {{
      background: rgba(255,255,255,0.94);
      padding: 10px 12px;
      border-radius: 14px;
      border: 1px solid rgba(29,42,36,0.1);
      box-shadow: var(--shadow);
      line-height: 1.3;
    }}
    .legend .row {{
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 6px;
      font-size: 0.9rem;
    }}
    .swatch {{
      width: 14px;
      height: 14px;
      border-radius: 4px;
      border: 1px solid rgba(0,0,0,0.12);
    }}
    @media (max-width: 900px) {{
      #app {{
        grid-template-columns: 1fr;
        grid-template-rows: auto 55vh;
        height: auto;
      }}
      #map {{
        height: 55vh;
      }}
    }}
  </style>
</head>
<body>
  <div id="app">
    <div id="sidebar">
      <div class="panel">
        <h1>Santa Clara Fresh-Food Access</h1>
        <p>
          This demo highlights within-county fresh-food access disparities across Santa Clara County.
          Grocery-style access drives the score. Fast food and restaurants do not count as healthy access.
        </p>
        <div class="pill">Green = stronger fresh-food access relative to the county</div>
        <div class="pill">Orange/Red = lower fresh-food access or higher access vulnerability</div>
      </div>
      <div class="panel">
        <strong>Scoring logic</strong>
        <ul>
          <li>70%: likely fresh-food businesses per 1,000 residents</li>
          <li>10%: lower poverty burden</li>
          <li>10%: lower no-vehicle burden</li>
          <li>10%: higher median household income</li>
        </ul>
        <p>
          Convenience-style retail and restaurant-heavy areas are shown, but they do not improve the tract score the way grocery-oriented fresh-food businesses do. The score is scaled relative to other Santa Clara tracts so the county does not default to orange/red.
        </p>
      </div>
      <div class="panel">
        <strong>County snapshot</strong>
        <div id="stats"></div>
      </div>
      <div class="panel">
        <strong>How to read it</strong>
        <p>
          Click a tract to see its fresh-food access score, population, poverty, car-access burden, and the number of likely fresh-food businesses nearby.
        </p>
      </div>
    </div>
    <div id="map"></div>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const tractData = {tract_json};
    const freshFoodPoints = {point_json};
    const stats = {stats_json};

    const map = L.map('map', {{ zoomControl: true }}).setView([37.29, -121.95], 10);
    L.tileLayer('https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png', {{
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }}).addTo(map);

    function styleFeature(feature) {{
      const score = feature.properties.fresh_food_access_score || 0;
      return {{
        fillColor: feature.properties.fill_color,
        weight: 1,
        opacity: 1,
        color: 'rgba(70, 64, 52, 0.65)',
        fillOpacity: 0.72
      }};
    }}

    function popupHtml(props) {{
      return `
        <div style="min-width:240px">
          <strong>${{props.name}}</strong><br/>
          <span>${{props.access_label}}</span><br/><br/>
          <strong>Fresh-food access score:</strong> ${{props.fresh_food_access_score}} / 100<br/>
          <strong>Access vulnerability:</strong> ${{props.access_vulnerability_score}} / 100<br/>
          <strong>Likely fresh-food businesses:</strong> ${{props.fresh_food_businesses}}<br/>
          <strong>Fresh food / 1,000 residents:</strong> ${{Number(props.fresh_food_per_1000_people || 0).toFixed(2)}}<br/>
          <strong>Total food businesses:</strong> ${{props.total_food_businesses}}<br/>
          <strong>Poverty rate:</strong> ${{props.poverty_rate_pct ?? 'N/A'}}%<br/>
          <strong>No-vehicle households:</strong> ${{props.households_no_vehicle_pct ?? 'N/A'}}%<br/>
          <strong>Median income:</strong> ${{props.median_household_income ? '$' + Number(props.median_household_income).toLocaleString() : 'N/A'}}<br/>
        </div>
      `;
    }}

    const tractLayer = L.geoJSON(tractData, {{
      style: styleFeature,
      onEachFeature: (feature, layer) => {{
        layer.bindPopup(popupHtml(feature.properties));
        layer.on({{
          mouseover: (e) => e.target.setStyle({{ weight: 2, fillOpacity: 0.85 }}),
          mouseout: (e) => tractLayer.resetStyle(e.target)
        }});
      }}
    }}).addTo(map);

    const freshLayer = L.layerGroup(
      freshFoodPoints.map(point =>
        L.circleMarker([point.latitude, point.longitude], {{
          radius: 4,
          color: '#0f5132',
          weight: 1,
          fillColor: '#2ca25f',
          fillOpacity: 0.85
        }}).bindPopup(`<strong>${{point.name}}</strong><br/>${{point.address}}<br/>${{point.city}}`)
      )
    );
    freshLayer.addTo(map);

    const legend = L.control({{ position: 'bottomright' }});
    legend.onAdd = function() {{
      const div = L.DomUtil.create('div', 'legend');
      div.innerHTML = `
        <strong>Fresh-food access</strong>
        <div class="row"><span class="swatch" style="background:#1a9850"></span> Stronger access</div>
        <div class="row"><span class="swatch" style="background:#66bd63"></span> Good access</div>
        <div class="row"><span class="swatch" style="background:#fee08b"></span> Moderate access</div>
        <div class="row"><span class="swatch" style="background:#f46d43"></span> Lower access</div>
        <div class="row"><span class="swatch" style="background:#d73027"></span> Highest vulnerability</div>
      `;
      return div;
    }};
    legend.addTo(map);

    L.control.layers(null, {{
      "Fresh-food business points": freshLayer
    }}, {{ collapsed: false }}).addTo(map);

    document.getElementById('stats').innerHTML = `
      <div class="stat"><span>Tracts mapped</span><strong>${{stats.tracts}}</strong></div>
      <div class="stat"><span>Businesses joined</span><strong>${{stats.businesses}}</strong></div>
      <div class="stat"><span>Likely fresh-food businesses</span><strong>${{stats.fresh_food_businesses}}</strong></div>
      <div class="stat"><span>Highest-vulnerability tracts</span><strong>${{stats.highest_vulnerability_tracts}}</strong></div>
    `;
  </script>
</body>
</html>
"""


def main() -> None:
    tract_summary = pd.read_csv(TRACT_SUMMARY_CSV, dtype={"geoid": str})
    business_df = pd.read_csv(BUSINESS_CSV, dtype={"tract_geoid": str, "block_group_geoid": str})

    tract_summary = build_scores(tract_summary)

    tracts = gpd.read_file(f"zip://{TRACT_ZIP}")
    tracts = tracts[tracts["COUNTYFP"] == "085"].copy().to_crs("EPSG:4326")
    tracts = tracts.merge(tract_summary, how="left", left_on="GEOID", right_on="geoid")

    tracts["fill_color"] = tracts["fresh_food_access_score"].fillna(0).map(color_for_score)
    tracts["fresh_food_per_1000_people"] = tracts["fresh_food_per_1000_people"].fillna(0).round(2)
    tracts["fresh_food_access_score"] = tracts["fresh_food_access_score"].fillna(0).round(1)
    tracts["access_vulnerability_score"] = tracts["access_vulnerability_score"].fillna(0).round(1)

    fresh_food_points = business_df[business_df["fresh_food_likely"] == 1].copy()
    fresh_food_points = fresh_food_points[
        ["name", "address", "city", "latitude", "longitude", "tract_geoid", "block_group_geoid"]
    ].to_dict(orient="records")

    tract_geojson = json.loads(
        tracts[
            [
                "GEOID",
                "geometry",
                "name",
                "total_population",
                "median_household_income",
                "poverty_rate_pct",
                "households_no_vehicle_pct",
                "total_food_businesses",
                "fresh_food_businesses",
                "fresh_food_per_1000_people",
                "fresh_food_access_score",
                "access_vulnerability_score",
                "priority_area_flag",
                "access_label",
                "fill_color",
            ]
        ].to_json()
    )

    stats = {
        "tracts": int(len(tract_summary)),
        "businesses": int(len(business_df)),
        "fresh_food_businesses": int((business_df["fresh_food_likely"] == 1).sum()),
        "highest_vulnerability_tracts": int(
            (tract_summary["access_label"] == "Highest access vulnerability").sum()
        ),
    }

    tract_summary.to_csv(DATA_DIR / "santa_clara_tract_food_access_scored.csv", index=False)
    with open(DATA_DIR / "santa_clara_tract_food_access_map.geojson", "w", encoding="utf-8") as f:
        json.dump(tract_geojson, f)
    with open(DATA_DIR / "santa_clara_food_access_map_demo.html", "w", encoding="utf-8") as f:
        f.write(make_map_html(tract_geojson, fresh_food_points, stats))


if __name__ == "__main__":
    main()
