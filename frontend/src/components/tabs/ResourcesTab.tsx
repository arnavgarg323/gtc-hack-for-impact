"use client";

const RESOURCES = [
  {
    category: "Santa Clara County",
    items: [
      { title: "Environmental Health Department", url: "https://ehd.sccgov.org", desc: "Official food safety inspections and permits" },
      { title: "Online Inspection Records", url: "https://www.sccgov.org/sites/ehd/pages/food-establishments.aspx", desc: "Search public inspection reports" },
      { title: "File a Complaint", url: "https://ehd.sccgov.org/complaints", desc: "Report food safety violations" },
    ],
  },
  {
    category: "Food Access",
    items: [
      { title: "Second Harvest of Silicon Valley", url: "https://www.shfb.org", desc: "Largest food bank in Silicon Valley" },
      { title: "Sacred Heart Community Service", url: "https://www.sacredheartcs.org", desc: "Food pantry and SNAP outreach" },
      { title: "CalFresh (SNAP Benefits)", url: "https://www.cdss.ca.gov/calfresh", desc: "Apply for food assistance benefits" },
    ],
  },
  {
    category: "Data Sources",
    items: [
      { title: "CDC PLACES 2023", url: "https://www.cdc.gov/places", desc: "Health outcomes at census tract level" },
      { title: "CalEnviroScreen 4.0", url: "https://oehha.ca.gov/calenviroscreen", desc: "Environmental justice screening tool" },
      { title: "USDA Food Desert Atlas", url: "https://www.ers.usda.gov/data-products/food-access-research-atlas/", desc: "Food access research data" },
    ],
  },
  {
    category: "NVIDIA Technology",
    items: [
      { title: "DGX Spark", url: "https://www.nvidia.com/en-us/products/workstations/dgx-spark/", desc: "Personal AI supercomputer powering SafeEats" },
      { title: "NVIDIA cuOpt", url: "https://developer.nvidia.com/cuopt-logistics-optimization", desc: "GPU-accelerated route optimization" },
      { title: "Nemotron-Nano", url: "https://huggingface.co/nvidia/Nemotron-Nano-8B-Instruct", desc: "Compact, powerful language model" },
    ],
  },
];

export default function ResourcesTab() {
  return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "16px", height: "100%", overflowY: "auto" }}>
      <div>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Resources & Links</div>
        <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "2px" }}>
          Official sources · food assistance · data
        </div>
      </div>

      {RESOURCES.map((section) => (
        <div key={section.category}>
          <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "10px", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "8px" }}>
            {section.category}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {section.items.map((item) => (
              <a
                key={item.title}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 10px", display: "block", textDecoration: "none", transition: "border-color 0.15s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--accent)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)"; }}
              >
                <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--blue)", marginBottom: "2px" }}>
                  {item.title} ↗
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                  {item.desc}
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}

      {/* Footer */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px", marginTop: "4px" }}>
        <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: "10px", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
          About SafeEats SCC
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
          Built for the NVIDIA AI Hackathon. SafeEats SCC uses AI to improve food safety
          outcomes in Santa Clara County — powered by DGX Spark, Nemotron-Nano,
          cuOpt, and FAISS vector search.
        </div>
      </div>
    </div>
  );
}
