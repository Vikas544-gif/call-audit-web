"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { colr, rd, api, fmtDur } from "./data";
import { parseTranscript, lineHasQuote } from "../../lib/transcript";
import { weakParams, ownerOf } from "../../lib/defaults";

export const Logo = () => (
  <svg width="38" height="38" viewBox="0 0 38 38"><rect width="38" height="38" rx="10" style={{ fill: "var(--accent)" }} /><g fill="#fff"><rect x="7" y="16" width="3.6" height="6" rx="1.8" /><rect x="13" y="11" width="3.6" height="16" rx="1.8" /><rect x="19" y="7" width="3.6" height="24" rx="1.8" /><rect x="25" y="13" width="3.6" height="12" rx="1.8" /><rect x="31" y="17" width="3.6" height="4" rx="1.8" /></g></svg>
);

const THEMES = [["light", "Light", "#ffffff", "#0b7a5b"], ["dark", "Dark", "#151c27", "#19a57a"], ["ocean", "Ocean", "#eaf2fb", "#1a73e8"], ["forest", "Forest", "#eef4ef", "#1f8a4c"], ["sunset", "Sunset", "#fff4ec", "#e4572e"], ["purple", "Purple", "#f3effc", "#6d4aff"], ["slate", "Slate (dark)", "#1b2230", "#5b9cff"], ["contrast", "High contrast", "#ffffff", "#000000"]];
export function ThemePicker() {
  const [open, setOpen] = useState(false), [t, setT] = useState("light"), [acc, setAcc] = useState("");
  useEffect(() => { setT(document.documentElement.dataset.theme || "light"); try { setAcc(localStorage.getItem("caa") || ""); } catch {} }, []);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (!(e.target.closest && e.target.closest(".thmw"))) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const pick = (x) => { document.documentElement.dataset.theme = x; try { localStorage.setItem("cat", x); } catch {} setT(x); };
  const setAccent = (c) => { document.documentElement.style.setProperty("--accent", c); try { localStorage.setItem("caa", c); } catch {} setAcc(c); };
  const clearAccent = () => { document.documentElement.style.removeProperty("--accent"); try { localStorage.removeItem("caa"); } catch {} setAcc(""); };
  return (
    <div className="thmw noprint">
      <button className="thb" onClick={() => setOpen(!open)} aria-haspopup="true" aria-expanded={open}><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" style={{ marginRight: 7, verticalAlign: "-2px" }}><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 1.8a6.2 6.2 0 0 1 0 12.4z" fill="currentColor" /></svg>Theme</button>
      {open && (
        <div className="thp" role="dialog" aria-label="Theme">
          <div className="thg">{THEMES.map(([k, n, bg, ac]) => <button key={k} className={"thi" + (t === k ? " on" : "")} onClick={() => pick(k)}><span className="thsw" style={{ background: bg, borderColor: ac }}><i style={{ background: ac }} /></span>{n}</button>)}</div>
          <div className="row" style={{ marginTop: 10, marginBottom: 0 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>Accent color<input type="color" value={acc || "#0b7a5b"} onChange={(e) => setAccent(e.target.value)} style={{ width: 40, height: 28, padding: 0, border: 0, background: "none" }} /></label>
            {acc && <button className="g" style={{ padding: "4px 10px", fontSize: 12 }} onClick={clearAccent}>Reset</button>}
          </div>
        </div>)}
    </div>
  );
}

export function Lock({ onUnlock, wrong, title }) {
  const [p, setP] = useState("");
  return (
    <div className="lock">
      <div className="lb"><Logo />Sales Call Audit</div>
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
      <div className="lb"><Logo />Sales Call Audit</div>
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

const PAL = ["#3346c8", "#14825f", "#c9890f", "#c2476b", "#6b7a90", "#8c5cc9", "#1c8f8a", "#a35c2e"];
// known labels keep a meaningful colour (good = green, bad = red, neutral = grey)
const LC = { "Interested": "#14825f", "Follow-up": "#3346c8", "Not Interested": "#c73a2e", "Not Connected": "#8a94a6", "Improved": "#14825f", "Declined": "#c73a2e", "No change": "#8a94a6", "First audit": "#8a94a6", "Done": "#14825f", "Pending": "#c9890f", "Trainer": "#3346c8", "Team Leader": "#c9890f", "New Lead": "#3346c8", "Work to Non Work": "#1c8f8a", "No Strategy": "#8a94a6" };
const dcol = (label, i) => LC[label] || PAL[i % PAL.length];
export function Combo({ data }) {
  if (!data.length) return <div className="empty">No data</div>;
  const W = 440, H = 230, T = 26, B = 34, X = 14, n = data.length, sw = (W - 2 * X) / n, bw = Math.min(54, sw * 0.58);
  const mx = Math.max(...data.map((d) => d.n)) || 1, vs = data.map((d) => d.avg);
  const lo = Math.max(0, Math.floor((Math.min(...vs) - 10) / 5) * 5), hi = Math.min(100, Math.ceil((Math.max(...vs) + 4) / 5) * 5);
  const cx = (i) => X + (i + 0.5) * sw, by = (v) => H - B - (v / mx) * (H - B - T - 46), ly = (v) => H - B - ((v - lo) / (hi - lo || 1)) * (H - B - T - 10);
  let d = "";
  data.forEach((p, i) => { const x = cx(i), y = ly(p.avg); if (!i) d = `M${x},${y}`; else { const m = (cx(i - 1) + x) / 2; d += ` C${m},${ly(data[i - 1].avg)} ${m},${y} ${x},${y}`; } });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Audits and average score">
      <line x1={X} x2={W - X} y1={H - B} y2={H - B} style={{ stroke: "var(--line)" }} />
      {data.map((p, i) => { const h = H - B - by(p.n), inside = h >= 22; return (
        <g key={i}>
          <rect x={cx(i) - bw / 2} y={by(p.n)} width={bw} height={h} rx="3" style={{ fill: "var(--accent)", opacity: 0.88 }} />
          <text x={cx(i)} y={inside ? H - B - 7 : by(p.n) - 5} textAnchor="middle" fontSize="12" fontWeight="600" style={{ fill: inside ? "#fff" : "var(--text)" }}>{p.n}</text>
          <text className="ct2" x={cx(i)} y={H - 13} textAnchor="middle" fontSize="11.5">{p.label.length > 13 ? p.label.slice(0, 12) + "…" : p.label}</text>
        </g>); })}
      {n > 1 && <path d={d} fill="none" stroke="#c9890f" strokeWidth="2.2" />}
      {data.map((p, i) => <g key={"l" + i}><circle cx={cx(i)} cy={ly(p.avg)} r="3.6" fill="#c9890f" stroke="var(--card)" strokeWidth="1.5" /><text className="ct halo" x={cx(i)} y={ly(p.avg) - 9} textAnchor="middle" fontSize="11.5" fontWeight="600" strokeWidth="3" paintOrder="stroke">{Math.round(p.avg)}%</text></g>)}
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
          {dd.map((d, i) => { const len = (d.n / tot) * C, el = <circle key={d.label} cx="66" cy="66" r={r} fill="none" stroke={dcol(d.label, i)} strokeWidth="20" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} />; off += len; return el; })}
        </svg>
        <b style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 600 }}>{tot}</b>
      </div>
      <div style={{ fontSize: 13, flex: 1, minWidth: 130 }}>
        {dd.map((d, i) => <div key={d.label} style={{ margin: "4px 0", display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 9, background: dcol(d.label, i), flex: "none" }} /><span style={{ fontWeight: 500 }}>{d.label}</span><span className="muted" style={{ marginLeft: "auto" }}>{d.n} ({rd((d.n / tot) * 100)}%)</span></div>)}
      </div>
    </div>
  );
}
// share of calls as one bar (instead of a pie): the length of each part is its share
export function MixBar({ data }) {
  const tot = data.reduce((x, d) => x + d.n, 0);
  if (!tot) return <div className="empty">No data</div>;
  const dd = [...data].sort((a, b) => b.n - a.n);
  return (
    <div>
      <div className="mixbar" role="img" aria-label="Share of calls">{dd.map((d, i) => <i key={d.label} style={{ flex: d.n, background: dcol(d.label, i) }} title={`${d.label}: ${d.n}`} />)}</div>
      <ul className="mixkey">{dd.map((d, i) => <li key={d.label}><span style={{ background: dcol(d.label, i) }} />{d.label}<b>{d.n}</b><em>{Math.round((d.n / tot) * 100)}%</em></li>)}</ul>
    </div>
  );
}

