#!/usr/bin/env python3
import re
from pathlib import Path
from urllib.request import urlretrieve

import geopandas as gpd
import pandas as pd


DATA_DIR = Path("/home/nvidia/data")
BUSINESS_CSV = DATA_DIR / "SCC_DEH_Food_Data_BUSINESS_20260306.csv"
TRACT_CSV = DATA_DIR / "Santa_Clara_County_ACS_2024_tract_demographics.csv"
BLOCK_GROUP_CSV = DATA_DIR / "Santa_Clara_County_ACS_2024_block_group_demographics.csv"

TRACT_SHAPE_URL = "zip://https://www2.census.gov/geo/tiger/TIGER2024/TRACT/tl_2024_06_tract.zip"
BLOCK_GROUP_SHAPE_URL = "zip://https://www2.census.gov/geo/tiger/TIGER2024/BG/tl_2024_06_bg.zip"
TRACT_SHAPE_HTTP_URL = "https://www2.census.gov/geo/tiger/TIGER2024/TRACT/tl_2024_06_tract.zip"
BLOCK_GROUP_SHAPE_HTTP_URL = "https://www2.census.gov/geo/tiger/TIGER2024/BG/tl_2024_06_bg.zip"


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().upper())


def classify_business(name: str) -> tuple[str, int]:
    text = clean_text(name)

    fresh_patterns = [
        r"\bMARKET\b",
        r"\bGROCERY\b",
        r"\bSUPERMARKET\b",
        r"\bFOODS\b",
        r"\bPRODUCE\b",
        r"\bFARMERS?\b",
        r"\bFRUIT\b",
        r"\bVEGETABLE\b",
        r"\bMEAT\b",
        r"\bSEAFOOD\b",
        r"\bDELI\b",
        r"\bBAKERY\b",
    ]
    limited_patterns = [
        r"\bLIQUOR\b",
        r"\b7-ELEVEN\b",
        r"\bCHEVRON\b",
        r"\bSHELL\b",
        r"\bARCO\b",
        r"\bEXXON\b",
        r"\bMOBIL\b",
        r"\bAMPM\b",
        r"\bCONVENIENCE\b",
        r"\bMINI MART\b",
        r"\bSMOKE SHOP\b",
    ]
    restaurant_patterns = [
        r"\bRESTAURANT\b",
        r"\bCAFE\b",
        r"\bGRILL\b",
        r"\bKITCHEN\b",
        r"\bPIZZA\b",
        r"\bSUSHI\b",
        r"\bBURGER\b",
        r"\bTAQUERIA\b",
        r"\bTACOS?\b",
        r"\bNOODLE\b",
        r"\bBBQ\b",
        r"\bBAR\b",
        r"\bBISTRO\b",
    ]

    if any(re.search(pattern, text) for pattern in fresh_patterns):
        return "fresh_food_retail", 1
    if any(re.search(pattern, text) for pattern in limited_patterns):
        return "limited_fresh_food_retail", 0
    if any(re.search(pattern, text) for pattern in restaurant_patterns):
        return "restaurant_or_prepared_food", 0
    return "other_food_business", 0


def load_businesses() -> gpd.GeoDataFrame:
    businesses = pd.read_csv(BUSINESS_CSV)
    businesses = businesses.rename(
        columns={
            "CITY": "city",
            "STATE": "state",
            "Geo_Address": "geo_address",
        }
    )
    businesses = businesses[
        [
            "business_id",
            "name",
            "address",
            "city",
            "state",
            "postal_code",
            "latitude",
            "longitude",
            "phone_number",
        ]
    ].copy()
    businesses["latitude"] = pd.to_numeric(businesses["latitude"], errors="coerce")
    businesses["longitude"] = pd.to_numeric(businesses["longitude"], errors="coerce")
    businesses = businesses.dropna(subset=["latitude", "longitude"]).copy()
    businesses["name_clean"] = businesses["name"].fillna("").map(clean_text)

    classifications = businesses["name"].fillna("").map(classify_business)
    businesses["business_category"] = classifications.map(lambda item: item[0])
    businesses["fresh_food_likely"] = classifications.map(lambda item: item[1]).astype(int)

    return gpd.GeoDataFrame(
        businesses,
        geometry=gpd.points_from_xy(businesses["longitude"], businesses["latitude"]),
        crs="EPSG:4326",
    )


def ensure_download(url: str, destination: Path) -> Path:
    if not destination.exists():
        urlretrieve(url, destination)
    return destination


def load_boundaries(url: str, destination: Path, county_column: str) -> gpd.GeoDataFrame:
    local_zip = ensure_download(url, destination)
    gdf = gpd.read_file(f"zip://{local_zip}")
    gdf = gdf[gdf[county_column] == "085"].copy()
    return gdf.to_crs("EPSG:4326")


