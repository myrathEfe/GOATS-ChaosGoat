import { useNavigate } from "react-router-dom";

export default function Onboarding() {
  const navigate = useNavigate();

  function start() {
    sessionStorage.setItem("onboarded", "true");
    navigate("/");
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1,
      gap: 0,
    }}>
      {/* Glow behind logo */}
      <div style={{
        position: "absolute", width: 300, height: 300,
        background: "radial-gradient(circle, rgba(240,192,64,0.12) 0%, transparent 70%)",
        borderRadius: "50%", pointerEvents: "none",
      }}/>

      {/* Logo */}
      <div style={{ position: "relative", marginBottom: 32 }}>
        <img src="/logo3.png" alt="Chaos GOAT" onError={(e) => { e.target.src = "/logo3.png"; }} style={{ width: 160, height: 160, objectFit: "contain" }}/>
      </div>

      {/* Title */}
      <h1 style={{
        fontSize: 42, fontWeight: 800, letterSpacing: 3,
        background: "linear-gradient(135deg, #f0c040 0%, #ffd97d 50%, #f0c040 100%)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        marginBottom: 12, textAlign: "center",
      }}>
        CHAOS GOAT
      </h1>

      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>
        Chaos Engineering Platform
      </p>

      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginBottom: 56, textAlign: "center", maxWidth: 380, lineHeight: 1.6 }}>
        Sistemin gerçek dayanıklılığını test et. Kırıkları altınla sar.
      </p>

      {/* Divider */}
      <div style={{ width: 60, height: 1, background: "linear-gradient(90deg, transparent, #f0c040, transparent)", marginBottom: 48 }}/>

      {/* Start button */}
      <button
        onClick={start}
        style={{
          padding: "14px 52px",
          background: "linear-gradient(135deg, #f0c040, #e6a800)",
          border: "none", borderRadius: 12, cursor: "pointer",
          fontSize: 15, fontWeight: 700, color: "#060b18",
          letterSpacing: 1.5, textTransform: "uppercase",
          boxShadow: "0 0 32px rgba(240,192,64,0.4)",
          transition: "all 0.3s",
        }}
        onMouseEnter={(e) => { e.target.style.boxShadow = "0 0 48px rgba(240,192,64,0.6)"; e.target.style.transform = "translateY(-2px)"; }}
        onMouseLeave={(e) => { e.target.style.boxShadow = "0 0 32px rgba(240,192,64,0.4)"; e.target.style.transform = "translateY(0)"; }}
      >
        Başla
      </button>

      {/* Bottom indicator */}
      <div style={{ position: "absolute", bottom: 32, display: "flex", gap: 8, alignItems: "center" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: i === 1 ? 24 : 6, height: 4, borderRadius: 2,
            background: i === 1 ? "#f0c040" : "rgba(255,255,255,0.2)",
          }}/>
        ))}
      </div>
    </div>
  );
}