export function HBars({ data }) {
  if (!data.length) return <div className="empty">No data</div>;
  return <div style={{ maxHeight: 330, overflow: "auto", paddingRight: 6 }}>{data.map((d) => <div key={d.label} className="hb"><label title={d.label}>{d.label}</label><i><s style={{ width: `${d.v}%` }} /></i><b>{d.v}%</b></div>)}</div>;
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

const Unv = ({ v }) => (v === false ? <span className="tag warn1" style={{ marginLeft: 6, fontSize: 11 }}>quote not found in script</span> : null);
// when the recording is open in this tab, a time tag plays the call from that moment
const SeekCtx = createContext(null);
const toSec = (v) => { const m = String(v || "").match(/(\d+):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const At = ({ v }) => {
  const seek = useContext(SeekCtx), t = toSec(v);
  if (!v) return null;
  return seek && t != null
    ? <span className="tag own" style={{ marginLeft: 6, fontSize: 11, cursor: "pointer" }} title="Play from here" onClick={() => seek(t)}>▶ {v}</span>
    : <span className="tag own" style={{ marginLeft: 6, fontSize: 11 }}>{v}</span>;
};

const mmss = (t) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

function ScriptBox({ r, text, loading }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [r.ts]);
  const seek = useContext(SeekCtx);
  const lines = parseTranscript(text);
  const quotes = [...(r.mistakes || []), ...(r.aiMistakes || []), ...(r.flags || [])].map((m) => m.quote).filter(Boolean);
  const dl = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); a.download = `call-script-${(r.rep || "call").replace(/\s+/g, "-")}-${r.ts}.txt`; a.click(); };
  return (
    <div className="c"><H3>Call script</H3>
      {!open && <button className="g" onClick={() => setOpen(true)}>Show call script</button>}
      {open && !text && <span className="muted">{loading ? "Loading the script..." : "The script is not available for this call."}</span>}
      {open && text && (
        <div>
          <div className="row"><button className="g" onClick={() => navigator.clipboard && navigator.clipboard.writeText(text)}>Copy script</button><button className="g" onClick={dl}>Download (.txt)</button><span className="muted" style={{ fontSize: 13 }}>Lines with a mistake are marked in red.</span></div>
          <div className="scr">
            {lines.length ? lines.map((l, i) => <div key={i} className={"ln" + (lineHasQuote(l.text, quotes) ? " hit" : "") + (seek ? " pl" : "")} title={seek ? "Play from here" : undefined} onClick={seek ? () => seek(l.t) : undefined}><span className="tm">{mmss(l.t)}</span><span className={"who" + (l.who === "Agent" ? " ag" : "")}>{l.who}</span><span>{l.text}</span></div>) : <div style={{ whiteSpace: "pre-wrap" }}>{text}</div>}
          </div>
        </div>)}
    </div>
  );
}

