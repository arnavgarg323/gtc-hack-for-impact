# Food Access Map Enhancements — Design Spec
**Date:** 2026-03-17
**File:** `/home/nvidia/data/build_food_access_map_demo.py`

## Overview

Enhance the Santa Clara County fresh-food access map with a heatmap overlay, searchable business list, base tile switcher, and a clean light-mode UI. All changes are confined to the `make_map_html()` function — no Python data processing logic is modified.

## Features

### 1. Fresh-Food Business Density Heatmap

- **Plugin:** `leaflet.heat` (CDN: `https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js`)
- **Data:** Latitude/longitude of all `fresh_food_likely == 1` businesses (already passed as `freshFoodPoints`)
- **Appearance:** Default green→yellow kernel density gradient; radius ~25, blur ~15
- **Layer control:** Toggleable overlay in the existing `L.control.layers` — labeled "Heatmap (business density)"
- **Default state:** On

### 2. Searchable Business List

- **Location:** New panel at the bottom of the sidebar, below the existing panels
- **Input:** `<input type="text" placeholder="Search businesses...">` with real-time `keyup` filtering
- **List:** Scrollable `<ul>` (max-height ~200px) showing business name + city for all fresh-food businesses
- **Interaction:** Clicking a list item calls `map.flyTo([lat, lng], 15)` and opens the corresponding circle marker's popup. Maintain a `markers` array parallel to `freshFoodPoints` so search list items can call `markers[i].openPopup()` after `flyTo`.
- **Filtering:** Case-insensitive match on `name` and `city` fields

### 3. Base Tile Layer Switcher

- **Layers:**
  - OpenStreetMap — `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, attribution `&copy; OpenStreetMap contributors`
  - CartoDB Positron — `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`, attribution `&copy; OpenStreetMap contributors &copy; CARTO`
  - Esri WorldImagery — `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` (note: `{y}/{x}` reversed vs OSM), attribution `Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community`
- **Control:** Added to the existing `L.control.layers` as base layers (radio selection)
- **Default:** CartoDB Positron (pairs best with the light UI)
- **Implementation note:** Remove the existing `L.tileLayer(...).addTo(map)` call. Define all three base layers as `L.tileLayer` instances, add only CartoDB Positron to the map via `.addTo(map)`, and pass all three to `L.control.layers`.

### 4. Light Mode — Clean & Minimal

| Token | Value |
|---|---|
| Background | `#f8f9fa` |
| Sidebar background | `#ffffff` |
| Panel border | `1px solid #e2e8f0` |
| Panel shadow | `0 2px 8px rgba(0,0,0,0.08)` |
| Primary text | `#1a202c` |
| Muted text | `#718096` |
| Font family | `system-ui, -apple-system, sans-serif` |
| Panel border-radius | `10px` |

- Remove warm radial-gradient background
- Remove Georgia serif font
- Legend and popups adopt same white/border/shadow style

## Scope

- **In scope:** `make_map_html()` HTML/CSS/JS only
- **Out of scope:** Python scoring logic, CSV/GeoJSON output, data pipeline

## Acceptance Criteria

1. Heatmap renders on load and can be toggled off via layer control
2. Typing in the search box filters the business list in real-time
3. Clicking a business item flies map to location and opens popup
4. Three base tiles are selectable; CartoDB Positron is default
5. UI is visually clean white/light gray with no warm tints or serif font
