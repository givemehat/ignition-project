import { useState, useEffect, useRef, useCallback } from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

const API_URL = "http://localhost:5000/data";

// ─── Theme ────────────────────────────────────────────────
const THEME = {
  HIGH:   { accent:"#ef4444", bg:"rgba(239,68,68,0.08)",   border:"rgba(239,68,68,0.3)",   badge:"#7f1d1d", text:"#fca5a5", glow:"glow-red",   label:"HIGH"   },
  MEDIUM: { accent:"#fb923c", bg:"rgba(251,146,60,0.07)",  border:"rgba(251,146,60,0.25)", badge:"#7c2d12", text:"#fdba74", glow:"glow-amber", label:"MEDIUM" },
  LOW:    { accent:"#34d399", bg:"rgba(52,211,153,0.06)",  border:"rgba(52,211,153,0.2)",  badge:"#064e3b", text:"#6ee7b7", glow:"",           label:"LOW"    },
};

// ─── Fake stress history for sparkline ───────────────────
function makeHistory(current) {
  return Array.from({ length: 10 }, (_, i) =>
    i === 9 ? current : Math.max(30, Math.min(100, current + (Math.random() - 0.5) * 20))
  ).map((v, i) => ({ t: i, v: parseFloat(v.toFixed(1)) }));
}

// ─── Skeleton Card ────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:16, padding:24, width:260, minHeight:200 }}>
      <div className="skeleton" style={{ height:14, width:"40%", marginBottom:16 }} />
      <div className="skeleton" style={{ height:48, width:"60%", marginBottom:12 }} />
      <div className="skeleton" style={{ height:10, width:"80%", marginBottom:8 }} />
      <div className="skeleton" style={{ height:10, width:"55%" }} />
    </div>
  );
}

