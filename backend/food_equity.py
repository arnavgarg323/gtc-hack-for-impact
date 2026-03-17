#!/usr/bin/env python3
"""
SafeEats SCC — Food Equity Analysis
Classifies food businesses by type (grocery, fast food, convenience, liquor, institutional, restaurant)
and computes a Food Equity Score per census tract.

Key insight: In Santa Clara County, institutional food (tech campus cafeterias, school kitchens)
inflates apparent food access for some tracts — but these aren't publicly accessible.
The Food Equity Score uses only *public* food and weights by type quality.
"""

import pandas as pd
import json
import os

DATA_DIR = "/home/nvidia/safeeats/data"

# ── Business type keyword rules ──────────────────────────────────────────────

GROCERY_KW = [
    'SAFEWAY', 'WHOLE FOODS', 'TRADER JOE', 'COSTCO', 'WALMART', 'TARGET',
    'KROGER', 'ALBERTSONS', 'CARDENAS', 'RANCH 99', 'H MART', 'NIJIYA',
    'MITSUWA', 'SPROUTS', 'GROCERY', 'SUPERMARKET', 'HYPERMARKET', 'MERCADO',
    'CARNICERIA', 'SUPER TIENDA', 'FOOD MARKET', 'INDIA METRO', 'PRODUCE',
    'BODEGA', 'SUPERMERCADO', 'TIENDA', 'ASIAN MARKET', 'ETHNIC MARKET',
    'RANCH MARKET', 'FOOD BAZAAR', 'KUSAN BAZAAR', 'FOOD CITY',
]

FAST_FOOD_KW = [
    "MCDONALD'S", 'MCDONALD', 'TACO BELL', 'JACK IN THE BOX', 'BURGER KING',
    'WENDYS', "WENDY'S", 'KFC', 'KENTUCKY FRIED', 'SUBWAY', 'CHIPOTLE',
    'EL POLLO LOCO', "CARL'S JR", 'CARLS JR', 'CHICK-FIL', 'PANDA EXPRESS',
    "DOMINO'S", 'DOMINOS', 'PIZZA HUT', 'PAPA JOHN', 'ROUND TABLE PIZZA',
    'IN-N-OUT', 'INNOUT', 'FIVE GUYS', 'HABIT BURGER', 'SMASHBURGER',
    'WINGSTOP', 'RAISING CANE', 'SONIC ', 'ARBYS', "ARBY'S", 'POPEYES',
    "POPEYE'S", 'DEL TACO', 'PANERA', 'STARBUCKS', 'DUTCH BROS',
    'LITTLE CAESAR', 'LITTLE CAESARS', "DENNY'S", 'DENNYS', 'IHOP',
    'APPLEBEE', 'CHILIS', "CHILI'S", 'OLIVE GARDEN', 'RED LOBSTER',
    'OUTBACK', 'BUFFALO WILD WINGS', 'JAMBA JUICE', 'BASKIN-ROBBINS',
    'BASKIN ROBBINS', 'DAIRY QUEEN', 'AUNTIE ANNE', 'WETZEL', 'CINNABON',
]

LIQUOR_KW = [
    'LIQUOR', 'SPIRITS', 'BOTTLE SHOP', 'WINE SHOP', 'BEER AND WINE',
    'DISCOUNT LIQUOR', 'LIQUORS',
]

CONVENIENCE_KW = [
    '7-ELEVEN', '7 ELEVEN', 'SHELL ', 'CHEVRON', 'ARCO', 'CIRCLE K',
    'MINI MART', 'FOOD MART', 'GAS STATION', 'CVS/PHARMACY', 'CVS PHARMACY',
    'WALGREEN', 'RITE AID', 'DOLLAR TREE', 'DOLLAR GENERAL', 'QUICK STOP',
    'QUICK MART', 'FAST STOP', 'AM/PM', 'AMPM', 'FUEL', 'PETRO',
    'VALERO', 'MOBIL', '76 GAS', 'UNION 76',
]

