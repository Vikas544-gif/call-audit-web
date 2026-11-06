"use client";
import { useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";

const CATS = { opening: "Opening", discovery: "Need discovery", product: "Product knowledge", objection: "Objection handling", compliance: "Compliance (SEBI)", closing: "Closing" };
const col = (n) => (n >= 75 ? "#0b7a5b" : n >= 50 ? "#b7791f" : "#c0392b");
const card = { background: "#fff", border: "1px solid #e3e6ec", borderRadius: 12, padding: 14, marginBottom: 12 };
const btn = { background: "#0b7a5b", color: "#fff", border: 0, borderRadius: 8, padding: "10px 18px", fontWeight: 600, cursor: "pointer", fontSize: 15 };

function List({ items }) {
  return <ul style={{ margin: 0, paddingLeft: 20 }}>{(items || []).map((x, i) => <li key={i}>{x}</li>)}</ul>;
}

function Result({ r }) {
  return (
    <div>
      <div style={{ ...card, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 48, fontWeight: 700, color: col(r.overall) }}>{r.overall}<small style={{ fontSize: 16, color: "#667085" }}>/100</small></div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <b>{r.outcome}</b>
          <p style={{ margin: "4px 0" }}>{r.summary}</p>
        </div>
      </div>
      <div style={{ ...card, borderLeft: "4px solid #c0392b" }}>
        <h3 style={{ marginTop: 0 }}>Sale kyun aayi / kyun nahi aayi</h3>
        <p style={{ margin: 0 }}>{r.why}</p>
      </div>
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Rep ki galtiyan aur sahi tareeka</h3>
        {(r.mistakes || []).map((m, i) => (
          <div key={i} style={{ borderLeft: "3px solid #c0392b", padding: "4px 10px", margin: "8px 0", background: "#f5f6f8" }}>
            <b>{m.mistake}</b>
            <div style={{ color: "#667085", fontStyle: "italic" }}>"{m.quote}"</div>
            <div>Aise bolo: {m.fix}</div>
          </div>
        ))}
      </div>
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Scorecard</h3>
        {Object.keys(CATS).map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0", fontSize: 13 }}>
            <span style={{ width: 130, color: "#667085" }}>{CATS[k]}</span>
            <div style={{ flex: 1, height: 8, background: "#e3e6ec", borderRadius: 6 }}>
              <div style={{ width: `${(r.scores?.[k] || 0) * 10}%`, height: 8, background: "#0b7a5b", borderRadius: 6 }} />
            </div>
            <span style={{ width: 24 }}>{r.scores?.[k] || 0}</span>
          </div>
        ))}
      </div>
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Compliance flags</h3>
        {(r.flags || []).length === 0 && <span style={{ color: "#0b7a5b" }}>Koi bada issue nahi mila.</span>}
        {(r.flags || []).map((f, i) => (
          <div key={i} style={{ borderLeft: "3px solid #c0392b", padding: "4px 10px", margin: "8px 0", background: "#f5f6f8" }}>
            <b>{f.issue}</b> ({f.severity})
            <div style={{ color: "#667085", fontStyle: "italic" }}>"{f.quote}"</div>
            <div>Fix: {f.fix}</div>
          </div>
        ))}
      </div>
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Objections</h3>
        {(r.objections || []).map((o, i) => (
          <div key={i} style={{ margin: "8px 0" }}><b>{o.objection}</b> - {o.handled ? "Handled" : "Missed"}<div>Better reply: {o.better}</div></div>
        ))}
      </div>
      <div style={card}><h3 style={{ marginTop: 0 }}>Kya accha raha</h3><List items={r.strengths} /></div>
      <div style={card}><h3 style={{ marginTop: 0 }}>Missed opportunities</h3><List items={r.missed} /></div>
      <div style={{ ...card, borderLeft: "4px solid #0b7a5b" }}>
        <h3 style={{ marginTop: 0 }}>Sales badhane ke steps</h3><List items={r.tips} />
      </div>
    </div>
  );
}