// ─── Alert Toast ──────────────────────────────────────────
function AlertToast({ alerts, onDismiss }) {
  return (
    <div style={{ position:"fixed", top:24, right:24, zIndex:100, display:"flex", flexDirection:"column", gap:10, maxWidth:340 }}>
      {alerts.map(a => (
        <div
          key={a.id}
          className="alert-enter"
          style={{
            background: a.level === "HIGH" ? "rgba(127,29,29,0.95)" : "rgba(120,53,15,0.95)",
            border: `1px solid ${a.level === "HIGH" ? "rgba(239,68,68,0.5)" : "rgba(251,146,60,0.4)"}`,
            borderRadius:12, padding:"14px 16px",
            backdropFilter:"blur(12px)",
            display:"flex", alignItems:"flex-start", gap:12,
            boxShadow:"0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          <span style={{ fontSize:18, flexShrink:0, marginTop:1 }}>🚨</span>
          <div style={{ flex:1 }}>
            <p style={{ color:"#fff", fontSize:13, fontWeight:600, margin:0, lineHeight:1.4 }}>{a.message}</p>
            <p style={{ color:"rgba(255,255,255,0.5)", fontSize:11, margin:"4px 0 0", fontFamily:"'DM Mono', monospace" }}>
              Score: {a.stress} · {a.zone}
            </p>
          </div>
          <button onClick={() => onDismiss(a.id)}
            style={{ color:"rgba(255,255,255,0.4)", background:"none", border:"none", cursor:"pointer", fontSize:16, padding:0, lineHeight:1 }}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Zone Detail Modal ────────────────────────────────────
function ZoneModal({ zone, onClose }) {
  if (!zone) return null;
  const t = THEME[zone.level] || THEME.LOW;

  return (
    <div
      onClick={onClose}
      style={{
        position:"fixed", inset:0, zIndex:200,
        background:"rgba(0,0,0,0.7)",
        backdropFilter:"blur(6px)",
        display:"flex", alignItems:"center", justifyContent:"center",
        padding:24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="fade-up"
        style={{
          background:"#111827",
          border:`1px solid ${t.border}`,
          borderRadius:20, padding:32,
          width:"100%", maxWidth:460,
          boxShadow:`0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px ${t.border}`,
        }}
      >
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div>
            <p style={{ color:"rgba(255,255,255,0.4)", fontSize:11, fontFamily:"'DM Mono',monospace", letterSpacing:"0.1em", textTransform:"uppercase", margin:0 }}>Zone Detail</p>
            <h2 style={{ color:"#fff", fontSize:28, fontWeight:700, margin:"4px 0 0" }}>{zone.zone}</h2>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{
              background: t.badge, color: t.text,
              fontSize:11, fontWeight:700, padding:"5px 12px",
              borderRadius:20, letterSpacing:"0.08em", textTransform:"uppercase",
            }}>{zone.level}</span>
            <button onClick={onClose}
              style={{ color:"rgba(255,255,255,0.4)", background:"#1f2937", border:"none", width:32, height:32, borderRadius:8, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>
              ×
            </button>
          </div>
        </div>

        {/* Big stress number */}
        <div style={{
          background: t.bg, border:`1px solid ${t.border}`,
          borderRadius:14, padding:"20px 24px", marginBottom:20,
          display:"flex", alignItems:"center", justifyContent:"space-between",
        }}>
          <div>
            <p style={{ color:"rgba(255,255,255,0.4)", fontSize:12, margin:"0 0 6px", fontFamily:"'DM Mono',monospace" }}>STRESS SCORE</p>
            <p style={{ color: t.accent, fontSize:52, fontWeight:800, margin:0, fontFamily:"'DM Mono',monospace", letterSpacing:"-1px" }}>{zone.stress}</p>
          </div>
          <div style={{ textAlign:"right" }}>
            <p style={{ color:"rgba(255,255,255,0.3)", fontSize:11, margin:"0 0 4px" }}>out of 100</p>
            <div style={{ width:60, height:3, background:"#1f2937", borderRadius:2, overflow:"hidden" }}>
              <div style={{ width:`${zone.stress}%`, height:"100%", background: t.accent, borderRadius:2 }} />
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
          {[
            { label:"Occupancy",   value:`${zone.occupancy}%`, icon:"🛏" },
            { label:"Noise Level", value:`${zone.noise} dB`,   icon:"🔊" },
          ].map(s => (
            <div key={s.label} style={{ background:"#1f2937", borderRadius:12, padding:"16px 18px" }}>
              <p style={{ color:"rgba(255,255,255,0.35)", fontSize:11, margin:"0 0 8px", fontFamily:"'DM Mono',monospace", letterSpacing:"0.06em" }}>{s.icon} {s.label.toUpperCase()}</p>
              <p style={{ color:"#e2e8f0", fontSize:22, fontWeight:700, margin:0, fontFamily:"'DM Mono',monospace" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Sparkline */}
        <div style={{ background:"#1f2937", borderRadius:12, padding:"16px 18px" }}>
          <p style={{ color:"rgba(255,255,255,0.35)", fontSize:11, margin:"0 0 12px", fontFamily:"'DM Mono',monospace", letterSpacing:"0.06em" }}>📈 RECENT STRESS TREND</p>
          <ResponsiveContainer width="100%" height={70}>
            <LineChart data={zone.history || makeHistory(zone.stress)}>
              <Line type="monotone" dataKey="v" stroke={t.accent} strokeWidth={2} dot={false} />
              <Tooltip
                contentStyle={{ background:"#0f172a", border:`1px solid ${t.border}`, borderRadius:8, fontSize:11, fontFamily:"'DM Mono',monospace" }}
                itemStyle={{ color: t.text }}
                labelFormatter={() => ""}
                formatter={(v) => [v, "Stress"]}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── Zone Card ────────────────────────────────────────────
function ZoneCard({ zone, onClick }) {
  const t = THEME[zone.level] || THEME.LOW;
  const prevStress = useRef(zone.stress);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    if (prevStress.current !== zone.stress) {
      setPop(true);
      const timer = setTimeout(() => setPop(false), 400);
      prevStress.current = zone.stress;
      return () => clearTimeout(timer);
    }
  }, [zone.stress]);

  const trend = zone.history && zone.history.length >= 2
    ? zone.history[zone.history.length - 1].v - zone.history[zone.history.length - 2].v
    : 0;

  return (
    <div
      onClick={() => onClick(zone)}
      className={zone.level === "HIGH" ? "glow-red" : zone.level === "MEDIUM" ? "glow-amber" : ""}
      style={{
        background: "#111827",
        border: `1px solid ${t.border}`,
        borderRadius: 16,
        padding: "22px 22px 18px",
        width: 256,
        cursor: "pointer",
        transition: "transform 0.2s ease, border-color 0.4s ease",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={e => e.currentTarget.style.transform = "translateY(-3px)"}
      onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
    >
      {/* Accent top bar */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background: t.accent, opacity:0.8, borderRadius:"16px 16px 0 0" }} />

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div>
          <p style={{ color:"rgba(255,255,255,0.35)", fontSize:10, fontFamily:"'DM Mono',monospace", letterSpacing:"0.12em", textTransform:"uppercase", margin:0 }}>Zone</p>
          <h3 style={{ color:"#f1f5f9", fontSize:20, fontWeight:700, margin:"3px 0 0", letterSpacing:"-0.3px" }}>{zone.zone}</h3>
        </div>
        <span style={{
          background: t.badge, color: t.text,
          fontSize:10, fontWeight:700,
          padding:"4px 10px", borderRadius:20,
          letterSpacing:"0.08em", textTransform:"uppercase",
        }}>{zone.level}</span>
      </div>

      {/* Stress score */}
      <div style={{ marginBottom:14 }}>
        <p style={{ color:"rgba(255,255,255,0.3)", fontSize:11, margin:"0 0 4px", fontFamily:"'DM Mono',monospace" }}>STRESS</p>
        <div style={{ display:"flex", alignItems:"flex-end", gap:8 }}>
          <span
            className={pop ? "number-pop" : ""}
            style={{ color: t.accent, fontSize:46, fontWeight:800, lineHeight:1, fontFamily:"'DM Mono',monospace", letterSpacing:"-2px", display:"inline-block" }}
          >
            {zone.stress}
          </span>
          <span style={{
            color: trend > 0 ? "#ef4444" : trend < 0 ? "#34d399" : "rgba(255,255,255,0.3)",
            fontSize:13, fontWeight:600, marginBottom:6,
          }}>
            {trend > 0 ? `↑ ${trend.toFixed(1)}` : trend < 0 ? `↓ ${Math.abs(trend).toFixed(1)}` : "→"}
          </span>
        </div>
      </div>

      {/* Mini sparkline */}
      <div style={{ marginBottom:14, height:40 }}>
        <ResponsiveContainer width="100%" height={40}>
          <LineChart data={zone.history || []}>
            <Line type="monotone" dataKey="v" stroke={t.accent} strokeWidth={1.5} dot={false} strokeOpacity={0.7} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom metrics */}
      <div style={{
        borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:12,
        display:"flex", justifyContent:"space-between",
      }}>
        {[["Occ.", `${zone.occupancy}%`], ["Noise", `${zone.noise}dB`]].map(([l, v]) => (
          <div key={l}>
            <p style={{ color:"rgba(255,255,255,0.3)", fontSize:10, margin:0, fontFamily:"'DM Mono',monospace" }}>{l}</p>
            <p style={{ color:"#94a3b8", fontSize:13, fontWeight:600, margin:"2px 0 0", fontFamily:"'DM Mono',monospace" }}>{v}</p>
          </div>
        ))}
        <div>
          <p style={{ color:"rgba(255,255,255,0.3)", fontSize:10, margin:0, fontFamily:"'DM Mono',monospace" }}>Details</p>
          <p style={{ color:"#475569", fontSize:13, fontWeight:600, margin:"2px 0 0" }}>Click →</p>
        </div>
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────
let alertCounter = 0;

export default function App() {
  const [zones,    setZones]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [alerts,   setAlerts]   = useState([]);
  const [modal,    setModal]    = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const prevLevels = useRef({});
  const historyMap = useRef({});

  const dismissAlert = useCallback((id) => {
    setAlerts(a => a.filter(x => x.id !== id));
  }, []);

  async function fetchData(initial = false) {
    try {
      if (initial) setLoading(true);
      const res  = await fetch(API_URL);
      const data = await res.json();

      // Attach history + detect level changes for alerts
      const enriched = data.map(z => {
        if (!historyMap.current[z.zone]) historyMap.current[z.zone] = makeHistory(z.stress);
        else {
          historyMap.current[z.zone] = [...historyMap.current[z.zone].slice(1), { t: Date.now(), v: z.stress }];
        }
        return { ...z, history: [...historyMap.current[z.zone]] };
      });

      // Generate alerts for level changes or persistent HIGH
      enriched.forEach(z => {
        const prev = prevLevels.current[z.zone];
        const isNew = !prev;
        if (z.level === "HIGH" && (isNew || prev !== "HIGH")) {
          const id = ++alertCounter;
          setAlerts(a => [...a.slice(-3), { id, zone: z.zone, level: z.level, stress: z.stress, message: `${z.zone} is under HIGH stress` }]);
          setTimeout(() => setAlerts(a => a.filter(x => x.id !== id)), 6000);
        } else if (prev === "HIGH" && z.level !== "HIGH") {
          const id = ++alertCounter;
          setAlerts(a => [...a.slice(-3), { id, zone: z.zone, level: z.level, stress: z.stress, message: `${z.zone} recovered to ${z.level}` }]);
          setTimeout(() => setAlerts(a => a.filter(x => x.id !== id)), 4000);
        }
        prevLevels.current[z.zone] = z.level;
      });

      setZones(enriched);
      setError(null);
      setLastRefresh(new Date());
    } catch {
      setError("Backend offline — start server on port 5000");
    } finally {
      if (initial) setLoading(false);
    }
  }

  useEffect(() => {
    fetchData(true);
    const t = setInterval(() => fetchData(), 3000);
    return () => clearInterval(t);
  }, []);

  const highCount   = zones.filter(z => z.level === "HIGH").length;
  const mediumCount = zones.filter(z => z.level === "MEDIUM").length;

  return (
    <div style={{ minHeight:"100vh", background:"#080e1a", fontFamily:"'DM Sans', sans-serif" }}>

      {/* Header */}
      <header style={{
        borderBottom:"1px solid rgba(255,255,255,0.06)",
        padding:"0 32px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        height:60,
        background:"rgba(15,23,42,0.8)",
        backdropFilter:"blur(12px)",
        position:"sticky", top:0, zIndex:50,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:28, height:28, background:"linear-gradient(135deg,#3b82f6,#6366f1)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>🏥</div>
          <span style={{ color:"#f1f5f9", fontWeight:700, fontSize:15, letterSpacing:"-0.2px" }}>HealthcareSmart</span>
          <span style={{ color:"rgba(255,255,255,0.2)", fontSize:13 }}>/</span>
          <span style={{ color:"rgba(255,255,255,0.4)", fontSize:13 }}>Stress Monitor</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          {highCount > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:20, padding:"4px 12px" }}>
              <span style={{ width:6, height:6, background:"#ef4444", borderRadius:"50%", display:"inline-block", animation:"pulse-red 1.5s infinite" }} />
              <span style={{ color:"#fca5a5", fontSize:12, fontWeight:600 }}>{highCount} HIGH</span>
            </div>
          )}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:6, height:6, background:"#34d399", borderRadius:"50%", animation:"pulse-red 2s infinite" }} />
            <span style={{ color:"rgba(255,255,255,0.3)", fontSize:12, fontFamily:"'DM Mono',monospace" }}>
              {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : "Connecting…"}
            </span>
          </div>
        </div>
      </header>

      <main style={{ padding:"40px 32px", maxWidth:1100, margin:"0 auto" }}>

        {/* Page title */}
        <div style={{ marginBottom:36 }}>
          <h1 style={{ color:"#f1f5f9", fontSize:28, fontWeight:800, margin:0, letterSpacing:"-0.5px" }}>
            Operational Stress Overview
          </h1>
          <p style={{ color:"rgba(255,255,255,0.35)", fontSize:14, margin:"8px 0 0" }}>
            Real-time monitoring across {zones.length} zones · auto-refreshes every 3 seconds
          </p>
        </div>

        {/* Summary bar */}
        {!loading && !error && (
          <div style={{ display:"flex", gap:12, marginBottom:32 }}>
            {[
              { label:"Total Zones",    value:zones.length,   color:"#94a3b8" },
              { label:"HIGH Stress",    value:highCount,      color:"#ef4444" },
              { label:"MEDIUM Stress",  value:mediumCount,    color:"#fb923c" },
              { label:"LOW / Stable",   value:zones.length - highCount - mediumCount, color:"#34d399" },
            ].map(s => (
              <div key={s.label} style={{
                background:"#111827", border:"1px solid rgba(255,255,255,0.07)",
                borderRadius:12, padding:"14px 20px", flex:1,
              }}>
                <p style={{ color:"rgba(255,255,255,0.35)", fontSize:11, margin:0, fontFamily:"'DM Mono',monospace", letterSpacing:"0.06em" }}>{s.label.toUpperCase()}</p>
                <p style={{ color: s.color, fontSize:26, fontWeight:800, margin:"4px 0 0", fontFamily:"'DM Mono',monospace" }}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:12, padding:"14px 20px", color:"#fca5a5", fontSize:14, marginBottom:24 }}>
            ⚠ {error}
          </div>
        )}

        {/* Cards */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:20 }}>
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
            : zones.map(z => <ZoneCard key={z.zone} zone={z} onClick={setModal} />)
          }
        </div>

        {/* Legend */}
        {!loading && (
          <div style={{ marginTop:40, display:"flex", gap:20, flexWrap:"wrap" }}>
            {[["HIGH","#ef4444","> 75"], ["MEDIUM","#fb923c","40–75"], ["LOW","#34d399","< 40"]].map(([label, color, range]) => (
              <div key={label} style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:8, height:8, background:color, borderRadius:"50%" }} />
                <span style={{ color:"rgba(255,255,255,0.35)", fontSize:12, fontFamily:"'DM Mono',monospace" }}>
                  {label} <span style={{ color:"rgba(255,255,255,0.2)" }}>{range}</span>
                </span>
              </div>
            ))}
            <button
              onClick={() => fetchData()}
              style={{ marginLeft:"auto", color:"rgba(255,255,255,0.4)", background:"#1f2937", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"6px 14px", fontSize:12, cursor:"pointer", fontFamily:"'DM Mono',monospace", transition:"all 0.2s" }}
              onMouseEnter={e => e.target.style.color = "#fff"}
              onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.4)"}
            >
              ↻ Refresh
            </button>
          </div>
        )}
      </main>

      {/* Alert toasts */}
      <AlertToast alerts={alerts} onDismiss={dismissAlert} />

      {/* Zone detail modal */}
      <ZoneModal zone={modal} onClose={() => setModal(null)} />
    </div>
  );
}
