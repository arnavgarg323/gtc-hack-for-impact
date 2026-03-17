# "What If" Intervention Simulator — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive "What If" feature where users click a food desert tract, simulate placing a new grocery store, see before/after food access scores recalculated in real-time, and get an AI-generated policy brief — all running locally on DGX Spark.

**Architecture:** New `/api/simulate` POST endpoint loads the food access CSV into memory at startup, recalculates food access metrics for a target tract + geographic neighbors when a simulated business is added, then sends the before/after data to the local Nemotron LLM to generate a policy brief. Frontend adds a simulation modal triggered by clicking a food desert tract on the map.

**Tech Stack:** Python/Flask (existing), pandas, geopandas/shapely (for neighbor detection), OpenAI client → local vLLM/Nemotron (existing), Leaflet + vanilla JS (existing)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `app.py` | Modify | Add `/api/simulate` endpoint, load tract data at startup |
| `simulate.py` | Create | Simulation logic: recalculate food access scores, find neighbors, classify, generate policy brief via LLM |
| `templates/index.html` | Modify | Add simulation modal UI, wire click handler on food desert tracts |

---

### Task 1: Backend — Simulation Engine (`simulate.py`)

**Files:**
- Create: `/home/nvidia/safeeats/simulate.py`

This module handles all simulation logic: loading tract data, finding geographic neighbors, recalculating food access scores after a simulated intervention, and generating a policy brief via the local LLM.

- [ ] **Step 1: Create `simulate.py` with tract data loading and the reclassification function**

