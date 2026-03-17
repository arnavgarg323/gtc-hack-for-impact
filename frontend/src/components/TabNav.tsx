"use client";

export type TabId =
  | "chat"
  | "deserts"
  | "violators"
  | "cities"
  | "search"
  | "trends"
  | "equity"
  | "workforce"
  | "culture"
  | "gpu"
  | "mlrisk"
  | "routes"
  | "freshfood"
  | "healthdata"
  | "resources"
  | "recalls"
  | "vision";

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: "chat", label: "Ask AI" },
  { id: "deserts", label: "Deserts" },
  { id: "violators", label: "Violators" },
  { id: "cities", label: "By City" },
  { id: "search", label: "Search" },
  { id: "trends", label: "Trends" },
  { id: "equity", label: "Equity" },
  { id: "workforce", label: "Workforce" },
  { id: "culture", label: "Culture" },
  { id: "gpu", label: "GPU" },
  { id: "mlrisk", label: "ML Risk" },
  { id: "routes", label: "Routes" },
  { id: "freshfood", label: "Fresh Food" },
  { id: "healthdata", label: "Health Data" },
  { id: "resources", label: "Resources" },
  { id: "recalls", label: "🚨 Recalls" },
  { id: "vision", label: "👁 Vision AI" },
];

interface TabNavProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export default function TabNav({ active, onChange }: TabNavProps) {
  return (
    <div
      style={{
        display: "flex",
        overflowX: "auto",
        background: "var(--bg-panel)",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
        scrollbarWidth: "none",
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: "9.5px",
              fontWeight: isActive ? 600 : 400,
              letterSpacing: "0.8px",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              padding: "10px 12px",
              borderRadius: 0,
              color: isActive ? "var(--accent)" : "var(--text-muted)",
              background: isActive ? "var(--accent-dim)" : "transparent",
              borderBottom: isActive
                ? "2px solid var(--accent)"
                : "2px solid transparent",
              transition: "all 0.15s",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--text-secondary)";
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(255,255,255,0.03)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--text-muted)";
                (e.currentTarget as HTMLButtonElement).style.background =
                  "transparent";
              }
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