INSTITUTIONAL_KW = [
    'SCHOOL', 'UNIVERSITY', 'COLLEGE', 'HOSPITAL', 'SENIOR CENTER',
    'NURSING HOME', 'NURSING CENTER', 'ASSISTED LIVING', 'CAFETERIA',
    'GOOGLE ', 'APPLE PARK', 'AMAZON -', 'LINKEDIN', 'CISCO -',
    'ARAMARK', 'BON APPETIT', 'SODEXO', 'THOMAS CUISINE', 'STADIUM',
    'ARENA', 'LEVI STADIUM', 'SAP CENTER', 'COUNTRY CLUB', 'GOLF CLUB',
    'ELKS LODGE', 'COMMUNITY CENTER', 'DAY CARE', 'DAYCARE',
    'CORRECTIONAL', 'DETENTION', 'JAIL', 'KAISER', 'O\'CONNOR HOSPITAL',
    'GOOD SAMARITAN', 'REGIONAL MEDICAL',
]


def classify_business(name: str) -> str:
    """Classify a food business by type from its name."""
    n = str(name).upper()
    if any(k in n for k in GROCERY_KW):
        return 'grocery'
    if any(k in n for k in FAST_FOOD_KW):
        return 'fast_food'
    if any(k in n for k in LIQUOR_KW):
        return 'liquor'
    if any(k in n for k in CONVENIENCE_KW):
        return 'convenience'
    if any(k in n for k in INSTITUTIONAL_KW):
        return 'institutional'
    return 'restaurant_cafe'


def compute_food_equity_scores() -> pd.DataFrame:
    """
    Classify all food businesses and compute per-tract Food Equity Scores.

    Food Equity Score (0–100) weights:
      +50 pts: grocery ratio among public food (rewards healthy access)
      +30 pts: public food density (access, capped at 10 per 1k pop)
      -10 pts: fast food concentration penalty
      -10 pts: liquor store presence penalty

    Returns a DataFrame with geoid + food equity columns.
    """
    biz = pd.read_csv(f"{DATA_DIR}/businesses_clean.csv")
    biz['name'] = biz['name'].fillna('')
    biz['food_type'] = biz['name'].apply(classify_business)
    # Normalize geoid: businesses_clean stores as int (missing leading zero)
    biz['tract_geoid'] = biz['tract_geoid'].astype(str).str.zfill(11)

    tracts = pd.read_csv(f"{DATA_DIR}/food_access_tracts.csv")
    tracts['geoid'] = tracts['geoid'].astype(str).str.zfill(11)

    # Per-tract counts by type
    type_counts = (
        biz.groupby(['tract_geoid', 'food_type'])
        .size()
        .unstack(fill_value=0)
        .reset_index()
    )
    type_counts.columns.name = None
    type_counts = type_counts.rename(columns={'tract_geoid': 'geoid'})

    for col in ['grocery', 'fast_food', 'liquor', 'convenience', 'institutional', 'restaurant_cafe']:
        if col not in type_counts.columns:
            type_counts[col] = 0

    merged = tracts.merge(type_counts, on='geoid', how='left').fillna(0)

    # Public food = excludes institutional
    merged['public_food_count'] = (
        merged['grocery'] + merged['fast_food'] + merged['liquor'] +
        merged['convenience'] + merged['restaurant_cafe']
    )
    safe_public = merged['public_food_count'].replace(0, 1)

    # Ratios among public food only
    merged['grocery_pct'] = (merged['grocery'] / safe_public * 100).round(1)
    merged['fast_food_pct'] = (merged['fast_food'] / safe_public * 100).round(1)
    merged['liquor_pct'] = (merged['liquor'] / safe_public * 100).round(1)
    merged['institutional_pct'] = (
        merged['institutional'] / merged['food_biz_count'].replace(0, 1) * 100
    ).round(1)

    # Public food density per 1k residents
    merged['public_biz_per_1k'] = (
        merged['public_food_count'] / merged['total_population'].replace(0, 1) * 1000
    ).round(2)

    # Food Equity Score
    merged['food_equity_score'] = (
        (merged['grocery_pct'] * 0.5) +                          # grocery mix (0-50)
        (merged['public_biz_per_1k'].clip(0, 10) * 3.0) +        # access (0-30)
        (-(merged['fast_food_pct'] * 0.1)) +                     # fast food penalty (0-10)
        (-(merged['liquor'].clip(0, 5) * 2.0))                   # liquor penalty (0-10)
    ).clip(0, 100).round(1)

    # Food equity tier
    def equity_tier(score):
        if score >= 50:
            return 'high_equity'
        elif score >= 25:
            return 'moderate_equity'
        elif score >= 10:
            return 'low_equity'
        else:
            return 'critical_equity_gap'

    merged['equity_tier'] = merged['food_equity_score'].apply(equity_tier)

    return merged[[
        'geoid', 'grocery', 'fast_food', 'liquor', 'convenience',
        'institutional', 'restaurant_cafe', 'public_food_count',
        'grocery_pct', 'fast_food_pct', 'liquor_pct', 'institutional_pct',
        'public_biz_per_1k', 'food_equity_score', 'equity_tier',
    ]]