// The call as two lanes over time, with the player built in: play, speed, a moving playhead, and a click on the lanes jumps there.
function CallTimeline({ r, text, audio }) {
  const seek = useContext(SeekCtx);
  const L = parseTranscript(text);
  const has = L.length >= 2;
  if (!has && !(audio && audio.state !== "none")) return null;
  const words = (x) => String(x || "").trim().split(/\s+/).filter(Boolean).length;
  const last = L[L.length - 1];
  const total = Math.max((audio && audio.pl.dur) || r.durationSec || 0, last ? last.t + Math.max(3, words(last.text) / 2.6) : 0, 10);
  const pos = (t) => `${Math.min(100, Math.max(0, (t / total) * 100))}%`;
  const blocks = L.map((l, i) => { const next = L[i + 1] ? L[i + 1].t : total; return { who: l.who, t: l.t, len: Math.max(1.2, Math.min(next - l.t, words(l.text) / 2.6 + 0.8)) }; });
  const marks = [
    ...(r.mistakes || []).map((m) => ({ at: toSec(m.at), label: m.mistake, hi: !!m.auto })),
    ...(r.aiMistakes || []).map((m) => ({ at: toSec(m.at), label: m.mistake, hi: m.severity === "High" })),
    ...(r.flags || []).map((m) => ({ at: toSec(m.at), label: m.issue, hi: true })),
  ].filter((m) => m.at != null && m.at <= total);
  const fa = L.find((x) => x.who === "Agent"), fc = L.find((x) => x.who === "Customer");
  const delay = r.openingDelay != null ? r.openingDelay : fa && fc ? Math.max(0, fa.t - (fc.t < fa.t ? fc.t : 0)) : null;
  const gap = fa && delay != null && delay >= 3 ? { from: Math.max(0, fa.t - delay), to: fa.t } : null;
  const clickSeek = (e) => {
    if (!seek) return;
    const rc = e.currentTarget.getBoundingClientRect();
    if (rc.width) seek(Math.max(0, Math.min(total, ((e.clientX - rc.left) / rc.width) * total)));
  };
  const lane = (who, cls) => (
    <div className="tl-lane"><span className="tl-name">{who}</span>
      <div className={"tl-bar " + cls + (seek ? " pl" : "")} onClick={clickSeek}>
        {blocks.filter((b) => b.who === who).map((b, i) => <b key={i} style={{ left: pos(b.t), width: `${(b.len / total) * 100}%` }} />)}
        {who === "Agent" && gap && <div className="tl-gap" style={{ left: pos(gap.from), width: `${((gap.to - gap.from) / total) * 100}%` }} title={`The agent started speaking ${delay} seconds after the customer picked up`}>{delay}s</div>}
      </div>
    </div>
  );
  return (
    <div className="c tl"><H3>Call timeline</H3>
      {audio && audio.state !== "none" && (
        <div className="tl-ctl">
          {audio.state === "loading" && <span className="muted">Loading the recording...</span>}
          {audio.state === "err" && <span className="muted">The recording is not available. It may have expired or been deleted.</span>}
          {audio.state === "ok" && <>
            <button className="tl-play" onClick={audio.toggle} aria-label={audio.pl.playing ? "Pause" : "Play"}>
              {audio.pl.playing ? <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.4" height="12" rx="1" fill="currentColor" /><rect x="9.6" y="2" width="3.4" height="12" rx="1" fill="currentColor" /></svg> : <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.2v11.6a.5.5 0 0 0 .77.42l9-5.8a.5.5 0 0 0 0-.84l-9-5.8A.5.5 0 0 0 4 2.2z" fill="currentColor" /></svg>}
            </button>
            <span className="tl-time">{mmss(audio.pl.cur)} <span className="muted">/ {mmss(total)}</span></span>
            <select value={audio.pl.rate} onChange={(e) => audio.setRate(Number(e.target.value))} aria-label="Playback speed">{[1, 1.25, 1.5, 2].map((x) => <option key={x} value={x}>{x}x</option>)}</select>
            <span className="muted tl-note">{audio.note}</span>
            {audio.onDelete && <button className="g" style={{ padding: "3px 10px", fontSize: 12.5 }} onClick={audio.onDelete}>Delete recording</button>}
          </>}
        </div>)}
      {has && <div className="tl-key"><span><i style={{ background: "var(--accent)" }} />Agent speaking</span><span><i style={{ background: "color-mix(in srgb, var(--mute) 70%, transparent)" }} />Customer speaking</span><span><i style={{ background: "var(--warn)" }} />Mistake</span><span><i style={{ background: "var(--bad)" }} />Serious mistake or late opening</span></div>}
      {has && (
        <div className="tl-wrap">
          <div className="tl-marks">
            {marks.map((m, i) => <button key={i} className={"tl-m" + (m.hi ? " hi" : "") + (seek ? " pl" : "")} style={{ left: pos(m.at) }} title={`${mmss(m.at)}  ${m.label}`} aria-label={`${mmss(m.at)} ${m.label}`} onClick={seek ? () => seek(m.at) : undefined} />)}
            {audio && audio.state === "ok" && <div className="tl-ph" style={{ left: pos(audio.pl.cur) }} />}
          </div>
          {lane("Agent", "ag")}{lane("Customer", "cu")}
          <div className="tl-axis">{[0, 0.25, 0.5, 0.75, 1].map((f) => <span key={f}>{mmss(total * f)}</span>)}</div>
        </div>)}
    </div>
  );
}