```python
#!/usr/bin/env python3
"""
SafeEats SCC — "What If" Intervention Simulator
Recalculates food access scores when a simulated grocery store is placed in a tract.
Generates policy briefs via local Nemotron LLM on DGX Spark.
"""

import pandas as pd
import json
import os
from shapely.geometry import shape

DATA_DIR = "/home/nvidia/safeeats/data"

# Same thresholds as build_food_access.py
LOW_ACCESS_BIZ_PER_1K = 3.0
POVERTY_THRESHOLD = 20.0
INCOME_RATIO = 0.80
NO_VEHICLE_SEVERE = 10.0
ELDERLY_SEVERE = 15.0

# Load tract data once
_tracts_df = None
_geojson = None
_county_median_income = None


def _load_data():
    global _tracts_df, _geojson, _county_median_income
    if _tracts_df is not None:
        return

    _tracts_df = pd.read_csv(f"{DATA_DIR}/food_access_tracts.csv")
    _county_median_income = _tracts_df["median_household_income"].median()

    with open(f"{DATA_DIR}/food_access_tracts.geojson") as f:
        _geojson = json.load(f)


def _classify(row):
    """Classify a tract based on food access metrics. Mirrors build_food_access.py logic."""
    if pd.isna(row.get("total_population")) or row["total_population"] == 0:
        return "no_population"

    is_low_income = (
        row["poverty_rate_pct"] >= POVERTY_THRESHOLD
        or row["median_household_income"] <= INCOME_RATIO * _county_median_income
    )
    is_low_access = row["biz_per_1k_pop"] < LOW_ACCESS_BIZ_PER_1K

    is_food_desert = is_low_income and is_low_access
    pct_65_plus = (
        row["age_65_plus_population"] / row["total_population"] * 100
        if row["total_population"] > 0
        else 0
    )
    is_severe = is_food_desert and (
        row["households_no_vehicle_pct"] >= NO_VEHICLE_SEVERE
        or pct_65_plus >= ELDERLY_SEVERE
        or row["food_biz_count"] == 0
    )

    if is_severe:
        return "severe_food_desert"
    if is_food_desert:
        return "food_desert"
    if is_low_access:
        return "low_access_only"
    if is_low_income:
        return "low_income_only"
    return "adequate"


def _find_neighbors(target_geoid):
    """Find tracts that share a border with the target tract using GeoJSON geometry."""
    _load_data()
    target_geom = None
    for feat in _geojson["features"]:
        if feat["properties"]["geoid"] == target_geoid:
            target_geom = shape(feat["geometry"])
            break
    if target_geom is None:
        return []

    neighbors = []
    for feat in _geojson["features"]:
        gid = feat["properties"]["geoid"]
        if gid == target_geoid:
            continue
        other_geom = shape(feat["geometry"])
        if target_geom.touches(other_geom) or target_geom.intersects(other_geom):
            neighbors.append(gid)
    return neighbors


def simulate_intervention(target_geoid, new_businesses=1):
    """
    Simulate adding new_businesses grocery stores to target_geoid.
    Returns before/after data for the target tract and affected neighbors.
    """
    _load_data()

    # Find the target tract
    tract_row = _tracts_df[_tracts_df["geoid"] == target_geoid]
    if tract_row.empty:
        return {"error": f"Tract {target_geoid} not found"}

    tract = tract_row.iloc[0].to_dict()

    # Before state
    before = {
        "geoid": target_geoid,
        "food_biz_count": int(tract["food_biz_count"]),
        "biz_per_1k_pop": float(tract["biz_per_1k_pop"]),
        "classification": tract["classification"],
        "is_food_desert": bool(tract["is_food_desert"]),
        "is_severe": bool(tract["is_severe"]),
        "total_population": int(tract["total_population"]),
        "median_household_income": int(tract["median_household_income"]),
        "poverty_rate_pct": float(tract["poverty_rate_pct"]),
        "households_no_vehicle_pct": float(tract["households_no_vehicle_pct"]),
        "pct_65_plus": float(tract.get("pct_65_plus", 0)),
    }

    # After state — add businesses and recalculate
    after_biz_count = tract["food_biz_count"] + new_businesses
    after_biz_per_1k = round(
        after_biz_count / tract["total_population"] * 1000, 2
    ) if tract["total_population"] > 0 else 0.0

    after_row = dict(tract)
    after_row["food_biz_count"] = after_biz_count
    after_row["biz_per_1k_pop"] = after_biz_per_1k

    after_classification = _classify(after_row)

    after = {
        "geoid": target_geoid,
        "food_biz_count": int(after_biz_count),
        "biz_per_1k_pop": after_biz_per_1k,
        "classification": after_classification,
        "is_food_desert": after_classification in ("food_desert", "severe_food_desert"),
        "is_severe": after_classification == "severe_food_desert",
        "total_population": before["total_population"],
        "median_household_income": before["median_household_income"],
        "poverty_rate_pct": before["poverty_rate_pct"],
        "households_no_vehicle_pct": before["households_no_vehicle_pct"],
        "pct_65_plus": before["pct_65_plus"],
    }

    # Find and recalculate neighbors (they gain a nearby food business)
    neighbor_geoids = _find_neighbors(target_geoid)
    neighbors_before_after = []
    for ngid in neighbor_geoids:
        nrow = _tracts_df[_tracts_df["geoid"] == ngid]
        if nrow.empty:
            continue
        n = nrow.iloc[0].to_dict()
        n_before_class = n["classification"]

        # Neighbor gets a nearby business — simulate as if it's on the border
        # We add 0.5 effective businesses to represent proximity benefit
        n_after_biz = n["food_biz_count"] + 0.5 * new_businesses
        n_after_per_1k = round(
            n_after_biz / n["total_population"] * 1000, 2
        ) if n["total_population"] > 0 else 0.0

        n_after_row = dict(n)
        n_after_row["food_biz_count"] = n_after_biz
        n_after_row["biz_per_1k_pop"] = n_after_per_1k
        n_after_class = _classify(n_after_row)

        if n_before_class != n_after_class:
            neighbors_before_after.append({
                "geoid": ngid,
                "before": n_before_class,
                "after": n_after_class,
                "population": int(n["total_population"]),
            })

    # Compute impact summary
    people_helped = before["total_population"]
    for nb in neighbors_before_after:
        people_helped += nb["population"]

    deserts_resolved = 0
    if before["is_food_desert"] and not after["is_food_desert"]:
        deserts_resolved += 1
    for nb in neighbors_before_after:
        if nb["before"] in ("food_desert", "severe_food_desert") and nb["after"] not in ("food_desert", "severe_food_desert"):
            deserts_resolved += 1

    return {
        "target_geoid": target_geoid,
        "new_businesses": new_businesses,
        "before": before,
        "after": after,
        "neighbors_affected": neighbors_before_after,
        "impact": {
            "people_in_target": before["total_population"],
            "people_in_affected_neighbors": sum(nb["population"] for nb in neighbors_before_after),
            "total_people_impacted": people_helped,
            "deserts_resolved": deserts_resolved,
            "classification_change": before["classification"] != after["classification"],
            "before_classification": before["classification"],
            "after_classification": after["classification"],
        },
    }


def generate_policy_brief(simulation_result, llm_client, model_name):
    """Generate a policy brief using the local Nemotron LLM on DGX Spark."""
    sr = simulation_result
    b = sr["before"]
    a = sr["after"]
    impact = sr["impact"]

    prompt = f"""You are a public policy analyst writing a brief for the Santa Clara County Board of Supervisors.

Based on this food access simulation data, write a compelling 3-paragraph policy brief recommending this intervention.

SIMULATION DATA:
- Census tract: {sr['target_geoid']}
- Current status: {b['classification'].replace('_', ' ').title()}
- Population: {b['total_population']:,}
- Current food businesses: {b['food_biz_count']} ({b['biz_per_1k_pop']} per 1,000 residents)
- After adding {sr['new_businesses']} grocery store(s): {a['food_biz_count']} businesses ({a['biz_per_1k_pop']} per 1,000 residents)
- New classification: {a['classification'].replace('_', ' ').title()}
- Poverty rate: {b['poverty_rate_pct']}%
- Median household income: ${b['median_household_income']:,}
- Households without vehicle: {b['households_no_vehicle_pct']}%
- Elderly population (65+): {b['pct_65_plus']}%
- Neighboring tracts improved: {len(sr['neighbors_affected'])}
- Total people impacted: {impact['total_people_impacted']:,}
- Food deserts resolved by this intervention: {impact['deserts_resolved']}

Write a policy brief with:
1. PROBLEM paragraph: describe the current food access crisis in this tract using the data
2. INTERVENTION paragraph: describe what adding a grocery store would change, with specific numbers
3. RECOMMENDATION paragraph: urge action, mention the ripple effect on neighbors, and note this analysis was performed locally on NVIDIA DGX Spark to protect sensitive community data

Keep it under 200 words. Be specific with numbers. No markdown formatting."""

    try:
        resp = llm_client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are a public policy analyst. Write clear, data-driven policy briefs."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=400,
            temperature=0.4,
        )
        return resp.choices[0].message.content
    except Exception as e:
        # Fallback: generate a template-based brief
        return (
            f"FOOD ACCESS INTERVENTION BRIEF — Tract {sr['target_geoid']}\n\n"
            f"This tract is currently classified as a {b['classification'].replace('_', ' ')} "
            f"with {b['total_population']:,} residents served by only {b['food_biz_count']} food businesses "
            f"({b['biz_per_1k_pop']} per 1,000 residents). The poverty rate is {b['poverty_rate_pct']}% "
            f"and {b['households_no_vehicle_pct']}% of households lack a vehicle.\n\n"
            f"Adding {sr['new_businesses']} grocery store(s) would raise food access to {a['biz_per_1k_pop']} "
            f"businesses per 1,000 residents, reclassifying this tract as '{a['classification'].replace('_', ' ')}'. "
            f"This would directly impact {impact['total_people_impacted']:,} residents including neighboring tracts.\n\n"
            f"[LLM unavailable: {e}]"
        )
```

