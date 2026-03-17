#!/bin/bash
# ──────────────────────────────────────────────────────────────────
# SafeEats GPU Analysis — Pause vLLM, run cuML, restart vLLM
# Run this script to generate GPU-accelerated analysis results.
# vLLM will be unavailable for ~3-5 minutes while the model reloads.
# ──────────────────────────────────────────────────────────────────
set -e

echo "=== SafeEats GPU Analysis (NVIDIA DGX Spark) ==="
echo "Pausing vLLM to free GPU memory..."
docker pause nemotron-nano

echo "Running cuML + cuDF analysis..."
LIBCUDF_CUFILE_POLICY=OFF python3 /home/nvidia/safeeats/backend/gpu_analysis.py

echo "Resuming vLLM..."
docker unpause nemotron-nano

echo "GPU analysis complete! Results in /home/nvidia/safeeats/backend/data/gpu_*.json"
echo "Restart the Flask app to pick up new data: kill \$(pgrep -f app.py) && nohup python3 /home/nvidia/safeeats/backend/app.py &"
