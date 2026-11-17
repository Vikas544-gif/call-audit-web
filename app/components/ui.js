"use client";
import { useEffect, useState } from "react";
import { colr, rd } from "./data";
import { weakParams, ownerOf } from "../../lib/defaults";

export const Logo = () => (
  <svg width="38" height="38" viewBox="0 0 38 38"><rect width="38" height="38" rx="10" fill="#0b9a72" /><g fill="#fff"><rect x="7" y="16" width="3.6" height="6" rx="1.8" /><rect x="13" y="11" width="3.6" height="16" rx="1.8" /><rect x="19" y="7" width="3.6" height="24" rx="1.8" /><rect x="25" y="13" width="3.6" height="12" rx="1.8" /><rect x="31" y="17" width="3.6" height="4" rx="1.8" /></g></svg>
);

const THEMES = [["light", "Light", "#ffffff"], ["dark", "Dark", "#151c27"], ["ocean", "Ocean", "#1a73e8"], ["forest", "Forest", "#1f8a4c"]];
export function ThemePicker() {
  const [t, setT] = useState("light");
  useEffect(() => { setT(document.documentElement.dataset.theme || "light"); }, []);
  const pick = (x) => { document.documentElement.dataset.theme = x; try { localStorage.setItem("cat", x); } catch {} setT(x); };
  return <div className="thm noprint">{THEMES.map(([k, n, c]) => <button key={k} className={"sw" + (t === k ? " on" : "")} style={{ background: c }} title={n + " theme"} aria-label={n + " theme"} onClick={() => pick(k)} />)}</div>;
}

export function Lock({ onUnlock, wrong, title }) {
  const [p, setP] = useState("");
  return (
    <div className="lock">
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p className="muted" style={{ marginTop: 0 }}>Enter the password to continue.</p>
      <input type="password" autoFocus style={{ width: "100%" }} placeholder="Password" value={p} onChange={(e) => setP(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && p) onUnlock(p); }} />
      {wrong && <p style={{ color: "var(--bad)", fontSize: 13, margin: "8px 0 0" }}>Wrong password for this page. Try again.</p>}
      <div style={{ marginTop: 12 }}><button disabled={!p} onClick={() => onUnlock(p)}>Open</button></div>
    </div>
  );
}

export function Setup({ error }) {
  return (
    <div className="lock" style={{ maxWidth: 520 }}>
      <h3 style={{ marginTop: 0 }}>{error ? "Could not load" : "Database is not connected"}</h3>
      {error ? <p>{error}</p> : <p>Connect <b>Upstash Redis</b> in Vercel so everyone shares the same data: Vercel &gt; Storage &gt; Create Database &gt; Upstash (Redis) &gt; connect to this project, then Redeploy.</p>}
    </div>
  );
}

export function Modal({ onClose, children }) {
  return <div className="mod noprint" onClick={onClose}><div className="mbox" onClick={(e) => e.stopPropagation()}><div className="xb"><button className="g" onClick={onClose}>Close ✕</button></div>{children}</div></div>;
}