- [ ] **Step 2: Verify the module loads without errors**

Run: `cd /home/nvidia/safeeats && python3 -c "from simulate import simulate_intervention; print('OK')"`
Expected: `OK`

---

### Task 2: Backend — Add `/api/simulate` Endpoint to `app.py`

**Files:**
- Modify: `/home/nvidia/safeeats/app.py`

Wire the simulation engine into the Flask app as a new POST endpoint.

- [ ] **Step 1: Add imports and the `/api/simulate` route to `app.py`**

Add after the existing imports at top of file:
```python
from simulate import simulate_intervention, generate_policy_brief
```

Add this new route before `if __name__ == "__main__":`:
```python
@app.route("/api/simulate", methods=["POST"])
def simulate():
    """What-If Intervention Simulator — powered by DGX Spark."""
    data = request.json
    geoid = data.get("geoid", "").strip()
    new_businesses = int(data.get("new_businesses", 1))

    if not geoid:
        return jsonify({"error": "No tract geoid provided"}), 400
    if new_businesses < 1 or new_businesses > 10:
        return jsonify({"error": "new_businesses must be 1-10"}), 400

    # Run simulation
    result = simulate_intervention(geoid, new_businesses)
    if "error" in result:
        return jsonify(result), 404

    # Generate policy brief via local LLM on DGX Spark GPU
    brief = generate_policy_brief(result, client, VLLM_MODEL)
    result["policy_brief"] = brief

    return jsonify(result)
```

