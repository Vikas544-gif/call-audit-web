"use client";
import { useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import { useStore, api, getPass, nextTs, colr, rd, CTYPES, STRATS, STATUSES } from "../components/data";
import { Lock, Setup, Logo, ThemePicker, Modal, Detail } from "../components/ui";
import { mandList, weakParams } from "../../lib/defaults";
import { resolveAuto } from "../../lib/filters";

const POOL = 3; // calls processed at the same time

const normM = (m) => (Array.isArray(m) ? m : []).filter((x) => x && x.statement).map((x) => ({ statement: String(x.statement), result: ["yes", "partial", "no"].includes(String(x.result).toLowerCase()) ? String(x.result).toLowerCase() : "no", evidence: x.evidence || "" }));

function compose(res, ag, f, meta, params, calib) {
  const sc = {}; let s = 0, m = 0;
  params.forEach((p) => {
    const raw = Number(res.scores && res.scores[p.label]) || 0;
    const v = Math.max(0, Math.min(p.max, rd(raw + (p.max * calib) / 100)));
    sc[p.label] = { s: v, max: p.max }; s += v; m += p.max;
  });
  const { scores, overall, strategy: aiStrategy, callStatus: aiStatus, ...rest } = res;
  return {
    ...rest, mistakes: Array.isArray(res.mistakes) ? res.mistakes : [], mandatory: normM(res.mandatory), sc, total: m ? Math.round((s / m) * 100) : 0,
    rep: ag.name, center: ag.center, tl: ag.tl, oo: ag.oo || "", tenure: ag.tenure || "", file: f.name,
    customer: meta.customer.trim(), contactId: meta.contactId.trim(), type: meta.callType, strategy: resolveAuto(meta.strategy, STRATS, aiStrategy, "No Strategy"), cstatus: resolveAuto(meta.cstatus, STATUSES, aiStatus, "Follow-up"),
    ts: nextTs(), date: new Date().toLocaleString("en-GB"),
  };
}

export default function AuditPage() {
  const S = useStore("audit");
  const [agent, setAgent] = useState(""), [customer, setCustomer] = useState(""), [contactId, setContactId] = useState("");
  const [callType, setCallType] = useState(CTYPES[0]), [strategy, setStrategy] = useState("Auto"), [cstatus, setCstatus] = useState("Auto");
  const [files, setFiles] = useState([]), [fileKey, setFileKey] = useState(0), [jobs, setJobs] = useState([]), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const [mine, setMine] = useState([]), [cur, setCur] = useState(null);

  useEffect(() => { try { setMine(JSON.parse(sessionStorage.getItem("mine") || "[]")); } catch {} }, []);
  const keep = (list) => { try { sessionStorage.setItem("mine", JSON.stringify(list.slice(0, 40))); } catch {} return list; };
  const addMine = (a) => setMine((m) => keep([a, ...m.filter((x) => x.ts !== a.ts)]));
  const patchMine = (ts, p) => setMine((m) => keep(m.map((x) => (x.ts === ts ? { ...x, ...p } : x))));
  const setJob = (id, p) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...p } : j)));

  const active = S.amap.filter((a) => a.active !== false);
  const ag = active.find((a) => a.name.toLowerCase() === agent.trim().toLowerCase());
  const info = (h) => S.amap.find((a) => a.name.toLowerCase() === h.rep.toLowerCase()) || { center: h.center || "-", tl: h.tl || "-" };

  const processOne = async (f, id, meta, agt, params, mcfg) => {
    try {
      setJob(id, { msg: "Uploading..." });
      const blob = await upload(`calls/${Date.now()}-${f.name}`, f, { access: "public", handleUploadUrl: "/api/upload", clientPayload: getPass() });
      setJob(id, { msg: "Transcribing and scoring..." });
      const res = await api("/api/audit", { method: "POST", body: JSON.stringify({ url: blob.url, callType: meta.callType, params, mand: mandList(mcfg.mand) }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Audit failed");
      const r = compose(j.result, agt, f, meta, params, Number(mcfg.calib) || 0);
      setJob(id, { msg: "Saving..." });
      const sr = await api("/api/store", { method: "POST", body: JSON.stringify({ action: "audit", audit: r }) });
      const sj = await sr.json();
      if (!sr.ok) throw new Error(sj.error || "Could not save the audit");
      const saved = sj.audit;
      addMine(saved);
      setJob(id, { msg: "Done", done: true, score: saved.total, ts: saved.ts });
      if (mcfg.auto) {
        // the result is already on screen; the emails go out in the background
        api("/api/notify", { method: "POST", body: JSON.stringify({ audit: saved, mode: "all" }) })
          .then(async (nr) => { const nj = await nr.json(); patchMine(saved.ts, nr.ok ? { mail: nj.mail, tasks: nj.tasks } : { mail: { err: nj.error || "Email failed" } }); })
          .catch((e) => patchMine(saved.ts, { mail: { err: e.message } }));
      }
    } catch (e) { setJob(id, { msg: e.message, error: true }); }
  };

  const run = async () => {
    setErr("");
    if (!ag) { setErr("Choose an agent from the list."); return; }
    if (!customer.trim() && !contactId.trim()) { setErr("Enter the customer name or the contact ID, so the call is easy to find later."); return; }
    if (!files.length) return;
    const meta = { customer, contactId, callType, strategy, cstatus }, list = [...files];
    const init = list.map((f, i) => ({ id: `${i}-${Date.now()}`, name: f.name, msg: "Waiting..." }));
    setJobs(init); setBusy(true);
    let idx = 0;
    const worker = async () => { while (idx < list.length) { const i = idx++; await processOne(list[i], init[i].id, meta, ag, S.params, S.mcfg); } };
    await Promise.all(Array.from({ length: Math.min(POOL, list.length) }, worker));
    setBusy(false); setFiles([]); setFileKey((k) => k + 1); setCustomer(""); setContactId("");
  };

  if (!S.ready) return <div className="lock">Loading...</div>;
  if (S.locked) return <Lock title="Audit page" wrong={S.wrong} onUnlock={S.unlock} />;
  if (!S.configured || S.error) return <Setup error={S.error} />;

  return (
    <div>
      <header className="top">
        <div className="brand"><Logo /><div><b>Sales Call Audit</b><span>Audit page</span></div></div>
        {S.role === "admin" && <div className="tabs"><a href="/dashboard">Dashboard ↗</a><a href="/calls">Audited calls ↗</a></div>}
        <ThemePicker />
      </header>
      <div className="main">
        <div className="c">
          <h3>New audit</h3>
          {!active.length && <p style={{ color: "var(--bad)" }}>No active agents yet. Ask the admin to add agents in Dashboard &gt; Settings &gt; Agent mapping.</p>}
          <div className="fg">
            <label>Agent<input list="agl" placeholder="Start typing the agent name" value={agent} onChange={(e) => setAgent(e.target.value)} />
              <datalist id="agl">{active.map((a) => <option key={a.name} value={a.name}>{a.center} / TL: {a.tl || "-"}</option>)}</datalist>
              <span style={{ fontWeight: 500, color: ag ? "var(--good)" : "var(--mute)" }}>{ag ? `${ag.center} · TL: ${ag.tl || "-"}` : "Pick a name from the list"}</span></label>
            <label>Customer name<input placeholder="e.g. Ramesh Kulkarni" value={customer} onChange={(e) => setCustomer(e.target.value)} /></label>
            <label>Contact ID<input placeholder="contact_id" value={contactId} onChange={(e) => setContactId(e.target.value)} /></label>
          </div>
          <div className="fg">
            <label>Call type<select value={callType} onChange={(e) => setCallType(e.target.value)}>{CTYPES.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label>Strategy<select value={strategy} onChange={(e) => setStrategy(e.target.value)}><option value="Auto">Auto (AI decides)</option>{STRATS.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label>Call status<select value={cstatus} onChange={(e) => setCstatus(e.target.value)}><option value="Auto">Auto (AI decides)</option>{STATUSES.map((x) => <option key={x}>{x}</option>)}</select></label>
          </div>
          <input key={fileKey} type="file" accept="audio/*" multiple onChange={(e) => setFiles([...e.target.files])} />
          <div style={{ marginTop: 10 }}><button disabled={busy || !files.length} onClick={run}>{busy ? "Running..." : `Run audit${files.length ? ` (${files.length} ${files.length === 1 ? "call" : "calls"})` : ""}`}</button>
            {files.length > 1 && <span className="muted" style={{ marginLeft: 10, fontSize: 13 }}>{POOL} calls run at the same time. All files get the customer details above.</span>}</div>
          {err && <p style={{ color: "var(--bad)" }}>{err}</p>}
        </div>

        {jobs.length > 0 && (
          <div className="c"><h3>Progress</h3>
            {jobs.map((j) => (
              <div className="job" key={j.id}>
                {!j.done && !j.error && <span className="spin" />}
                <span className="nm">{j.name}</span>
                <span style={{ color: j.error ? "var(--bad)" : j.done ? "var(--good)" : "var(--mute)", fontWeight: 600 }}>{j.msg}</span>
                {j.done && <span className="score" style={{ background: colr(j.score) }}>{j.score}%</span>}
                {j.done && <button className="g" onClick={() => setCur(mine.find((x) => x.ts === j.ts) || null)}>View</button>}
              </div>))}
          </div>)}

        <div className="c"><h3>Your audits in this session <span className="muted" style={{ fontWeight: 600, fontSize: 13 }}>({mine.length})</span></h3>
          {!mine.length && <div className="empty">Audits you run will show here. Click one to see the mistakes.</div>}
          <div className="cg">
            {mine.map((h) => { const nm = (h.mistakes || []).length, wk = weakParams(h, S.params, S.mcfg.weakPct).length; return (
              <div key={h.ts} className="cd" style={{ borderLeftColor: colr(h.total) }} onClick={() => setCur(h)}>
                <div className="h"><div><b>{h.customer || "Customer not named"}</b><small>{h.contactId ? `Contact ID: ${h.contactId}` : "No contact ID"}</small></div><span className="score" style={{ background: colr(h.total) }}>{h.total}%</span></div>
                <div className="cu muted">{h.rep} · {info(h).center}</div>
                <div className="m"><span style={{ color: nm ? "var(--bad)" : "var(--good)" }}>{nm} mistake{nm === 1 ? "" : "s"}</span><span>{wk} weak parameter{wk === 1 ? "" : "s"}</span><span>{h.outcome}</span>{h.mail && h.mail.agent && <span>Email sent</span>}</div>
              </div>); })}
          </div>
        </div>
      </div>
      {cur && <Modal onClose={() => setCur(null)}><Detail r={cur} info={info(cur)} params={S.params} weakPct={S.mcfg.weakPct} taskMap={{}} /></Modal>}
    </div>
  );
}
