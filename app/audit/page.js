"use client";
import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { useStore, api, getPass, nextTs, colr, fmtDur, CTYPES, STRATS, STATUSES } from "../components/data";
import { Lock, Setup, Logo, ThemePicker, Modal, Detail } from "../components/ui";
import { mandList, weakParams } from "../../lib/defaults";
import { composeAudit } from "../../lib/compose";

const POOL = 4; // calls processed at the same time
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fkey = (f) => `${f.name}|${f.size}|${f.lastModified}`;

export default function AuditPage() {
  const S = useStore("audit");
  const [agent, setAgent] = useState(""), [customer, setCustomer] = useState(""), [contactId, setContactId] = useState("");
  const [callType, setCallType] = useState(CTYPES[0]), [strategy, setStrategy] = useState("Auto"), [cstatus, setCstatus] = useState("Auto");
  const [files, setFiles] = useState([]), [fileKey, setFileKey] = useState(0), [jobs, setJobs] = useState([]), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const [mine, setMine] = useState([]), [cur, setCur] = useState(null), [drag, setDrag] = useState(false);
  const urls = useRef({}), [dur, setDur] = useState({}), [audioMap, setAudioMap] = useState({});

  // every chosen call gets a player and its length (read in the browser, nothing is uploaded for this)
  useEffect(() => {
    files.forEach((f) => {
      const k = fkey(f);
      if (urls.current[k]) return;
      // if the browser cannot make a preview, the audit still works (just without the player)
      try {
        const u = URL.createObjectURL(f);
        urls.current[k] = u;
        const a = new Audio();
        a.preload = "metadata";
        a.onloadedmetadata = () => setDur((d) => ({ ...d, [k]: a.duration }));
        a.onerror = () => setDur((d) => ({ ...d, [k]: -1 }));
        a.src = u;
      } catch { urls.current[k] = ""; setDur((d) => ({ ...d, [k]: -1 })); }
    });
  }, [files]);
  const totalSec = files.reduce((x, f) => x + (dur[fkey(f)] > 0 ? dur[fkey(f)] : 0), 0);

  useEffect(() => { try { setMine(JSON.parse(sessionStorage.getItem("mine") || "[]")); } catch {} }, []);
  const keep = (list) => { try { sessionStorage.setItem("mine", JSON.stringify(list.slice(0, 30))); } catch {} return list; };
  const addMine = (a) => setMine((m) => keep([a, ...m.filter((x) => x.ts !== a.ts)]));
  const patchMine = (ts, p) => setMine((m) => keep(m.map((x) => (x.ts === ts ? { ...x, ...p } : x))));
  const setJob = (id, p) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...p } : j)));

  const active = S.amap.filter((a) => a.active !== false);
  const ag = active.find((a) => a.name.trim().toLowerCase() === agent.trim().toLowerCase());
  const info = (h) => S.amap.find((a) => a.name.toLowerCase() === h.rep.toLowerCase()) || { center: h.center || "-", tl: h.tl || "-" };

  // upload -> transcribe (the browser asks every second) -> AI scoring -> save -> emails in the background
  const processOne = async (f, id, meta0, agt, params, mcfg) => {
    const meta = { ...meta0, durationSec: dur[fkey(f)] > 0 ? Math.round(dur[fkey(f)]) : null };
    const t0 = Date.now(), el = () => Math.round((Date.now() - t0) / 1000) + "s";
    try {
      setJob(id, { msg: "Uploading..." });
      const blob = await upload(`calls/${Date.now()}-${f.name}`, f, { access: "public", handleUploadUrl: "/api/upload", clientPayload: getPass() });
      setJob(id, { msg: "Transcribing... 0s" });
      const st = await api("/api/transcribe", { method: "POST", body: JSON.stringify({ url: blob.url }) });
      const sj = await st.json();
      if (!st.ok) throw new Error(sj.error || "Could not start the transcription");
      let transcript = null, kept = false;
      for (let i = 0; i < 700 && !transcript; i++) {
        await sleep(i < 5 ? 1000 : i < 25 ? 2000 : 3000); // quick at first, then calmer (fewer server calls on long calls)
        const pr = await api("/api/transcribe?id=" + encodeURIComponent(sj.id));
        const pj = await pr.json();
        if (!pr.ok) throw new Error(pj.error || "Transcription failed");
        if (pj.status === "error") throw new Error(pj.error || "Transcription failed");
        if (pj.status === "completed") { transcript = pj.transcript; kept = !!pj.kept; } else setJob(id, { msg: `Transcribing... ${el()}` });
      }
      if (!transcript) throw new Error("Transcription is taking too long");
      setJob(id, { msg: `Scoring... ${el()}` });
      const res = await api("/api/audit", { method: "POST", body: JSON.stringify({ transcript, callType: meta.callType, params, mand: mandList(mcfg.mand) }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Audit failed");
      const r = composeAudit({ res: j.result, ag: agt, file: f.name, meta, params, mcfg, transcript: j.transcript, ts: nextTs(), date: new Date().toLocaleString("en-GB") });
      setJob(id, { msg: "Saving..." });
      const sr = await api("/api/store", { method: "POST", body: JSON.stringify({ action: "audit", audit: r, transcript: j.transcript, audioId: kept ? sj.id : undefined }) });
      const sv = await sr.json();
      if (!sr.ok) throw new Error(sv.error || "Could not save the audit");
      const saved = sv.audit;
      addMine({ ...saved, transcript: j.transcript });
      if (urls.current[fkey(f)]) setAudioMap((m) => ({ ...m, [saved.ts]: urls.current[fkey(f)] }));
      setJob(id, { msg: `Done in ${el()}`, done: true, score: saved.total, ts: saved.ts });
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
    const init = list.map((f, i) => ({ id: `${i}-${Date.now()}`, name: f.name + (dur[fkey(f)] > 0 ? ` (${fmtDur(dur[fkey(f)])} min)` : ""), msg: "Waiting..." }));
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
        {S.role === "admin" && <div className="tabs"><a href="/dashboard">Dashboard ↗</a><a href="/calls">Audited calls ↗</a><a href="/mistakes">AI Mistakes ↗</a></div>}
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
          <label className={"drop" + (drag ? " on" : "")} onDragOver={(e) => { e.preventDefault(); if (!busy) setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); if (busy) return; const fl = [...e.dataTransfer.files].filter((f) => /^audio\//.test(f.type) || /\.(mp3|wav|m4a|aac|ogg|amr|mp4)$/i.test(f.name)); if (fl.length) setFiles(fl); }}>
            <input className="vh" key={fileKey} type="file" accept="audio/*" multiple onChange={(e) => setFiles([...e.target.files])} disabled={busy} />
            <b>{files.length ? "Choose different recordings" : "Drop call recordings here"}</b>
            <span>or click to choose files. MP3, WAV, M4A. You can add many calls at once.</span>
          </label>
          {files.length > 0 && (
            <div>
              <div className="muted" style={{ marginTop: 8, fontSize: 13 }}><b>{files.length}</b> {files.length === 1 ? "call" : "calls"} selected{totalSec > 0 ? <span> &middot; total <b>{Math.round(totalSec / 60)} min</b></span> : null}. You can listen to each call before you run the audit.</div>
              {files.map((f, i) => { const k = fkey(f), d = dur[k]; return (
                <div className="fb" key={k + i}>
                  <div className="fbh"><b title={f.name}>{f.name}</b><span className="tag own">{d == null ? "reading..." : d > 0 ? fmtDur(d) + " min" : "length unknown"}</span><span className="muted" style={{ fontSize: 12 }}>{(f.size / 1048576).toFixed(1)} MB</span>{!busy && <button className="g" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setFiles(files.filter((_, j) => j !== i))}>Remove</button>}</div>
                  {urls.current[k] ? <audio controls preload="metadata" src={urls.current[k]} style={{ width: "100%" }} /> : null}
                </div>); })}
            </div>)}
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
          {!mine.length && <div className="empty">Audits you run will show here. Click one to see the mistakes and the call script.</div>}
          <div className="cg">
            {mine.map((h) => { const nm = (h.mistakes || []).length + (h.aiMistakes || []).length, wk = weakParams(h, S.params, S.mcfg.weakPct).length; return (
              <div key={h.ts} className="cd" onClick={() => setCur(h)}>
                <div className="h"><div><b>{h.customer || "Customer not named"}</b><small>{h.contactId ? `Contact ID: ${h.contactId}` : "No contact ID"}</small></div><span className="score" style={{ background: colr(h.total) }}>{h.total}%</span></div>
                <div className="cu muted">{h.rep}, {info(h).center}</div>
                <div className="m">{h.durationSec ? <span>{fmtDur(h.durationSec)} min</span> : null}{audioMap[h.ts] ? <span>🎧 Listen</span> : null}<span style={{ color: nm ? "var(--bad)" : "var(--good)" }}>{nm} mistake{nm === 1 ? "" : "s"}</span><span>{wk} weak parameter{wk === 1 ? "" : "s"}</span><span>{h.outcome}</span>{(h.delayPenalty || 0) > 0 && <span style={{ color: "var(--bad)" }}>Late opening</span>}{h.mail && h.mail.agent && <span>Email sent</span>}</div>
              </div>); })}
          </div>
        </div>
      </div>
      {cur && <Modal onClose={() => setCur(null)}><Detail r={cur} info={info(cur)} params={S.params} weakPct={S.mcfg.weakPct} taskMap={{}} audioUrl={audioMap[cur.ts]} /></Modal>}
    </div>
  );
}