const L = ({ items }) => <ul style={{ margin: 0, paddingLeft: 20 }}>{(items || []).map((x, i) => <li key={i}>{x}</li>)}</ul>;
const H3 = ({ children }) => <h3 style={{ marginTop: 0 }}>{children}</h3>;
const resTag = { yes: "on1", partial: "warn1", no: "bad" };

export function Detail({ r, info, params, weakPct, taskMap, onSend, busy, script, audioUrl, onDelete }) {
  const audioRef = useRef(null);
  const [audioSrc, setAudioSrc] = useState(audioUrl || ""), [audioSt, setAudioSt] = useState(audioUrl ? "ok" : r.hasAudio ? "loading" : "none");
  const [pl, setPl] = useState({ cur: 0, dur: 0, playing: false, rate: 1 });
  // the recording: either still open in this browser tab (audit page), or the saved one, fetched with a short-lived link
  useEffect(() => {
    let on = true;
    setPl({ cur: 0, dur: 0, playing: false, rate: 1 });
    if (audioUrl) { setAudioSrc(audioUrl); setAudioSt("ok"); }
    else if (r.hasAudio) {
      setAudioSrc(""); setAudioSt("loading");
      api("/api/audio-url?ts=" + r.ts).then(async (res) => { const j = await res.json(); if (!on) return; if (res.ok && j.url) { setAudioSrc(j.url); setAudioSt("ok"); } else setAudioSt("err"); }).catch(() => { if (on) setAudioSt("err"); });
    } else { setAudioSrc(""); setAudioSt("none"); }
    return () => { on = false; };
  }, [r.ts, audioUrl, r.hasAudio]);
  const [scriptText, setScriptText] = useState(script || r.transcript || ""), [scriptLoading, setScriptLoading] = useState(false);
  useEffect(() => {
    let on = true;
    const pre = script || r.transcript || "";
    setScriptText(pre);
    if (!pre) {
      setScriptLoading(true);
      api("/api/script?ts=" + r.ts).then(async (res) => { const j = await res.json(); if (on && res.ok && j.transcript) setScriptText(j.transcript); }).catch(() => {}).finally(() => { if (on) setScriptLoading(false); });
    }
    return () => { on = false; };
  }, [r.ts, script, r.transcript]);
  const seekFn = audioSt === "ok" && audioSrc ? (t) => { const a = audioRef.current; if (a) { a.currentTime = t; const p = a.play(); if (p && p.catch) p.catch(() => {}); } } : null;
  const weak = weakParams(r, params, weakPct);
  const mine = (r.tasks || []).map((t) => ({ ...t, ...(taskMap[t.id] || {}) }));
  const mand = r.mandatory || [];
  const mail = r.mail || {};
  const err = [mail.agentErr, mail.trainerErr, mail.tlErr, mail.err].filter(Boolean);
  return (
    <SeekCtx.Provider value={seekFn}>
    <div>
      <div className="c" style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <Ring p={r.total} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{r.rep} <span className="muted" style={{ fontSize: 14.5, fontWeight: 400, marginLeft: 6 }}>{info.center}, TL {info.tl || "-"}</span> <span className={"tag " + (r.outcome === "Likely Sale" ? "on1" : r.outcome === "Lost" ? "bad" : "warn1")} style={{ marginLeft: 6 }}>{r.outcome}</span></div>
          <div style={{ margin: "6px 0" }}><span className="muted">Customer</span> <b>{r.customer || "-"}</b>{r.contactId ? <span><span className="muted" style={{ marginLeft: 14 }}>Contact ID</span> <b>{r.contactId}</b></span> : null}</div>
          {r.openingDelay != null && <div style={{ margin: "4px 0" }}><span className={"tag " + ((r.delayPenalty || 0) > 0 ? "bad" : "on1")}>Opening delay: {r.openingDelay}s{(r.delayPenalty || 0) > 0 ? ` (-${r.delayPenalty} points taken off the opening)` : " (OK)"}</span></div>}
          <p style={{ margin: "4px 0" }}>{r.summary}</p>
          <small className="muted" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}><span>{r.date}</span><span>{r.type}</span>{r.durationSec ? <span>{fmtDur(r.durationSec)} min</span> : null}<span>{r.file}</span></small>
        </div>
      </div>
      {audioSrc && <audio ref={audioRef} src={audioSrc} preload="metadata" style={{ display: "none" }}
        onTimeUpdate={(e) => setPl((p) => ({ ...p, cur: e.target.currentTime }))} onLoadedMetadata={(e) => setPl((p) => ({ ...p, dur: e.target.duration || 0 }))}
        onPlay={() => setPl((p) => ({ ...p, playing: true }))} onPause={() => setPl((p) => ({ ...p, playing: false }))} onEnded={() => setPl((p) => ({ ...p, playing: false }))} />}
      <CallTimeline r={r} text={scriptText} audio={audioSt === "none" ? null : {
        state: audioSt, pl,
        toggle: () => { const a = audioRef.current; if (!a) return; if (a.paused) { const pr = a.play(); if (pr && pr.catch) pr.catch(() => {}); } else a.pause(); },
        setRate: (v) => { const a = audioRef.current; if (a) a.playbackRate = v; setPl((p) => ({ ...p, rate: v })); },
        note: audioUrl ? "This recording stays only in this browser tab." : r.audioExp ? "Saved until " + new Date(r.audioExp).toLocaleDateString("en-GB") : "Saved recording",
        onDelete: onSend && r.hasAudio && !audioUrl ? async () => { if (!window.confirm("Delete the saved recording of this call? This cannot be undone.")) return; const res = await api("/api/audio?ts=" + r.ts, { method: "DELETE" }); if (res.ok) { setAudioSt("none"); setAudioSrc(""); } } : null,
      }} />
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
                <div>{w.map((x) => `${x.label} (${x.pct}%)`).join(", ")}</div>
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
          <div className="bar" key={k}><label>{k} <span className="tag own" style={{ fontSize: 10, padding: "0 6px" }}>{ownerOf(params, k)}</span></label><i><s style={{ width: `${p}%`, background: colr(p) }} /></i><b>{Math.round(p)}%</b></div>); })}
      </div>
      <div className="c"><H3>Mistakes and how to fix them</H3>
        {!(r.mistakes || []).length && <span className="muted">No mistakes recorded.</span>}
        {(r.mistakes || []).map((m, i) => <div className="f" key={i}><b>{m.mistake}</b>{m.parameter && <span className="tag own" style={{ marginLeft: 8, fontSize: 11 }}>{m.parameter}</span>}<At v={m.at} /><Unv v={m.verified} />{m.quote ? <div className="q">"{m.quote}"</div> : null}<div>Say it like this: {m.fix}</div></div>)}</div>
      {(r.aiMistakes || []).length > 0 && <div className="c"><H3>Other mistakes found by the AI <span className="muted" style={{ fontWeight: 600, fontSize: 13 }}>(not limited to the parameters)</span></H3>
        {r.aiMistakes.map((m, i) => <div className="f" key={i} style={{ borderLeftColor: m.severity === "High" ? "var(--bad)" : m.severity === "Low" ? "var(--mute)" : "var(--warn)" }}><b>{m.mistake}</b><span className="tag own" style={{ marginLeft: 8, fontSize: 11 }}>{m.category}</span><span className={"tag " + (m.severity === "High" ? "bad" : m.severity === "Low" ? "off1" : "warn1")} style={{ marginLeft: 6, fontSize: 11 }}>{m.severity}</span><At v={m.at} /><Unv v={m.verified} />{m.quote ? <div className="q">"{m.quote}"</div> : null}{m.why ? <div className="muted">{m.why}</div> : null}<div>Say it like this: {m.fix}</div></div>)}</div>}
      {mand.length > 0 && <div className="c"><H3>Mandatory statements</H3>
        {mand.map((m, i) => <div className="f" key={i} style={{ borderLeftColor: m.result === "yes" ? "var(--good)" : m.result === "partial" ? "var(--warn)" : "var(--bad)" }}><span className={"tag " + (resTag[m.result] || "off1")}>{m.result}</span> {m.statement}{m.evidence ? <div className="q">"{m.evidence}"</div> : null}</div>)}</div>}
      <div className="c"><H3>Compliance flags</H3>
        {!(r.flags || []).length && <span style={{ color: "var(--good)" }}>No major issues found.</span>}
        {(r.flags || []).map((f, i) => <div className="f" key={i}><b>{f.issue}</b> ({f.severity})<At v={f.at} /><Unv v={f.verified} /><div className="q">"{f.quote}"</div><div>Fix: {f.fix}</div></div>)}</div>
      <div className="c"><H3>Objections</H3>
        {!(r.objections || []).length && <span className="muted">No objections in this call.</span>}
        {(r.objections || []).map((o, i) => <div className="f" key={i} style={{ borderLeftColor: o.handled ? "var(--good)" : "var(--bad)" }}><b>{o.objection}</b> <span className={"tag " + (o.handled ? "on1" : "bad")}>{o.handled ? "Handled" : "Not handled"}</span>{o.better && <div>Better reply: {o.better}</div>}</div>)}</div>
      <div className="c"><H3>What went well</H3><L items={r.strengths} /></div>
      <div className="c"><H3>Missed opportunities</H3><L items={r.missed} /></div>
      <div className="c" style={{ borderLeft: "4px solid var(--good)" }}><H3>Steps to improve sales</H3><L items={r.tips} /></div>
      <ScriptBox r={r} text={scriptText} loading={scriptLoading} />
      {onDelete && <div className="c noprint"><div className="row" style={{ marginBottom: 0 }}><button className="g dng" disabled={busy} onClick={onDelete}>Delete this audit</button><span className="muted" style={{ fontSize: 13 }}>Removes this audit with its script, its recording and its follow-ups. This cannot be undone.</span></div></div>}
    </div>
    </SeekCtx.Provider>
  );
}

