"use client";

import { useState, useEffect } from "react";
import type { Stats } from "@/types";

export function useStats() {
  const [stats, setStats] = useState<Stats>({
    green: 0,
    yellow: 0,
    red: 0,
    total: 0,
    unscored: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => {
        setStats({
          green: data.green ?? data.safe ?? 0,
          yellow: data.yellow ?? data.fair ?? 0,
          red: data.red ?? data.poor ?? 0,
          total: data.total ?? 0,
          unscored: data.unscored ?? 0,
        });
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { stats, loading, error };
}