def build_business_join(
    businesses: gpd.GeoDataFrame,
    tracts: gpd.GeoDataFrame,
    block_groups: gpd.GeoDataFrame,
    tract_demo: pd.DataFrame,
    bg_demo: pd.DataFrame,
) -> pd.DataFrame:
    tract_join = gpd.sjoin(
        businesses,
        tracts[["GEOID", "NAMELSAD", "geometry"]].rename(
            columns={"GEOID": "tract_geoid", "NAMELSAD": "tract_label"}
        ),
        how="left",
        predicate="within",
    )
    tract_join = tract_join.drop(columns=["index_right"], errors="ignore")

    bg_join = gpd.sjoin(
        tract_join,
        block_groups[["GEOID", "NAMELSAD", "geometry"]].rename(
            columns={"GEOID": "block_group_geoid", "NAMELSAD": "block_group_label"}
        ),
        how="left",
        predicate="within",
    )
    bg_join = bg_join.drop(columns=["index_right"], errors="ignore")

    joined = pd.DataFrame(bg_join.drop(columns=["geometry"]))
    joined = joined.merge(
        tract_demo.add_prefix("tract_"),
        how="left",
        left_on="tract_geoid",
        right_on="tract_geoid",
    )
    joined = joined.merge(
        bg_demo.add_prefix("block_group_"),
        how="left",
        left_on="block_group_geoid",
        right_on="block_group_geoid",
    )

    keep = [
        "business_id",
        "name",
        "business_category",
        "fresh_food_likely",
        "address",
        "city",
        "state",
        "postal_code",
        "latitude",
        "longitude",
        "phone_number",
        "tract_geoid",
        "tract_label",
        "block_group_geoid",
        "block_group_label",
        "tract_total_population",
        "tract_median_household_income",
        "tract_households_no_vehicle_pct",
        "tract_poverty_rate_pct",
        "block_group_total_population",
        "block_group_median_household_income",
        "block_group_households_no_vehicle_pct",
        "block_group_poverty_rate_pct",
    ]
    return joined[keep].sort_values(["tract_geoid", "block_group_geoid", "name"])


def summarize_by_geography(
    business_join: pd.DataFrame, demo: pd.DataFrame, geoid_col: str, name_col: str, prefix: str
) -> pd.DataFrame:
    grouped = (
        business_join.groupby([geoid_col, name_col], dropna=False)
        .agg(
            total_food_businesses=("business_id", "count"),
            fresh_food_businesses=("fresh_food_likely", "sum"),
            limited_fresh_food_businesses=(
                "business_category",
                lambda values: int((pd.Series(values) == "limited_fresh_food_retail").sum()),
            ),
            restaurant_businesses=(
                "business_category",
                lambda values: int((pd.Series(values) == "restaurant_or_prepared_food").sum()),
            ),
        )
        .reset_index()
    )

    summary = demo.merge(grouped, how="left", left_on="geoid", right_on=geoid_col)
    summary = summary.drop(columns=[col for col in [geoid_col, name_col] if col in summary.columns])
    for col in [
        "total_food_businesses",
        "fresh_food_businesses",
        "limited_fresh_food_businesses",
        "restaurant_businesses",
    ]:
        summary[col] = summary[col].fillna(0).astype(int)

    summary["fresh_food_share"] = (
        summary["fresh_food_businesses"] / summary["total_food_businesses"].replace({0: pd.NA})
    )
    summary["fresh_food_per_1000_people"] = (
        1000 * summary["fresh_food_businesses"] / summary["total_population"].replace({0: pd.NA})
    )
    summary["food_access_priority_score"] = (
        summary["poverty_rate_pct"].astype(float).fillna(0) * 0.45
        + summary["households_no_vehicle_pct"].astype(float).fillna(0) * 0.35
        + (1 / summary["fresh_food_per_1000_people"].replace({0: pd.NA})).fillna(5) * 0.20
    )

    ordered = [
        "geoid",
        "name",
        "total_population",
        "median_household_income",
        "poverty_rate_pct",
        "households_no_vehicle_pct",
        "total_food_businesses",
        "fresh_food_businesses",
        "limited_fresh_food_businesses",
        "restaurant_businesses",
        "fresh_food_share",
        "fresh_food_per_1000_people",
        "food_access_priority_score",
    ]
    summary = summary[ordered].sort_values("food_access_priority_score", ascending=False)
    output = DATA_DIR / f"santa_clara_{prefix}_food_access_summary.csv"
    summary.to_csv(output, index=False)
    return summary


def main() -> None:
    tract_demo = pd.read_csv(TRACT_CSV, dtype={"geoid": str, "tract": str})
    bg_demo = pd.read_csv(BLOCK_GROUP_CSV, dtype={"geoid": str, "tract": str, "block_group": str})

    businesses = load_businesses()
    tracts = load_boundaries(TRACT_SHAPE_HTTP_URL, DATA_DIR / "tl_2024_06_tract.zip", "COUNTYFP")
    block_groups = load_boundaries(
        BLOCK_GROUP_SHAPE_HTTP_URL,
        DATA_DIR / "tl_2024_06_bg.zip",
        "COUNTYFP",
    )

    business_join = build_business_join(businesses, tracts, block_groups, tract_demo, bg_demo)
    business_join.to_csv(DATA_DIR / "santa_clara_food_businesses_with_census.csv", index=False)

    business_clean = business_join[
        [
            "business_id",
            "name",
            "business_category",
            "fresh_food_likely",
            "address",
            "city",
            "postal_code",
            "latitude",
            "longitude",
            "tract_geoid",
            "block_group_geoid",
        ]
    ].copy()
    business_clean.to_csv(DATA_DIR / "santa_clara_food_businesses_clean.csv", index=False)

    summarize_by_geography(business_join, tract_demo.copy(), "tract_geoid", "tract_label", "tract")
    summarize_by_geography(
        business_join,
        bg_demo.copy(),
        "block_group_geoid",
        "block_group_label",
        "block_group",
    )


if __name__ == "__main__":
    main()