def enrich_geojson_with_equity(equity_df: pd.DataFrame) -> dict:
    """Merge food equity scores into the existing food access GeoJSON."""
    with open(f"{DATA_DIR}/food_access_tracts.geojson") as f:
        geojson = json.load(f)

    equity_map = equity_df.set_index('geoid').to_dict(orient='index')

    for feature in geojson['features']:
        gid = feature['properties']['geoid']
        eq = equity_map.get(gid, {})
        feature['properties']['grocery'] = int(eq.get('grocery', 0))
        feature['properties']['fast_food'] = int(eq.get('fast_food', 0))
        feature['properties']['liquor'] = int(eq.get('liquor', 0))
        feature['properties']['convenience'] = int(eq.get('convenience', 0))
        feature['properties']['institutional'] = int(eq.get('institutional', 0))
        feature['properties']['restaurant_cafe'] = int(eq.get('restaurant_cafe', 0))
        feature['properties']['public_food_count'] = int(eq.get('public_food_count', 0))
        feature['properties']['grocery_pct'] = float(eq.get('grocery_pct', 0))
        feature['properties']['fast_food_pct'] = float(eq.get('fast_food_pct', 0))
        feature['properties']['institutional_pct'] = float(eq.get('institutional_pct', 0))
        feature['properties']['public_biz_per_1k'] = float(eq.get('public_biz_per_1k', 0))
        feature['properties']['food_equity_score'] = float(eq.get('food_equity_score', 0))
        feature['properties']['equity_tier'] = eq.get('equity_tier', 'unknown')

    return geojson


# ── Run if executed directly ─────────────────────────────────────────────────
if __name__ == '__main__':
    print("Computing food equity scores...")
    equity_df = compute_food_equity_scores()

    print(f"\n{'Equity Tier':<25s}  {'Tracts':>6s}  {'Avg Score':>9s}  {'Avg Grocery%':>12s}")
    print(f"  {'-'*25}  {'-'*6}  {'-'*9}  {'-'*12}")
    for tier in ['critical_equity_gap', 'low_equity', 'moderate_equity', 'high_equity']:
        sub = equity_df[equity_df['equity_tier'] == tier]
        if len(sub) == 0:
            continue
        print(f"  {tier:<25s}  {len(sub):>6d}  {sub['food_equity_score'].mean():>9.1f}  {sub['grocery_pct'].mean():>12.1f}%")

    print(f"\nTotal tracts: {len(equity_df)}")
    print(f"Avg food equity score: {equity_df['food_equity_score'].mean():.1f}")
    print(f"Tracts with zero public food: {(equity_df['public_food_count'] == 0).sum()}")

    equity_df.to_csv(f"{DATA_DIR}/food_equity_scores.csv", index=False)
    print(f"\nSaved food_equity_scores.csv")

    enriched = enrich_geojson_with_equity(equity_df)
    with open(f"{DATA_DIR}/food_equity_tracts.geojson", 'w') as f:
        json.dump(enriched, f)
    print("Saved food_equity_tracts.geojson")
