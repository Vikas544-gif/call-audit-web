"use client";
import { useEffect, useState } from "react";
import { useStore, api, dl, colr, heat, rd, avg, uniq, wkLbl, mandScore, TENURES, STRATS, CTYPES } from "../components/data";
import { Lock, Setup, Logo, ThemePicker, Modal, Detail, Combo, Donut, HBars, Slicer } from "../components/ui";
import { DEFAULT_PARAMS, DEFAULT_MAND, weakParams } from "../../lib/defaults";

const H3 = ({ children }) => <h3 style={{ marginTop: 0 }}>{children}</h3>;

export default function DashboardPage() {
  const S = useStore("full");
  const { params, centers, amap, mcfg, tasks } = S;
  const hist = S.audits;
  const [tab, setTab] = useState("dash");
  const [cur, setCur] = useState(null), [busy, setBusy] = useState(false), [more, setMore] = useState(60);
  const [fc, setFc] = useState([]), [ft, setFt] = useState([]), [fa, setFa] = useState([]), [fs, setFs] = useState("Active");
  const [fw, setFw] = useState("All"), [fo, setFo] = useState("All"), [fn, setFn] = useState("All"), [fg, setFg] = useState("All"), [fct, setFct] = useState("All");
  const [from, setFrom] = useState(""), [to, setTo] = useState(""), [q, setQ] = useState("");
  const [nc, setNc] = useState(""), [na, setNa] = useState({ name: "", center: "", tl: "", oo: "", tenure: TENURES[0], email: "", tlEmail: "" }), [bulk, setBulk] = useState("");

  useEffect(() => {
    if (!S.configured || S.locked || tab !== "dash") return;
    const t = setInterval(() => { if (!busy) S.refresh(); }, 45000);
    return () => clearInterval(t);
  }, [S.configured, S.locked, tab, busy]);

  const info = (h) => amap.find((a) => a.name.toLowerCase() === h.rep.toLowerCase()) || { name: h.rep, center: h.center || "-", tl: h.tl || "-", oo: h.oo || "-", tenure: h.tenure || "-", active: true };
  const taskMap = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const weakOf = (h) => weakParams(h, params, mcfg.weakPct);

  const addAgent = () => {
    const name = na.name.trim();
    if (!name) return;
    if (amap.some((a) => a.name.toLowerCase() === name.toLowerCase())) { alert("This agent already exists."); return; }
    S.saveMap([...amap, { name, center: na.center || centers[0] || "", tl: na.tl.trim(), oo: na.oo.trim(), tenure: na.tenure, email: na.email.trim(), tlEmail: na.tlEmail.trim(), active: true }]);
    setNa({ name: "", center: na.center, tl: na.tl, oo: na.oo, tenure: na.tenure, email: "", tlEmail: na.tlEmail });
  };
  const importBulk = () => {
    let m = [...amap], cs = [...centers];
    bulk.split("\n").forEach((line) => {
      const [c, n, t, s, o, tn, em, tem] = line.split(/\t|,/).map((x) => (x || "").trim());
      if (!n || /^agent/i.test(n)) return;
      const act = !/^(inactive|no|0|false)/i.test(s || "");
      const i = m.findIndex((a) => a.name.toLowerCase() === n.toLowerCase());
      const row = { name: n, center: c, tl: t, active: act, oo: o || "", tenure: tn || "", email: em || "", tlEmail: tem || "" };
      if (i >= 0) m[i] = row; else m.push(row);
      if (c && !cs.includes(c)) cs.push(c);
    });
    S.saveCenters(cs); S.saveMap(m); setBulk("");
  };

  const sendMail = async (r, mode) => {
    setBusy(true);
    try {
      const res = await api("/api/notify", { method: "POST", body: JSON.stringify({ audit: r, mode }) });
      const j = await res.json();
      const u = res.ok ? { ...r, mail: j.mail, tasks: j.tasks } : { ...r, mail: { ...(r.mail || {}), err: j.error || "Email failed" } };
      S.setAudits(hist.map((x) => (x.ts === r.ts ? u : x))); setCur(u); S.loadTasks();
    } catch (e) { setCur({ ...r, mail: { ...(r.mail || {}), err: e.message } }); }
    setBusy(false);
  };

  // slicers: Center -> Team Leader -> Agent (each one only shows what the previous ones allow)
  const inC = (a) => !fc.length || fc.includes(a.center);
  const tlOpts = uniq(amap.filter(inC).map((a) => a.tl));
  const ftE = ft.filter((x) => tlOpts.includes(x));
  const inT = (a) => inC(a) && (!ftE.length || ftE.includes(a.tl));
  const agOpts = uniq([...amap.filter(inT).map((a) => a.name), ...(!fc.length && !ftE.length ? hist.map((h) => h.rep) : [])]);
  const faE = fa.filter((x) => agOpts.includes(x));
  const agFor = (c, t) => uniq([...amap.filter((a) => (!c.length || c.includes(a.center)) && (!t.length || t.includes(a.tl))).map((a) => a.name), ...(!c.length && !t.length ? hist.map((h) => h.rep) : [])]);
  const onCenter = (c) => {
    setFc(c);
    const tls = uniq(amap.filter((a) => !c.length || c.includes(a.center)).map((a) => a.tl)), nt = ft.filter((x) => tls.includes(x));
    setFt(nt); const ag = agFor(c, nt); setFa(fa.filter((x) => ag.includes(x)));
  };
  const onTl = (t) => { setFt(t); const ag = agFor(fc, t); setFa(fa.filter((x) => ag.includes(x))); };

  const qq = q.trim().toLowerCase();
  const list = hist.filter((h) => {
    const i = info(h);
    return (!fc.length || fc.includes(i.center)) && (!ftE.length || ftE.includes(i.tl)) && (!faE.length || faE.includes(h.rep)) &&
      (fs === "All" || (fs === "Active" ? i.active : !i.active)) &&
      (fw === "All" || wkLbl(h.ts) === fw) && (fo === "All" || (i.oo || "-") === fo) && (fn === "All" || (i.tenure || "-") === fn) && (fg === "All" || (h.strategy || "-") === fg) && (fct === "All" || (h.type || "-") === fct) &&
      (!from || (h.ts && h.ts >= new Date(from).getTime())) && (!to || (h.ts && h.ts <= new Date(to).getTime() + 864e5 - 1)) &&
      (!qq || [h.customer, h.contactId, h.rep, h.file].some((x) => String(x || "").toLowerCase().includes(qq)));
  });
  const rows = uniq(list.map((h) => h.rep)).map((a) => {
    const au = list.filter((h) => h.rep === a), i = info(au[0]);
    return { a, center: i.center, tl: i.tl, active: i.active, n: au.length, tot: Math.round(avg(au.map((h) => h.total))), cells: params.map((p) => avg(au.filter((h) => h.sc[p.label]).map((h) => h.sc[p.label].s / h.sc[p.label].max))) };
  }).sort((x, y) => (x.center + x.tl + x.a).localeCompare(y.center + y.tl + y.a));
  const colAvg = params.map((_, i) => avg(rows.map((r) => r.cells[i]).filter((x) => x != null)));
  const avgAll = list.length ? rd(avg(list.map((h) => h.total))) : 0;
  const grp = (key) => uniq(rows.map((r) => r[key])).map((g) => { const rr = rows.filter((r) => r[key] === g); return { g, agents: rr.length, n: rr.reduce((x, r) => x + r.n, 0), tot: Math.round(avg(rr.map((r) => r.tot))) }; });
  const allCenters = uniq([...centers, ...amap.map((a) => a.center)]);
  const by = (key, cmp) => { const g = {}; list.forEach((h) => { const k = key(h) || "-"; (g[k] = g[k] || []).push(h); }); return Object.keys(g).map((k) => ({ label: k, n: g[k].length, avg: rd(avg(g[k].map((h) => h.total))), t: Math.min(...g[k].map((h) => h.ts || 0)) })).sort(cmp || ((a, b) => a.label.localeCompare(b.label))); };
  const ti = (l) => { const i = TENURES.indexOf(l); return i < 0 ? 99 : i; };
  const wkData = by((h) => wkLbl(h.ts), (a, b) => a.t - b.t), tlData = by((h) => info(h).tl), tnData = by((h) => info(h).tenure, (a, b) => ti(a.label) - ti(b.label));
  const stData = by((h) => h.cstatus), ctData = by((h) => h.type), sgData = by((h) => h.strategy), imData = by((h) => h.cmp && h.cmp.status);
  const pw = params.map((p) => { const a = list.filter((h) => h.sc[p.label]).map((h) => (h.sc[p.label].s / h.sc[p.label].max) * 100); return { label: p.label, v: a.length ? rd(avg(a)) : null }; }).filter((x) => x.v != null).sort((a, b) => b.v - a.v);
  const ownCount = { Trainer: 0, TL: 0 }; let needF = 0;
  list.forEach((h) => { const w = weakOf(h); if (w.length) needF++; w.forEach((x) => { ownCount[x.owner]++; }); });
  const ownData = [{ label: "Trainer", n: ownCount.Trainer }, { label: "Team Leader", n: ownCount.TL }].filter((x) => x.n);
  const mAvg = avg(list.map(mandScore).filter((x) => x != null));
  const listTs = new Set(list.map((h) => h.ts));
  const lt = tasks.filter((t) => listTs.has(t.auditTs));
  const pending = lt.filter((t) => t.status !== "Submitted").length;
  const allWeeks = uniq(hist.map((h) => wkLbl(h.ts))), allOos = uniq(amap.map((a) => a.oo));

  if (!S.ready) return <div className="lock">Loading...</div>;
  if (S.locked) return <Lock title="Dashboard" wrong={S.wrong} onUnlock={S.unlock} />;
  if (!S.configured || S.error) return <Setup error={S.error} />;

  const setP = (i, k, v) => S.saveParams(params.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const totW = params.reduce((x, p) => x + (Number(p.max) || 0), 0);

  return (
    <div>
      <header className="top">
        <div className="brand"><Logo /><div><b>Sales Call Audit</b><span>Dashboard</span></div></div>
        <div className="tabs">
          {[["dash", "Dashboard"], ["set", "Settings"]].map(([k, v]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{v}</button>)}
          <a href="/audit">Audit page ↗</a>
        </div>
        <ThemePicker />
      </header>
      <div className="main">
        {tab === "set" && (
          <div>
            <div className="c">
              <H3>Centers</H3>
              <div className="row">{centers.map((c) => <span key={c} className="tag on1" style={{ padding: "5px 10px" }}>{c} <a style={{ cursor: "pointer", marginLeft: 6 }} onClick={() => S.saveCenters(centers.filter((x) => x !== c))}>✕</a></span>)}</div>
              <div className="row"><input placeholder="New center (e.g. Andheri)" value={nc} onChange={(e) => setNc(e.target.value)} /><button onClick={() => { const v = nc.trim(); if (v && !centers.includes(v)) S.saveCenters([...centers, v]); setNc(""); }}>+ Add center</button></div>
            </div>

            <div className="c">
              <H3>Agent mapping (Center, Agent, TL, Active/Inactive)</H3>
              <div className="row noprint">
                <input placeholder="Agent Name" value={na.name} onChange={(e) => setNa({ ...na, name: e.target.value })} />
                <select value={na.center} onChange={(e) => setNa({ ...na, center: e.target.value })}><option value="">Select center</option>{centers.map((c) => <option key={c}>{c}</option>)}</select>
                <input placeholder="TL Name" value={na.tl} onChange={(e) => setNa({ ...na, tl: e.target.value })} />
                <input placeholder="Onboarding Officer" value={na.oo} onChange={(e) => setNa({ ...na, oo: e.target.value })} />
                <select value={na.tenure} onChange={(e) => setNa({ ...na, tenure: e.target.value })}>{TENURES.map((t) => <option key={t}>{t}</option>)}</select>
                <input placeholder="Agent email" value={na.email} onChange={(e) => setNa({ ...na, email: e.target.value })} />
                <input placeholder="TL email" value={na.tlEmail} onChange={(e) => setNa({ ...na, tlEmail: e.target.value })} />
                <button onClick={addAgent}>+ Add agent</button>
              </div>
              <div className="sc"><table className="t"><thead><tr><th className="l">Agent Name</th><th>Center</th><th>TL Name</th><th>Onboarding Officer</th><th>Tenure</th><th>Agent Email</th><th>TL Email</th><th>Status</th><th></th></tr></thead><tbody>
                {amap.map((a, i) => { const up = (k, v) => S.saveMap(amap.map((x, j) => (j === i ? { ...x, [k]: v } : x))); return (
                  <tr key={i}>
                    <td className="l"><input value={a.name} onChange={(e) => up("name", e.target.value)} /></td>
                    <td><select value={a.center} onChange={(e) => up("center", e.target.value)}>{allCenters.map((c) => <option key={c}>{c}</option>)}</select></td>
                    <td><input value={a.tl} onChange={(e) => up("tl", e.target.value)} /></td>
                    <td><input value={a.oo || ""} onChange={(e) => up("oo", e.target.value)} /></td>
                    <td><select value={a.tenure || ""} onChange={(e) => up("tenure", e.target.value)}><option value="">-</option>{TENURES.map((t) => <option key={t}>{t}</option>)}</select></td>
                    <td><input value={a.email || ""} onChange={(e) => up("email", e.target.value)} /></td>
                    <td><input value={a.tlEmail || ""} onChange={(e) => up("tlEmail", e.target.value)} /></td>
                    <td><select value={a.active ? "1" : "0"} onChange={(e) => up("active", e.target.value === "1")}><option value="1">Active</option><option value="0">Inactive</option></select></td>
                    <td><button className="g" onClick={() => S.saveMap(amap.filter((_, j) => j !== i))}>Remove</button></td>
                  </tr>); })}
                {!amap.length && <tr><td colSpan={9} className="muted">No agents yet. Add one above or paste from Excel below.</td></tr>}
              </tbody></table></div>
              <p style={{ marginBottom: 4 }}><b>Paste from Excel in bulk</b> <span className="muted" style={{ fontSize: 13 }}>(columns: Center, Agent Name, TL Name, Status, Onboarding Officer, Tenure, Agent Email, TL Email. Write Active or Inactive in Status)</span></p>
              <textarea style={{ width: "100%", minHeight: 80 }} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"Thane\tRahul Sharma\tAmit Patil\tActive\tSujit Yadav\t0-3 Month\trahul@company.com\tamit@company.com"} />
              <div className="row"><button onClick={importBulk} disabled={!bulk.trim()}>Import</button></div>
            </div>

            <div className="c">
              <H3>Scoring parameters and who owns them</H3>
              <p className="muted" style={{ marginTop: 0 }}>Weightage is the maximum points of the parameter. The question tells the AI what to look for. <b>Owner</b> decides who gets the follow-up when the parameter is weak: the Trainer gets a training request, the TL gets a coaching request. The system checks this automatically on every audit.</p>
              <div className="sc"><table className="t"><thead><tr><th className="l">Parameter</th><th>Weightage</th><th>Owner</th><th className="l">What the AI looks for (the question)</th><th></th></tr></thead><tbody>
                {params.map((p, i) => (
                  <tr key={i}>
                    <td className="l" style={{ minWidth: 200 }}><input value={p.label} onChange={(e) => setP(i, "label", e.target.value.toUpperCase())} /></td>
                    <td style={{ width: 90 }}><input type="number" min="1" max="100" value={p.max} onChange={(e) => setP(i, "max", Math.max(1, Number(e.target.value) || 1))} /></td>
                    <td style={{ width: 120 }}><select value={p.owner === "Trainer" ? "Trainer" : "TL"} onChange={(e) => setP(i, "owner", e.target.value)}><option value="Trainer">Trainer</option><option value="TL">TL</option></select></td>
                    <td className="l" style={{ minWidth: 320 }}><input value={p.q || ""} onChange={(e) => setP(i, "q", e.target.value)} /></td>
                    <td><button className="g" onClick={() => S.saveParams(params.filter((_, j) => j !== i))}>Remove</button></td>
                  </tr>))}
              </tbody></table></div>
              <div className="row"><button onClick={() => S.saveParams([...params, { label: "NEW PARAMETER", max: 5, owner: "TL", q: "" }])}>+ Add parameter</button><button className="g" onClick={() => S.saveParams(DEFAULT_PARAMS)}>Reset to default</button><span className="muted">Total weightage: <b style={{ color: totW === 100 ? "var(--good)" : "var(--warn)" }}>{totW}</b>{totW !== 100 ? " (scores are shown as % of this total, so it does not have to be 100)" : ""}</span></div>
            </div>

            <div className="c">
              <H3>Mandatory statements</H3>
              <p className="muted" style={{ marginTop: 0 }}>One per line. Each one is checked yes / partial / no on every call.</p>
              <textarea style={{ width: "100%", minHeight: 150, fontFamily: "ui-monospace,monospace", fontSize: 13 }} value={mcfg.mand} onChange={(e) => S.saveCfg({ ...mcfg, mand: e.target.value })} />
              <div className="row"><button className="g" onClick={() => S.saveCfg({ ...mcfg, mand: DEFAULT_MAND })}>Reset to default</button></div>
            </div>

            <div className="c">
              <H3>Scoring calibration</H3>
              <p className="muted" style={{ marginTop: 0 }}>Make the AI scorer more lenient (+) or stricter (-). The shift is added to every parameter score as a % of that parameter's weightage, so the total moves by about the same number of points. Only new audits are affected.</p>
              <div className="row" style={{ flexWrap: "nowrap" }}><span className="muted">Stricter</span><input type="range" min="-20" max="20" step="1" value={mcfg.calib || 0} onChange={(e) => S.saveCfg({ ...mcfg, calib: Number(e.target.value) })} /><span className="muted">More lenient</span><b style={{ minWidth: 40, textAlign: "right" }}>{(mcfg.calib || 0) > 0 ? "+" : ""}{mcfg.calib || 0}</b></div>
            </div>

            <div className="c">
              <H3>Email and follow-ups</H3>
              <p className="muted" style={{ marginTop: 0 }}>After each audit the agent gets the feedback email (TL and CC in copy). If a parameter is weak, its owner gets a follow-up email with a form: the Trainer for Trainer-owned parameters, the TL for the rest.</p>
              <div className="row"><label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={!!mcfg.auto} onChange={(e) => S.saveCfg({ ...mcfg, auto: e.target.checked })} /> Send emails automatically after each audit</label></div>
              <div className="fg">
                <label>Trainer email(s), comma separated<input value={mcfg.trainer} onChange={(e) => S.saveCfg({ ...mcfg, trainer: e.target.value })} /></label>
                <label>CC email(s), e.g. manager<input value={mcfg.cc} onChange={(e) => S.saveCfg({ ...mcfg, cc: e.target.value })} /></label>
                <label>A parameter is weak when below (%)<input type="number" min="1" max="100" value={mcfg.weakPct} onChange={(e) => S.saveCfg({ ...mcfg, weakPct: Number(e.target.value) || 60 })} /></label>
              </div>
              <H3>Training loop emails</H3>
              <p className="muted" style={{ marginTop: 0 }}>When the Trainer or TL marks a follow-up done, the agent gets an acknowledgement link by email. Draft: the QA inbox gets a ready-to-send draft and a person clicks send. Auto: it goes to the agent by itself.</p>
              <div className="fg">
                <label>Mode<select value={mcfg.ackMode} onChange={(e) => S.saveCfg({ ...mcfg, ackMode: e.target.value })}><option value="draft">Draft for QA to send</option><option value="auto">Send automatically to the agent</option><option value="off">Off</option></select></label>
                <label>QA email (gets the drafts)<input value={mcfg.qa} onChange={(e) => S.saveCfg({ ...mcfg, qa: e.target.value })} /></label>
              </div>
              <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>Needs MAIL_USER and MAIL_PASS (Gmail app password), or RESEND_API_KEY, in the Vercel environment variables.</p>
            </div>
          </div>
        )}

        {tab === "dash" && (
          <div>
            <div className="band">
              <div className="bt"><h2>Call Quality Audit Dashboard</h2><span>{!fc.length ? "ALL CENTRES" : fc.join(", ").toUpperCase()}  |  Executive summary</span></div>
              <div className="slg noprint">
                <Slicer title="Center" opts={allCenters} sel={fc} onChange={onCenter} />
                <Slicer title="Team Leader" opts={tlOpts} sel={ftE} onChange={onTl} />
                <Slicer title="Agent" opts={agOpts} sel={faE} onChange={setFa} />
              </div>
              <div className="flt noprint">
                <label style={{ maxWidth: 260 }}>Find customer<input placeholder="Customer name or contact ID" value={q} onChange={(e) => setQ(e.target.value)} /></label>
                {[["Weekly", fw, setFw, allWeeks], ["Onboarding Officer", fo, setFo, allOos], ["Tenure", fn, setFn, TENURES], ["Strategy", fg, setFg, STRATS], ["Types of Calls", fct, setFct, CTYPES]].map(([l, v, f, o]) => <label key={l}>{l}<select value={v} onChange={(e) => f(e.target.value)}><option value="All">All</option>{o.map((x) => <option key={x}>{x}</option>)}</select></label>)}
                <label>Agent status<select value={fs} onChange={(e) => setFs(e.target.value)}><option>Active</option><option>Inactive</option><option value="All">Active + Inactive</option></select></label>
                <label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
                <label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
              </div>
            </div>
            <div className="kp">
              {[["TOTAL AUDITS", list.length, "#2f6bff"], ["AVG QUALITY SCORE", list.length ? avgAll + "%" : "-", "#10b981"], ["MANDATORY STATEMENTS MET", mAvg == null ? "-" : Math.round(mAvg) + "%", "#8b5cf6"], ["AUDITS NEEDING FOLLOW-UP", needF, "#f59e0b"], ["FOLLOW-UPS PENDING", pending, "#06b6d4"]].map(([a, b, col]) => <div key={a} className="kc" style={{ borderColor: col }}><span>{a}</span><b style={{ color: col }}>{b}</b></div>)}
            </div>
            <div className="gr">
              <div className="ch"><h4>Weekly Audits &amp; Avg Score</h4><Combo data={wkData} /></div>
              <div className="ch"><h4>Team Leader: Audits &amp; Avg Score</h4><Combo data={tlData} /></div>
              <div className="ch"><h4>Status of Call</h4><Donut data={stData} /></div>
              <div className="ch"><h4>Parameter-wise Avg Score</h4><HBars data={pw} /></div>
              <div className="ch"><h4>Tenure: Audits &amp; Avg Score</h4><Combo data={tnData} /></div>
              <div className="stk">
                <div className="ch"><h4>Types of Calls</h4><Donut data={ctData} /></div>
                <div className="ch"><h4>Strategy Used</h4><Donut data={sgData} /></div>
              </div>
            </div>
            <div className="gr">
              <div className="ch"><h4>Improvement vs Last Call</h4><Donut data={imData} /></div>
              <div className="ch"><h4>Weak parameters: who must act</h4><Donut data={ownData} /></div>
              <div className="ch"><h4>Follow-up status</h4><Donut data={[{ label: "Done", n: lt.length - pending }, { label: "Pending", n: pending }].filter((x) => x.n)} /></div>
            </div>
            <div className="c">
              <div className="row"><h3 style={{ margin: 0, flex: 1 }}>Follow-ups (Trainer and TL)</h3><button className="g" onClick={S.loadTasks}>Refresh</button></div>
              {lt.length ? (
                <div className="sc"><table className="t"><thead><tr><th>Date</th><th className="l">Agent</th><th className="l">Customer</th><th>Owner</th><th className="l">Weak parameters</th><th>Status</th><th className="l">Done by</th><th className="l">Action taken</th><th className="l">Notes</th><th>Next review</th><th>Agent ack</th><th></th></tr></thead><tbody>
                  {lt.map((t) => (
                    <tr key={t.id}><td>{new Date(t.created).toLocaleDateString("en-GB")}</td><td className="l"><b>{t.agent}</b></td><td className="l">{t.customer || "-"}{t.contactId ? ` (${t.contactId})` : ""}</td><td><span className="tag own">{t.owner === "TL" ? "TL" : "Trainer"}</span></td><td className="l">{(t.weak || []).join(", ")}</td><td><span className={"tag " + (t.status === "Submitted" ? "on1" : "warn1")}>{t.status === "Submitted" ? "Done" : "Pending"}</span></td><td className="l">{t.trainer || "-"}</td><td className="l">{t.action || "-"}</td><td className="l">{t.notes || "-"}</td><td>{t.nextReview || "-"}</td><td>{t.ackAt ? "Yes" : "-"}</td><td><button className="g" onClick={() => navigator.clipboard && navigator.clipboard.writeText(location.origin + "/training.html?id=" + t.id)}>Copy link</button></td></tr>))}
                </tbody></table></div>
              ) : <div className="empty">No follow-ups yet. When a parameter scores below the weak limit, its owner (Trainer or TL) gets an email and the form they submit shows here.</div>}
            </div>
            <div className="c">
              <div className="row">
                <h3 style={{ margin: 0, flex: 1 }}>Agent-wise report</h3>
                <button className="g" disabled={!rows.length} onClick={() => dl("agent-report.csv", [["Center", "TL Name", "Agent Name", "Status", "Audit Count", ...params.map((p) => p.label), "Total %"], ...rows.map((r) => [r.center, r.tl, r.a, r.active ? "Active" : "Inactive", r.n, ...r.cells.map((c, i) => (c == null ? "" : rd(c * params[i].max))), r.tot])])}>Report Download (Excel)</button>
                <button className="g" disabled={!list.length} onClick={() => dl("audit-wise-report.csv", [["Date", "Center", "TL Name", "Agent Name", "Customer", "Contact ID", "File", "Call Type", "Outcome", "Total %", ...params.map((p) => p.label), "Why"], ...list.map((h) => { const i = info(h); return [h.date, i.center, i.tl, h.rep, h.customer, h.contactId, h.file, h.type, h.outcome, h.total, ...params.map((p) => h.sc[p.label]?.s ?? ""), h.why]; })])}>Audit-wise Download</button>
                <button className="g" onClick={() => window.print()}>Print / PDF</button>
              </div>
              {!rows.length ? <div className="empty">No audits match these filters. Run an audit on the Audit page or change the filters.</div> : (
                <div className="sc"><table className="t"><thead><tr><th className="l">Center</th><th className="l">TL Name</th><th className="l">Agent Name</th><th>Status</th><th>Audit Count</th>{params.map((p) => <th key={p.label}>{p.label}<br />(/{p.max})</th>)}<th>Total %</th></tr></thead>
                  <tbody>
                    {rows.map((r) => <tr key={r.a}><td className="l">{r.center}</td><td className="l">{r.tl}</td><td className="l"><b>{r.a}</b></td><td><span className={"tag " + (r.active ? "on1" : "off1")}>{r.active ? "Active" : "Inactive"}</span></td><td>{r.n}</td>{r.cells.map((c, i) => <td key={i} style={{ background: heat(c == null ? null : c * 100) }}>{c == null ? "-" : rd(c * params[i].max)}</td>)}<td style={{ background: heat(r.tot), fontWeight: 700 }}>{r.tot}%</td></tr>)}
                    <tr><td className="l" colSpan={3}><b>TEAM AVERAGE</b></td><td></td><td><b>{list.length}</b></td>{colAvg.map((c, i) => <td key={i} style={{ fontWeight: 700 }}>{c == null ? "-" : rd(c * params[i].max)}</td>)}<td style={{ fontWeight: 700 }}>{avgAll}%</td></tr>
                  </tbody></table></div>
              )}
            </div>
            {rows.length > 0 && (
              <div className="cols" style={{ marginBottom: 14 }}>
                {[["Center-wise", "center"], ["TL-wise", "tl"]].map(([t, k]) => (
                  <div className="c" key={k}><H3>{t} summary</H3>
                    <table className="t"><thead><tr><th className="l">{k === "center" ? "Center" : "TL Name"}</th><th>Agents</th><th>Audits</th><th>Avg %</th></tr></thead>
                      <tbody>{grp(k).map((g) => <tr key={g.g}><td className="l">{g.g}</td><td>{g.agents}</td><td>{g.n}</td><td style={{ background: heat(g.tot), fontWeight: 700 }}>{g.tot}%</td></tr>)}</tbody></table>
                  </div>))}
                <div className="c"><H3>Parameter-wise team average</H3>
                  {params.map((p, i) => { const v = colAvg[i] == null ? 0 : colAvg[i] * 100; return <div className="bar" key={p.label}><label>{p.label}</label><i><s style={{ width: `${v}%`, background: colr(v) }} /></i><b>{Math.round(v)}%</b></div>; })}
                </div>
              </div>
            )}
            <div className="c noprint"><div className="row"><h3 style={{ margin: 0, flex: 1 }}>Call audits <span className="muted" style={{ fontWeight: 600, fontSize: 13 }}>({list.length}) &middot; click a call to see the mistakes</span></h3></div>
              {!list.length && <div className="empty">No audits match these filters yet.</div>}
              <div className="cg">
                {list.slice(0, more).map((h) => {
                  const mine = hist.filter((x) => x.rep === h.rep).sort((x, y) => (x.ts || 0) - (y.ts || 0));
                  const n = mine.findIndex((x) => x.ts === h.ts) + 1, i = info(h), nm = (h.mistakes || []).length, wk = weakOf(h).length;
                  return (
                    <div key={h.ts} className="cd" style={{ borderLeftColor: colr(h.total) }} onClick={() => setCur(h)}>
                      <div className="h"><div><b>{h.rep}</b><small>{i.center} &middot; TL: {i.tl || "-"}</small></div><span className="score" style={{ background: colr(h.total) }}>{h.total}%</span></div>
                      <div className="cu">{h.customer || "Customer not named"}{h.contactId ? <span className="muted" style={{ fontWeight: 600 }}> &middot; ID {h.contactId}</span> : null}</div>
                      <div className="m"><span>Audit {n} of {mine.length}</span><span style={{ color: nm ? "var(--bad)" : "var(--good)" }}>{nm} mistake{nm === 1 ? "" : "s"}</span><span>{wk} weak</span><span>{h.outcome}</span>{h.cmp && h.cmp.delta != null && <span style={{ color: h.cmp.delta > 0 ? "var(--good)" : h.cmp.delta < 0 ? "var(--bad)" : "var(--mute)" }}>{h.cmp.delta > 0 ? "▲" : h.cmp.delta < 0 ? "▼" : "–"} {Math.abs(h.cmp.delta)} pts</span>}</div>
                      <small style={{ marginTop: 8 }}>{(h.date || "").split(",")[0]} &middot; {h.type}{h.file ? " · " + h.file : ""}</small>
                    </div>);
                })}
              </div>
              {list.length > more && <div className="row" style={{ marginTop: 12, justifyContent: "center" }}><button className="g" onClick={() => setMore(more + 60)}>Show more ({list.length - more} left)</button></div>}
            </div>
          </div>
        )}
      </div>
      {cur && <Modal onClose={() => setCur(null)}><Detail r={cur} info={info(cur)} params={params} weakPct={mcfg.weakPct} taskMap={taskMap} busy={busy} onSend={(m) => sendMail(cur, m)} /></Modal>}
    </div>
  );
}
