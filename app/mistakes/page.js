"use client";
import { useEffect, useState } from "react";
import { useStore, dl, colr, uniq } from "../components/data";
import { Gate, AdminNav, Modal, Detail } from "../components/ui";
import { FilterBar, useFilters } from "../components/filters";
import { infoOf, norm } from "../../lib/filters";

const sevRank = { High: 0, Medium: 1, Low: 2 };
const CountBars = ({ data }) => {
  const mx = Math.max(1, ...data.map((d) => d.n));
  if (!data.length) return <div className="empty">No data</div>;
  return <div>{data.map((d) => <div key={d.label} className="cb"><label title={d.label}>{d.label}</label><i><s style={{ width: `${(d.n / mx) * 100}%` }} /></i><b>{d.n}</b></div>)}</div>;
};
const count = (items, key) => { const g = {}; items.forEach((x) => { const k = x[key] || "-"; g[k] = (g[k] || 0) + 1; }); return Object.entries(g).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n); };

export default function MistakesPage() {
  const S = useStore("full");
  const F = useFilters(S);
  const { params, amap, mcfg, tasks } = S;
  const [src, setSrc] = useState("AI"), [sev, setSev] = useState("All"), [cat, setCat] = useState("All"), [q, setQ] = useState(""), [cur, setCur] = useState(null), [more, setMore] = useState(80);
  useEffect(() => {
    if (!S.configured || S.locked) return;
    const t = setInterval(() => S.refresh(), 45000);
    return () => clearInterval(t);
  }, [S.configured, S.locked]);

  const taskMap = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const items = [];
  F.V.list.forEach((h) => {
    const i = infoOf(amap, h), base = { ts: h.ts, h, rep: h.rep, center: i.center, tl: i.tl, customer: h.customer, contactId: h.contactId, date: h.date };
    (h.aiMistakes || []).forEach((m) => items.push({ ...base, src: "AI", category: m.category || "Other", severity: m.severity || "Medium", mistake: m.mistake, at: m.at, quote: m.quote, why: m.why, fix: m.fix, verified: m.verified }));
    (h.mistakes || []).forEach((m) => items.push({ ...base, src: "Parameter", category: m.parameter || "Other", severity: "-", mistake: m.mistake, at: m.at, quote: m.quote, why: "", fix: m.fix, verified: m.verified }));
  });
  const pool = items.filter((x) => src === "All" || x.src === src);
  const cats = count(pool, "category");
  const shown = pool.filter((x) => (sev === "All" || x.severity === sev) && (cat === "All" || x.category === cat) &&
    (!q.trim() || [x.mistake, x.quote, x.fix, x.rep, x.customer, x.contactId, x.category].some((v) => norm(v).includes(norm(q)))))
    .sort((a, b) => (sevRank[a.severity] ?? 3) - (sevRank[b.severity] ?? 3) || b.ts - a.ts);
  const high = pool.filter((x) => x.severity === "High").length;
  const agentsAff = uniq(pool.map((x) => x.rep)).length;
  const callsCount = new Set(pool.map((x) => x.ts)).size;

  return (
    <Gate S={S} title="AI Mistakes">
      <AdminNav active="/mistakes" S={S} sub="AI Mistakes" />
      <div className="main">
        <FilterBar F={F} title="AI Mistakes" sub="What the AI found wrong in the calls" />
        <div className="row noprint" style={{ marginBottom: 14 }}>
          <div className="seg">{[["AI", "Found by AI"], ["Parameter", "Parameter mistakes"], ["All", "All"]].map(([k, n]) => <button key={k} className={src === k ? "on" : ""} onClick={() => { setSrc(k); setCat("All"); }}>{n}</button>)}</div>
          <span className="muted" style={{ fontSize: 13 }}>{src === "AI" ? "Mistakes the AI noticed on its own, not limited to the scoring parameters." : src === "Parameter" ? "Mistakes tied to a scoring parameter." : "Both kinds together."}</span>
        </div>
        <div className="kp">
          {[["MISTAKES", pool.length, "#2f6bff"], ["HIGH SEVERITY", high, "#ef4444"], ["CALLS WITH MISTAKES", callsCount, "#f59e0b"], ["AGENTS AFFECTED", agentsAff, "#8b5cf6"], ["MOST COMMON", cats[0] ? cats[0].label : "-", "#10b981"]].map(([a, b, col]) => <div key={a} className="kc" style={{ borderColor: col }}><span>{a}</span><b style={{ color: col, fontSize: String(b).length > 8 ? 18 : 38, lineHeight: String(b).length > 8 ? "2.6" : undefined }}>{b}</b></div>)}
        </div>
        <div className="cols" style={{ marginBottom: 14 }}>
          <div className="c"><h3>Mistakes by category</h3><CountBars data={cats.slice(0, 10)} /></div>
          <div className="c"><h3>Agents with the most mistakes</h3><CountBars data={count(pool, "rep").slice(0, 10)} /></div>
        </div>
        <div className="c">
          <div className="row">
            <h3 style={{ margin: 0, flex: 1 }}>Mistakes <span className="muted" style={{ fontWeight: 600, fontSize: 13 }}>({shown.length})</span></h3>
            <select value={sev} onChange={(e) => setSev(e.target.value)}><option value="All">Severity: All</option><option>High</option><option>Medium</option><option>Low</option></select>
            <select value={cat} onChange={(e) => setCat(e.target.value)}><option value="All">Category: All</option>{cats.map((c) => <option key={c.label} value={c.label}>{c.label} ({c.n})</option>)}</select>
            <input placeholder="Search mistake, quote, agent, customer" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 240 }} />
            <button className="g" disabled={!shown.length} onClick={() => dl("ai-mistakes.csv", [["Date", "Agent", "Center", "TL", "Customer", "Contact ID", "Source", "Category", "Severity", "Mistake", "At", "Quote", "Why", "Fix"], ...shown.map((x) => [x.date, x.rep, x.center, x.tl, x.customer, x.contactId, x.src === "AI" ? "AI" : "Parameter", x.category, x.severity, x.mistake, x.at, x.quote, x.why, x.fix])])}>Download (Excel)</button>
          </div>
          {!shown.length ? <div className="empty">No mistakes match. {src === "AI" ? "AI-found mistakes appear for audits made with this version. Older audits only have parameter mistakes." : ""}</div> : (
            <div className="sc"><table className="t"><thead><tr><th>Date</th><th className="l">Agent</th><th className="l">Customer</th><th>Category</th><th>Severity</th><th className="l">Mistake</th><th className="l">Quote from the call</th><th className="l">Say instead</th><th></th></tr></thead><tbody>
              {shown.slice(0, more).map((x, i) => (
                <tr key={i}><td>{(x.date || "").split(",")[0]}</td><td className="l"><b>{x.rep}</b><br /><small className="muted">{x.center} · TL {x.tl || "-"}</small></td><td className="l">{x.customer || "-"}{x.contactId ? <div className="muted">ID {x.contactId}</div> : null}</td>
                  <td><span className="tag own">{x.category}</span></td><td>{x.severity === "-" ? "-" : <span className={"tag " + (x.severity === "High" ? "bad" : x.severity === "Low" ? "off1" : "warn1")}>{x.severity}</span>}</td>
                  <td className="l">{x.mistake}{x.at ? <span className="tag own" style={{ marginLeft: 6, fontSize: 11 }}>{x.at}</span> : null}{x.verified === false ? <span className="tag warn1" style={{ marginLeft: 6, fontSize: 11 }}>quote not found</span> : null}{x.why ? <div className="muted" style={{ fontSize: 12 }}>{x.why}</div> : null}</td>
                  <td className="l"><i className="muted">{x.quote ? `"${x.quote}"` : "-"}</i></td><td className="l">{x.fix}</td><td><button className="g" onClick={() => setCur(x.h)}>View call</button></td></tr>))}
            </tbody></table></div>)}
          {shown.length > more && <div className="row" style={{ justifyContent: "center" }}><button className="g" onClick={() => setMore(more + 80)}>Show more ({shown.length - more} left)</button></div>}
        </div>
      </div>
      {cur && <Modal onClose={() => setCur(null)}><Detail r={cur} info={infoOf(amap, cur)} params={params} weakPct={mcfg.weakPct} taskMap={taskMap} /></Modal>}
    </Gate>
  );
}