- [ ] **Step 2: Test the endpoint manually**

Run: `cd /home/nvidia/safeeats && python3 -c "from simulate import simulate_intervention; import json; r = simulate_intervention('06085512511'); print(json.dumps(r, indent=2))"`

Expected: JSON with before/after data for a severe food desert tract.

---

### Task 3: Frontend — Simulation Modal and Click Handler

**Files:**
- Modify: `/home/nvidia/safeeats/templates/index.html`

Add a simulation modal that appears when a user clicks a food desert tract, shows before/after comparison, and displays the AI-generated policy brief.

- [ ] **Step 1: Add modal CSS**

Add before the closing `</style>` tag:
```css
/* Simulation Modal */
.sim-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:2000; align-items:center; justify-content:center; }
.sim-overlay.show { display:flex; }
.sim-modal { background:#1a1d27; border:1px solid #2d3148; border-radius:12px; width:480px; max-height:85vh; overflow-y:auto; padding:24px; position:relative; }
.sim-modal::-webkit-scrollbar { width:3px; } .sim-modal::-webkit-scrollbar-thumb { background:#2d3148; border-radius:2px; }
.sim-close { position:absolute; top:12px; right:14px; background:none; border:none; color:#718096; font-size:18px; cursor:pointer; }
.sim-close:hover { color:#e2e8f0; }
.sim-title { font-size:16px; font-weight:700; color:#d6bcfa; margin-bottom:4px; }
.sim-subtitle { font-size:11px; color:#718096; margin-bottom:16px; }
.sim-compare { display:grid; grid-template-columns:1fr 40px 1fr; gap:8px; margin-bottom:16px; }
.sim-card { background:#13151f; border:1px solid #2d3148; border-radius:8px; padding:12px; }
.sim-card-label { font-size:9px; text-transform:uppercase; letter-spacing:0.06em; color:#718096; margin-bottom:8px; font-weight:600; }
.sim-card.before .sim-card-label { color:#fc8181; }
.sim-card.after .sim-card-label { color:#48bb78; }
.sim-metric { margin-bottom:6px; }
.sim-metric-name { font-size:10px; color:#718096; }
.sim-metric-val { font-size:16px; font-weight:700; }
.sim-arrow { display:flex; align-items:center; justify-content:center; font-size:20px; color:#718096; }
.sim-impact { background:linear-gradient(135deg,#1a4731 0%,#13151f 100%); border:1px solid #276749; border-radius:8px; padding:12px; margin-bottom:16px; }
.sim-impact-title { font-size:11px; font-weight:700; color:#48bb78; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:6px; }
.sim-impact-stat { font-size:13px; color:#e2e8f0; margin-bottom:3px; }
.sim-impact-stat b { color:#76e09e; }
.sim-brief { background:#13151f; border:1px solid #2d3148; border-radius:8px; padding:14px; margin-bottom:12px; }
.sim-brief-title { font-size:11px; font-weight:700; color:#d6bcfa; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:8px; }
.sim-brief-text { font-size:12px; line-height:1.7; color:#a0aec0; white-space:pre-wrap; }
.sim-brief-loading { color:#718096; font-size:12px; }
.sim-controls { display:flex; gap:8px; align-items:center; margin-bottom:16px; }
.sim-controls label { font-size:11px; color:#718096; }
.sim-controls select { background:#13151f; border:1px solid #2d3148; border-radius:5px; color:#e2e8f0; padding:4px 8px; font-size:12px; }
.sim-controls button { background:#276749; border:none; border-radius:6px; padding:6px 14px; color:#fff; font-size:12px; font-weight:600; cursor:pointer; }
.sim-controls button:hover { background:#2f855a; }
.sim-controls button:disabled { background:#2d3148; color:#718096; cursor:wait; }
.sim-badge { display:inline-block; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:600; }
.sim-badge.desert { background:rgba(229,62,62,0.15); color:#fc8181; }
.sim-badge.severe { background:rgba(155,44,44,0.2); color:#fc8181; }
.sim-badge.adequate { background:rgba(72,187,120,0.15); color:#48bb78; }
.sim-badge.low-access { background:rgba(237,137,54,0.15); color:#ed8936; }
.sim-badge.low-income { background:rgba(236,201,75,0.15); color:#ecc94b; }
.sim-gpu-tag { display:flex; align-items:center; gap:6px; font-size:10px; color:#76e09e; margin-top:8px; padding:6px 10px; background:rgba(118,224,158,0.06); border:1px solid rgba(118,224,158,0.15); border-radius:6px; }
```