export function Gate({ S, title, children }) {
  if (!S.ready) return <div className="lock">Loading...</div>;
  if (S.locked) return <Lock title={title} wrong={S.wrong} onUnlock={S.unlock} />;
  if (!S.configured || S.error) return <Setup error={S.error} />;
  return children;
}

const NAV = [["/dashboard", "Dashboard"], ["/calls", "Audited calls"], ["/mistakes", "AI Mistakes"], ["/followups", "Follow-ups"], ["/settings", "Settings"]];
export function AdminNav({ active, S, sub }) {
  const sv = S.save || { s: "idle" };
  return (
    <header className="top">
      <div className="brand"><Logo /><div><b>Sales Call Audit</b><span>{sub}</span></div></div>
      <nav className="tabs">{NAV.map(([h, n]) => <a key={h} href={h} className={active === h ? "on" : ""}>{n}</a>)}<a href="/audit">Audit page ↗</a></nav>
      {sv.s !== "idle" && <span className={"tag " + (sv.s === "error" ? "bad" : sv.s === "saving" ? "warn1" : "on1")} style={{ background: "var(--card)" }}>{sv.s === "saving" ? "Saving..." : sv.s === "saved" ? "Saved ✓" : "Save failed: " + sv.msg}</span>}
      <ThemePicker />
    </header>
  );
}