export default function Home() {
  const [hist, setHist] = useState([]);
  const [cur, setCur] = useState(null);
  const [files, setFiles] = useState([]);
  const [rep, setRep] = useState("");
  const [callType, setCallType] = useState("Cold call");
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { setHist(JSON.parse(localStorage.getItem("audits") || "[]")); } catch {}
  }, []);

  const run = async () => {
    setErr(""); setBusy(true);
    let h = hist;
    for (const f of files) {
      try {
        setStatus(`${f.name}: upload ho raha hai...`);
        const blob = await upload(`calls/${Date.now()}-${f.name}`, f, { access: "public", handleUploadUrl: "/api/upload" });
        setStatus(`${f.name}: transcribe + audit ho raha hai (1-3 min)...`);
        const res = await fetch("/api/audit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: blob.url, callType }) });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error);
        const r = { ...j.result, transcript: j.transcript, file: f.name, rep, type: callType, date: new Date().toLocaleString() };
        h = [r, ...h].slice(0, 50);
        setHist(h); setCur(r);
        try { localStorage.setItem("audits", JSON.stringify(h)); } catch {}
      } catch (e) { setErr(`${f.name}: ${e.message}`); }
    }
    setStatus(""); setBusy(false); setFiles([]);
  };

  const n = hist.length;
  const avg = n ? Math.round(hist.reduce((a, b) => a + b.overall, 0) / n) : 0;
  const sales = hist.filter((h) => h.outcome === "Likely Sale").length;
  const flags = hist.reduce((a, b) => a + (b.flags || []).length, 0);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 16 }}>
      <h1 style={{ margin: "4px 0" }}>📞 Sales Call Audit</h1>
      <p style={{ color: "#667085", marginTop: 0 }}>Call upload karo, galtiyan aur sales badhane ke steps paao.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 12 }}>
        {[["Calls audited", n], ["Avg score", n ? avg : "-"], ["Likely sales", sales], ["Compliance flags", flags]].map(([a, b]) => (
          <div key={a} style={{ ...card, margin: 0 }}><div style={{ fontSize: 26, fontWeight: 700 }}>{b}</div><div style={{ color: "#667085", fontSize: 13 }}>{a}</div></div>
        ))}
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Call recording upload karo</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <input value={rep} onChange={(e) => setRep(e.target.value)} placeholder="Sales rep ka naam" style={{ flex: 1, minWidth: 150, padding: 9, borderRadius: 8, border: "1px solid #e3e6ec" }} />
          <select value={callType} onChange={(e) => setCallType(e.target.value)} style={{ flex: 1, minWidth: 150, padding: 9, borderRadius: 8, border: "1px solid #e3e6ec" }}>
            <option>Cold call</option><option>Follow-up call</option><option>Demo / Advisory call</option><option>Renewal call</option>
          </select>
        </div>
        <input type="file" accept="audio/*" multiple onChange={(e) => setFiles([...e.target.files])} />
        <div style={{ marginTop: 10 }}>
          <button style={{ ...btn, opacity: busy || !files.length ? 0.5 : 1 }} disabled={busy || !files.length} onClick={run}>
            {busy ? "Chal raha hai..." : `Audit karo${files.length ? ` (${files.length})` : ""}`}
          </button>
        </div>
        {status && <p style={{ color: "#667085" }}>{status}</p>}
        {err && <p style={{ color: "#c0392b" }}>{err}</p>}
      </div>

      {cur && <Result r={cur} />}

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Audit history</h3>
        {!n && <span style={{ color: "#667085" }}>Abhi koi audit nahi hua.</span>}
        {hist.map((h, i) => (
          <div key={i} onClick={() => { setCur(h); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: i ? "1px solid #e3e6ec" : 0, cursor: "pointer" }}>
            <span>{h.rep || "Rep"} · {h.file}<br /><small style={{ color: "#667085" }}>{h.date}</small></span>
            <span><b style={{ color: col(h.overall) }}>{h.overall}</b> {h.outcome}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