- [ ] **Step 2: Add modal HTML**

Add just before `</body>`:
```html
<div class="sim-overlay" id="sim-overlay">
  <div class="sim-modal">
    <button class="sim-close" onclick="closeSimulation()">&times;</button>
    <div class="sim-title" id="sim-title">What If — Intervention Simulator</div>
    <div class="sim-subtitle" id="sim-subtitle">Tract ...</div>
    <div class="sim-controls">
      <label>Add</label>
      <select id="sim-count">
        <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="5">5</option>
      </select>
      <label>grocery store(s)</label>
      <button id="sim-run-btn" onclick="runSimulation()">Simulate</button>
    </div>
    <div id="sim-results"></div>
  </div>
</div>
```

- [ ] **Step 3: Add simulation JavaScript**

Add before the closing `</script>` tag:
```javascript
  // ─── What-If Intervention Simulator ──────────────────────────────
  let simGeoid = null;

  function classLabel(c) { return (c||'unknown').replace(/_/g,' ').replace(/\b\w/g,x=>x.toUpperCase()); }
  function classBadge(c) {
    let cls = 'low-access';
    if (c.includes('severe')) cls = 'severe';
    else if (c.includes('desert')) cls = 'desert';
    else if (c === 'adequate') cls = 'adequate';
    else if (c.includes('income')) cls = 'low-income';
    return `<span class="sim-badge ${cls}">${classLabel(c)}</span>`;
  }

  function openSimulation(geoid, props) {
    simGeoid = geoid;
    document.getElementById('sim-title').textContent = 'What If — Intervention Simulator';
    document.getElementById('sim-subtitle').textContent = `Tract ${geoid.slice(-6)} · Pop ${(props.total_population||0).toLocaleString()} · ${classLabel(props.classification)}`;
    document.getElementById('sim-results').innerHTML = '<div style="color:#718096;font-size:12px;padding:20px 0;text-align:center">Click "Simulate" to model placing a grocery store in this tract.</div>';
    document.getElementById('sim-overlay').classList.add('show');
  }

  function closeSimulation() {
    document.getElementById('sim-overlay').classList.remove('show');
    simGeoid = null;
  }

  async function runSimulation() {
    if (!simGeoid) return;
    const count = parseInt(document.getElementById('sim-count').value);
    const btn = document.getElementById('sim-run-btn');
    const resultsEl = document.getElementById('sim-results');
    btn.disabled = true; btn.textContent = 'Computing on GPU...';
    resultsEl.innerHTML = '<div style="color:#718096;font-size:12px;padding:20px 0;text-align:center">Running simulation + generating policy brief on DGX Spark...</div>';

    try {
      const resp = await fetch('/api/simulate', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ geoid: simGeoid, new_businesses: count })
      });
      const data = await resp.json();
      if (data.error) { resultsEl.innerHTML = `<div style="color:#fc8181;font-size:12px;padding:20px">${data.error}</div>`; return; }

      const b = data.before, a = data.after, impact = data.impact;

      resultsEl.innerHTML = `
        <div class="sim-compare">
          <div class="sim-card before">
            <div class="sim-card-label">Before</div>
            <div class="sim-metric"><div class="sim-metric-name">Classification</div>${classBadge(b.classification)}</div>
            <div class="sim-metric"><div class="sim-metric-name">Food Businesses</div><div class="sim-metric-val" style="color:#fc8181">${b.food_biz_count}</div></div>
            <div class="sim-metric"><div class="sim-metric-name">Per 1k Residents</div><div class="sim-metric-val" style="color:#fc8181">${b.biz_per_1k_pop}</div></div>
          </div>
          <div class="sim-arrow">→</div>
          <div class="sim-card after">
            <div class="sim-card-label">After</div>
            <div class="sim-metric"><div class="sim-metric-name">Classification</div>${classBadge(a.classification)}</div>
            <div class="sim-metric"><div class="sim-metric-name">Food Businesses</div><div class="sim-metric-val" style="color:#48bb78">${a.food_biz_count}</div></div>
            <div class="sim-metric"><div class="sim-metric-name">Per 1k Residents</div><div class="sim-metric-val" style="color:#48bb78">${a.biz_per_1k_pop}</div></div>
          </div>
        </div>
        <div class="sim-impact">
          <div class="sim-impact-title">Impact Summary</div>
          <div class="sim-impact-stat"><b>${impact.total_people_impacted.toLocaleString()}</b> residents impacted</div>
          <div class="sim-impact-stat"><b>${impact.deserts_resolved}</b> food desert(s) resolved</div>
          <div class="sim-impact-stat"><b>${data.neighbors_affected.length}</b> neighboring tract(s) improved</div>
          ${impact.classification_change ? `<div class="sim-impact-stat">Status: ${classLabel(impact.before_classification)} → <b>${classLabel(impact.after_classification)}</b></div>` : ''}
        </div>
        <div class="sim-brief">
          <div class="sim-brief-title">AI Policy Brief — Generated by Nemotron on DGX Spark</div>
          <div class="sim-brief-text">${data.policy_brief || 'Policy brief unavailable.'}</div>
        </div>
        <div class="sim-gpu-tag">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>
          Computed locally on NVIDIA DGX Spark · No data left this device
        </div>
      `;
    } catch(e) {
      resultsEl.innerHTML = `<div style="color:#fc8181;font-size:12px;padding:20px">Error: ${e.message}</div>`;
    } finally {
      btn.disabled = false; btn.textContent = 'Simulate';
    }
  }

  // Close modal on overlay click
  document.getElementById('sim-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeSimulation();
  });
```