export function Ring({ p }) {
  const R = 44, C = 2 * Math.PI * R, v = Math.max(0, Math.min(100, p));
  return (
    <div className="ring">
      <svg width="104" height="104" viewBox="0 0 104 104"><circle cx="52" cy="52" r={R} fill="none" stroke="rgba(150,165,190,.28)" strokeWidth="9" /><circle cx="52" cy="52" r={R} fill="none" stroke={colr(v)} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(C * v) / 100} ${C}`} /></svg>
      <b>{v}%</b>
    </div>
  );
}

const PAL = ["#118dff", "#7b8cff", "#e66c37", "#b24fc4", "#e044a7", "#744ec2", "#d9b300", "#d64550"];
export function Combo({ data }) {
  if (!data.length) return <div className="empty">No data</div>;
  const W = 440, H = 230, T = 30, B = 34, X = 14, n = data.length, sw = (W - 2 * X) / n, bw = Math.min(64, sw * 0.62);
  const mx = Math.max(...data.map((d) => d.n)) || 1, vs = data.map((d) => d.avg);
  const lo = Math.max(0, Math.floor((Math.min(...vs) - 8) / 5) * 5), hi = Math.min(100, Math.ceil((Math.max(...vs) + 4) / 5) * 5);
  const cx = (i) => X + (i + 0.5) * sw, by = (v) => H - B - (v / mx) * (H - B - T - 38), ly = (v) => H - B - ((v - lo) / (hi - lo || 1)) * (H - B - T - 10);
  let d = "";
  data.forEach((p, i) => { const x = cx(i), y = ly(p.avg); if (!i) d = `M${x},${y}`; else { const m = (cx(i - 1) + x) / 2; d += ` C${m},${ly(data[i - 1].avg)} ${m},${y} ${x},${y}`; } });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {data.map((p, i) => <g key={i}><rect x={cx(i) - bw / 2} y={by(p.n)} width={bw} height={H - B - by(p.n)} fill="#118dff" rx="2" /><text className="ct" x={cx(i)} y={by(p.n) - 6} textAnchor="middle" fontSize="11" fontWeight="700">{p.n}</text><text className="ct2" x={cx(i)} y={H - 12} textAnchor="middle" fontSize="11" fontWeight="700">{p.label.length > 14 ? p.label.slice(0, 13) + "…" : p.label}</text></g>)}
      {n > 1 && <path d={d} fill="none" stroke="#e0a63b" strokeWidth="2.4" />}
      {data.map((p, i) => <g key={"l" + i}><circle cx={cx(i)} cy={ly(p.avg)} r="3.4" fill="#e0a63b" /><text className="ct halo" x={cx(i)} y={ly(p.avg) - 8} textAnchor="middle" fontSize="10.5" fontWeight="700" strokeWidth="3" paintOrder="stroke">{p.avg}%</text></g>)}
    </svg>
  );
}
export function Donut({ data }) {
  const tot = data.reduce((x, d) => x + d.n, 0);
  if (!tot) return <div className="empty">No data</div>;
  const dd = [...data].sort((a, b) => b.n - a.n), r = 46, C = 2 * Math.PI * r; let off = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: 132, height: 132, flex: "none" }}>
        <svg width="132" height="132" viewBox="0 0 132 132" style={{ transform: "rotate(-90deg)" }}>
          {dd.map((d, i) => { const len = (d.n / tot) * C, el = <circle key={d.label} cx="66" cy="66" r={r} fill="none" stroke={PAL[i % PAL.length]} strokeWidth="20" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} />; off += len; return el; })}
        </svg>
        <b style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 600 }}>{tot}</b>
      </div>
      <div style={{ fontSize: 13, flex: 1, minWidth: 130 }}>
        {dd.map((d, i) => <div key={d.label} style={{ margin: "4px 0", display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 9, background: PAL[i % PAL.length], flex: "none" }} /><span style={{ fontWeight: 600 }}>{d.label}</span><span className="muted" style={{ marginLeft: "auto" }}>{d.n} ({rd((d.n / tot) * 100)}%)</span></div>)}
      </div>
    </div>
  );
}
export function HBars({ data }) {
  if (!data.length) return <div className="empty">No data</div>;
  return <div style={{ maxHeight: 330, overflow: "auto", paddingRight: 6 }}>{data.map((d) => <div key={d.label} className="hb"><label title={d.label}>{d.label}</label><i><s style={{ width: `${d.v}%`, background: "#118dff" }} /></i><b>{d.v}%</b></div>)}</div>;
}

export function Slicer({ title, opts, sel, onChange }) {
  const [q, setQ] = useState("");
  const shown = q ? opts.filter((o) => o.toLowerCase().includes(q.toLowerCase())) : opts;
  const toggle = (o) => onChange(sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o]);
  return (
    <div className="sl">
      <h5>{title} <em>{sel.length ? `${sel.length} selected` : "All"}</em>{sel.length > 0 && <button className="g" style={{ marginLeft: "auto", padding: "2px 8px", fontSize: 11 }} onClick={() => onChange([])}>Clear</button>}</h5>
      {opts.length > 10 && <input placeholder={`Search ${title.toLowerCase()}...`} value={q} onChange={(e) => setQ(e.target.value)} />}
      <div className="bx">
        <button className={sel.length ? "" : "on"} onClick={() => onChange([])}>All</button>
        {shown.map((o) => <button key={o} className={sel.includes(o) ? "on" : ""} onClick={() => toggle(o)}>{o}</button>)}
        {!opts.length && <span style={{ color: "#9fb0c8", fontSize: 12 }}>No options yet</span>}
      </div>
    </div>
  );
}

const L = ({ items }) => <ul style={{ margin: 0, paddingLeft: 20 }}>{(items || []).map((x, i) => <li key={i}>{x}</li>)}</ul>;
const H3 = ({ children }) => <h3 style={{ marginTop: 0 }}>{children}</h3>;
const resTag = { yes: "on1", partial: "warn1", no: "bad" };

export function Detail({ r, info, params, weakPct, taskMap, onSend, busy }) {
  const weak = weakParams(r, params, weakPct);
  const mine = (r.tasks || []).map((t) => ({ ...t, ...(taskMap[t.id] || {}) }));
  const mand = r.mandatory || [];
  const mail = r.mail || {};
  const err = [mail.agentErr, mail.trainerErr, mail.tlErr, mail.err].filter(Boolean);
  return (
    <div>
      <div className="c" style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <Ring p={r.total} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <b>{r.rep} · {info.center} · TL: {info.tl || "-"} · {r.outcome}</b>
          <div style={{ margin: "4px 0", fontWeight: 700 }}>Customer: {r.customer || "-"}{r.contactId ? ` · Contact ID: ${r.contactId}` : ""}</div>
          <p style={{ margin: "4px 0" }}>{r.summary}</p>
          <small className="muted">{r.date} · {r.type} · {r.file}</small>
        </div>
      </div>
      {r.cmp && (
        <div className="c"><H3>Vs last call</H3>
          {r.cmp.delta == null ? <span className="muted">First audit for this agent. The comparison starts from the next call.</span> : (
            <div>
              <div style={{ marginBottom: 6 }}><span className={"tag " + (r.cmp.status === "Improved" ? "on1" : r.cmp.status === "Declined" ? "bad" : "warn1")}>{r.cmp.status}</span> <b>{r.cmp.delta > 0 ? "+" : ""}{r.cmp.delta} pts</b> <span className="muted">({r.cmp.prev}% on {r.cmp.prevDate} → {r.total}%)</span></div>
              {r.cmp.up.length > 0 && <div style={{ color: "var(--good)" }}>Improved: {r.cmp.up.map((x) => `${x.k} (+${x.d}%)`).join(", ")}</div>}
              {r.cmp.down.length > 0 && <div style={{ color: "var(--bad)" }}>Dropped: {r.cmp.down.map((x) => `${x.k} (${x.d}%)`).join(", ")}</div>}
            </div>)}
        </div>)}
      <div className="c"><H3>Who needs to act</H3>
        {!weak.length ? <span style={{ color: "var(--good)" }}>No weak parameters. Nothing to follow up.</span> : (
          <div>
            {["Trainer", "TL"].map((o) => { const w = weak.filter((x) => x.owner === o); if (!w.length) return null; const tk = mine.find((t) => t.owner === o); return (
              <div className="f" key={o} style={{ borderLeftColor: tk && tk.status === "Submitted" ? "var(--good)" : "var(--warn)" }}>
                <b>{o === "Trainer" ? "Trainer" : "Team Leader"}</b> <span className={"tag " + (tk && tk.status === "Submitted" ? "on1" : "warn1")}>{tk ? (tk.status === "Submitted" ? "Done" : "Waiting") : "Not sent"}</span>
                <div>{w.map((x) => `${x.label} (${x.s}/${x.max})`).join(", ")}</div>
                {tk && tk.status === "Submitted" && <div className="muted">{tk.trainer} · {tk.action}{tk.trainDate ? ` · ${tk.trainDate}` : ""}{tk.nextReview ? ` · next review ${tk.nextReview}` : ""}{tk.ackAt ? " · agent acknowledged" : ""}{tk.notes ? <div>{tk.notes}</div> : null}</div>}
              </div>); })}
          </div>)}
        <div className="row" style={{ marginTop: 8 }}>
          <span className={"tag " + (mail.agent ? "on1" : "off1")}>Audit email: {mail.agent ? "sent" : "not sent"}</span>
        </div>
        {err.length > 0 && <div style={{ color: "var(--bad)", fontSize: 13 }}>{err.join(" | ")}</div>}
        {onSend && <div className="row noprint" style={{ marginTop: 8 }}>
          <button className="g" disabled={busy} onClick={() => onSend("agent")}>Email audit to agent</button>
          {weak.length > 0 && <button className="g" disabled={busy} onClick={() => onSend("tasks")}>{(r.tasks || []).length ? "Resend follow-ups" : "Send follow-ups"}</button>}
        </div>}
      </div>
      <div className="c" style={{ borderLeft: "4px solid var(--bad)" }}><H3>Why the sale did / didn't happen</H3>{r.why}</div>
      <div className="c"><H3>Parameter scores</H3>
        {Object.entries(r.sc).map(([k, v]) => { const p = (v.s / v.max) * 100; return (
          <div className="bar" key={k}><label>{k} <span className="tag own" style={{ fontSize: 10, padding: "0 6px" }}>{ownerOf(params, k)}</span></label><i><s style={{ width: `${p}%`, background: colr(p) }} /></i><b>{v.s}/{v.max}</b></div>); })}
      </div>
      <div className="c"><H3>Mistakes and how to fix them</H3>
        {!(r.mistakes || []).length && <span className="muted">No mistakes recorded.</span>}
        {(r.mistakes || []).map((m, i) => <div className="f" key={i}><b>{m.mistake}</b>{m.parameter && <span className="tag own" style={{ marginLeft: 8, fontSize: 11 }}>{m.parameter}</span>}<div className="q">"{m.quote}"</div><div>Say it like this: {m.fix}</div></div>)}</div>
      {mand.length > 0 && <div className="c"><H3>Mandatory statements</H3>
        {mand.map((m, i) => <div className="f" key={i} style={{ borderLeftColor: m.result === "yes" ? "var(--good)" : m.result === "partial" ? "var(--warn)" : "var(--bad)" }}><span className={"tag " + (resTag[m.result] || "off1")}>{m.result}</span> {m.statement}{m.evidence ? <div className="q">"{m.evidence}"</div> : null}</div>)}</div>}
      <div className="c"><H3>Compliance flags</H3>
        {!(r.flags || []).length && <span style={{ color: "var(--good)" }}>No major issues found.</span>}
        {(r.flags || []).map((f, i) => <div className="f" key={i}><b>{f.issue}</b> ({f.severity})<div className="q">"{f.quote}"</div><div>Fix: {f.fix}</div></div>)}</div>
      <div className="c"><H3>Objections</H3>
        {!(r.objections || []).length && <span className="muted">No objections in this call.</span>}
        {(r.objections || []).map((o, i) => <div className="f" key={i} style={{ borderLeftColor: o.handled ? "var(--good)" : "var(--bad)" }}><b>{o.objection}</b> <span className={"tag " + (o.handled ? "on1" : "bad")}>{o.handled ? "Handled" : "Not handled"}</span>{o.better && <div>Better reply: {o.better}</div>}</div>)}</div>
      <div className="c"><H3>What went well</H3><L items={r.strengths} /></div>
      <div className="c"><H3>Missed opportunities</H3><L items={r.missed} /></div>
      <div className="c" style={{ borderLeft: "4px solid var(--good)" }}><H3>Steps to improve sales</H3><L items={r.tips} /></div>
    </div>
  );
}
