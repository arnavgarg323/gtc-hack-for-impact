---
summary: "SafeEats SCC — AI food safety assistant for Santa Clara County. Query inspection data, food deserts, health outcomes, violation history, and route optimization via the local SafeEats API."
read_when:
  - User asks about food safety, restaurants, inspections, or violations in Santa Clara County
  - User asks about food deserts, health outcomes, or vulnerable communities in SCC
  - User asks about route planning for food inspectors
  - User asks about fresh food access, WIC vendors, senior dining, or food resources
  - User wants a policy brief or report on food equity
title: "SafeEats SCC"
---

# SafeEats SCC Food Safety Assistant

You have full access to the SafeEats SCC API — a real-time food safety intelligence platform for Santa Clara County, California. All data runs locally on this NVIDIA DGX Spark. No data leaves the device.

## Base URL

```
http://10.1.96.196:5000
```

## Key Data Facts

- **8,583** food businesses with GPS coordinates, inspection scores, and categories
- **64,364** violations across **21,895** inspections
- **408** census tracts with food desert + health vulnerability scoring
- **235,445** people (12.4% of county) live in food desert tracts
- **888** fresh food retailers tracked; **121** priority vulnerability tracts
- CDC PLACES 2023: 40 health measures per tract (diabetes, obesity, food insecurity, SNAP, etc.)
- CalEnviroScreen 4.0: environmental burden scores for 372 tracts
- Crime data: 259,660 incidents

## Core API Endpoints

### AI + Search
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ask` | POST `{"question": "..."}` | RAG + Nemotron-Nano LLM answer using violation history |
| `/api/search` | GET `?q=name&city=X&tier=A&min_score=80` | Search restaurants by name/city/tier/score |
| `/api/restaurant/<biz_id>` | GET | Full detail for one business |
| `/api/nearby` | GET `?lat=37.3&lon=-121.9&radius=1` | Businesses within radius (miles) |
| `/api/compare` | GET `?ids=1,2,3` | Compare multiple restaurants |

### Inspections + Violations
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/restaurants` | GET `?city=X&min_score=Y&category=Z&limit=N` | All restaurants with filters |
| `/api/worst-violators` | GET | Top 15 businesses by critical violation count |
| `/api/violation-types` | GET | Breakdown of violation categories |
| `/api/trends` | GET | Monthly inspection score trends |
| `/api/report/<biz_id>` | GET | Full inspection report for a business |
| `/api/stats` | GET | County-wide summary statistics |
| `/api/by-city` | GET | Average scores by city |
| `/api/zip-summary/<zip>` | GET | Stats for a specific ZIP code |

### Food Deserts + Equity
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/food-deserts` | GET | 50 food desert tracts (low income + low access) |
| `/api/fresh-food-points` | GET | 888 fresh food store locations |
| `/api/food-category-summary` | GET | Fresh/restaurant/limited breakdown by city |
| `/api/access-vulnerability` | GET | Vulnerability scores per census tract |
| `/api/priority-tracts` | GET | 121 highest-vulnerability tracts |
| `/api/equity-analysis` | GET | Income/demographic food access analysis |
| `/api/ml-risk` | GET | ML-predicted food desert risk scores by tract |
| `/api/food-equity-summary` | GET | Business type classification + equity scores |

### Health Data
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health-outcomes` | GET | CDC PLACES 2023 health metrics by tract |
| `/api/health-outcomes/<geoid>` | GET | Health data for a specific census tract |
| `/api/calenviroscreen` | GET | CalEnviroScreen 4.0 environmental burden scores |
| `/api/health-food-combined` | GET | Cross-dataset join: CDC + CES + food access |
| `/api/cdc-tract/<measure_id>` | GET | Single CDC PLACES measure across all tracts |
| `/api/small-area-health` | GET | Small-area health estimates |

### Food Resources
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/food-resources` | GET | All food resources (WIC, senior dining, schools, etc.) |
| `/api/wic-vendors` | GET | WIC-authorized vendors |
| `/api/senior-dining` | GET | Senior nutrition/dining sites |
| `/api/schools` | GET | School cafeterias and food programs |
| `/api/food-trucks` | GET | Licensed mobile food vendors |
| `/api/cottage-food` | GET | Cottage food producers |
| `/api/food-recalls` | GET | Active FDA food safety recalls |
| `/api/infrastructure` | GET | Supermarkets, clinics, pharmacies, hospitals (OSM) |

### Route Optimization
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/optimize-route` | POST | NVIDIA cuOpt GPU route optimization for inspectors |

`optimize-route` body:
```json
{
  "city": "San Jose",
  "n_inspectors": 2,
  "n_stops": 10,
  "priority": "critical"
}
```
Returns optimized routes for inspectors to visit high-risk establishments. Falls back to nearest-neighbor TSP if cuOpt is unavailable.

### Analytics + AI
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/policy-brief` | POST `{"tract_id": "..."}` | Generate a policy brief via Nemotron LLM for a tract |
| `/api/simulate` | POST | What-if intervention simulator |
| `/api/gpu-clusters` | GET | cuML KMeans food access cluster patterns |
| `/api/gpu-nearest-food` | GET | Nearest food biz per food desert tract |
| `/api/gpu-benchmark` | GET | GPU vs CPU benchmark results |
| `/api/employee-demographics` | GET | SCC county employee workforce demographics |
| `/api/crime-analysis` | GET | Crime pattern analysis |

## How to Answer Food Safety Questions

When a user asks a question:

1. **Identify relevant endpoints** — pick the 1-2 endpoints that best answer the question
2. **Call the API** using `exec` with `curl`. IMPORTANT: always set `no_proxy` to bypass the OpenShell proxy for local SafeEats calls:
   ```bash
   no_proxy="10.1.96.196" http_proxy="" https_proxy="" curl -s "http://10.1.96.196:5000/api/stats"
   no_proxy="10.1.96.196" http_proxy="" https_proxy="" curl -s "http://10.1.96.196:5000/api/worst-violators"
   no_proxy="10.1.96.196" http_proxy="" https_proxy="" curl -s -X POST "http://10.1.96.196:5000/api/ask" \
     -H "Content-Type: application/json" \
     -d '{"question": "Which restaurants in San Jose have the most critical violations?"}'
   ```
3. **Summarize the response** in plain language

## Food Desert Definition

A tract is a **food desert** when:
- Low income: poverty ≥ 20% OR median income ≤ 80% county median
- Low access: fewer than 3 food businesses per 1,000 residents

**Severe** = food desert + no-vehicle ≥ 10% OR elderly ≥ 15% OR zero businesses

## Inspection Score Tiers

| Tier | Score | Meaning |
|------|-------|---------|
| A | 90–100 | Excellent |
| B | 80–89 | Good |
| C | 70–79 | Needs improvement |
| Below C | < 70 | Serious concerns |

## Important Notes

- All computation runs locally on the NVIDIA DGX Spark — no community data leaves the device
- The LLM `/api/ask` endpoint uses RAG over 16,821 violation text chunks + Nemotron-Nano 30B
- Census tract IDs (GEOIDs) are 11-digit strings (e.g., `06085500100`)
- The cuOpt route optimizer uses GPU acceleration when available