- [ ] **Step 4: Wire simulation trigger into the food desert tract click handler**

In the existing `render(geojson)` function inside `toggleDesertLayer()`, modify the `onEachFeature` callback to add a "Simulate Intervention" link in the tract popup that opens the simulation modal:

Replace the current `onEachFeature` line:
```javascript
onEachFeature: (f, layer) => layer.bindPopup(tractPopup(f.properties), { maxWidth: 260 })
```

With:
```javascript
onEachFeature: (f, layer) => {
  const p = f.properties;
  const extra = (p.is_food_desert || p.is_low_access)
    ? `<div style="margin-top:8px"><span class="popup-link ask" onclick="openSimulation('${p.geoid}',${JSON.stringify({total_population:p.total_population,classification:p.classification})})">Simulate Intervention →</span></div>`
    : '';
  layer.bindPopup(tractPopup(p) + extra, { maxWidth: 260 });
}
```

- [ ] **Step 5: Test the full flow**

1. Start the server: `cd /home/nvidia/safeeats && python3 app.py`
2. Open browser to `http://localhost:5000`
3. Click "Food Deserts" tab → map shows choropleth
4. Click a red/dark-red food desert tract → popup shows "Simulate Intervention →" link
5. Click link → modal opens
6. Click "Simulate" → before/after comparison appears + policy brief

---

### Task 4: Polish and Demo-Ready Touches

**Files:**
- Modify: `/home/nvidia/safeeats/templates/index.html`

- [ ] **Step 1: Add a "What-If Simulator" button to the map controls**

Add after the crime overlay button in the map controls div:
```html
<div class="map-btn" id="sim-info-btn" onclick="alert('Click any food desert or low-access tract on the map to simulate placing a grocery store. Enable the Food Deserts layer first.')" style="background:rgba(214,188,250,0.1);border-color:#a78bfa;color:#d6bcfa">What-If Simulator</div>
```

- [ ] **Step 2: Verify the app runs end-to-end without errors**

Run: `cd /home/nvidia/safeeats && python3 -c "from app import app; print('App loads OK')"`

- [ ] **Step 3: Commit**

```bash
cd /home/nvidia/safeeats
git add simulate.py app.py templates/index.html
git commit -m "feat: add What-If Intervention Simulator with AI policy briefs"
```
