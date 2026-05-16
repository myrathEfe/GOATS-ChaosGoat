import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { api } from "../api";
import TopologyGraph from "../components/TopologyGraph";

function FlowButton({ label, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "13px 28px", borderRadius: 12, border: "1px solid rgba(240,192,64,0.35)",
      background: "rgba(240,192,64,0.08)", color: "#f0c040",
      fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5,
      transition: "all 0.2s",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(240,192,64,0.16)"; e.currentTarget.style.borderColor = "#f0c040"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(240,192,64,0.08)"; e.currentTarget.style.borderColor = "rgba(240,192,64,0.35)"; }}
    >
      {label} <ArrowRight size={16}/>
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [ts, setTs] = useState("");
  const [experiments, setExperiments] = useState([]);

  async function load() {
    try {
      const [data, exps] = await Promise.all([api.health(), api.experiments()]);
      setServices(data.services || []);
      setTs(data.timestamp || "");
      setExperiments(exps || []);
    } catch (_) {}
  }

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);

  const upCount = services.filter((s) => s.status === "UP").length;
  const downCount = services.filter((s) => s.status === "DOWN").length;
  const degraded = services.filter((s) => s.status === "DEGRADED").length;
  const completedCount = experiments.filter((e) => e.status === "completed").length;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "white", marginBottom: 4 }}>Ana Ekran</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Sistem topolojisi ve genel durum</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {[
            { label: "UP", count: upCount, color: "#22d3a0" },
            { label: "DOWN", count: downCount, color: "#ff4d6d" },
            { label: "DEGRADED", count: degraded, color: "#f0c040" },
            { label: "Deney", count: completedCount, color: "#4a9eff" },
          ].map(({ label, count, color }) => (
            <div key={label} style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, padding: "10px 18px", textAlign: "center",
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color }}>{count}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Topology */}
      <TopologyGraph services={services}/>

      {ts && (
        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: 10, textAlign: "right" }}>
          Son güncelleme: {new Date(ts).toLocaleTimeString("tr-TR")}
        </p>
      )}

      {/* Flow Button */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 32 }}>
        <FlowButton label="Senaryo Oluştur" onClick={() => navigate("/scenarios")}/>
      </div>
    </div>
  );
}
