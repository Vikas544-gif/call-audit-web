"use client";
import { useEffect, useState } from "react";
import { useStore, api, colr, avg, uniq, fmtDur } from "../components/data";
import { Gate, AdminNav, Modal, Detail } from "../components/ui";
import { FilterBar, useFilters } from "../components/filters";
import { infoOf } from "../../lib/filters";
import { weakParams } from "../../lib/defaults";

export default function CallsPage() {
  const S = useStore("full");
  const F = useFilters(S);
  const { params, amap, mcfg, tasks } = S;
  const hist = S.audits, list = F.V.list;
  const [view, setView] = useState("calls"), [cur, setCur] = useState(null), [busy, setBusy] = useState(false), [more, setMore] = useState(60);

  useEffect(() => {
    if (!S.configured || S.locked) return;
    const t = setInterval(() => { if (!busy) S.refresh(); }, 45000);
    return () => clearInterval(t);
  }, [S.configured, S.locked, busy]);

  const info = (h) => infoOf(amap, h);
  const taskMap = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const weakOf = (h) => weakParams(h, params, mcfg.weakPct);

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

  // one card per audited agent
  const agents = uniq(list.map((h) => h.rep)).map((name) => {
    const au = list.filter((h) => h.rep === name).sort((a, b) => b.ts - a.ts), i = info(au[0]), wk = {};
    au.forEach((h) => weakOf(h).forEach((w) => { wk[w.label] = (wk[w.label] || 0) + 1; }));
    return { name, center: i.center, tl: i.tl, n: au.length, avg: Math.round(avg(au.map((h) => h.total))), last: au[0].total, delta: au[1] ? au[0].total - au[1].total : null, top: Object.entries(wk).sort((a, b) => b[1] - a[1]).slice(0, 3), lastTs: au[0].ts };
  }).sort((a, b) => b.lastTs - a.lastTs);

  return (
    <Gate S={S} title="Audited calls">
      <AdminNav active="/calls" S={S} sub="Audited calls" />
      <div className="main">
        <FilterBar F={F} title="Audited Calls" sub="Every audit, with the customer and the mistakes" />
        <div className="row noprint" style={{ marginBottom: 14 }}>
          <div className="seg"><button className={view === "calls" ? "on" : ""} onClick={() => setView("calls")}>By call ({list.length})</button><button className={view === "agents" ? "on" : ""} onClick={() => setView("agents")}>By agent ({agents.length})</button></div>
          <span className="muted" style={{ fontSize: 13 }}>{view === "calls" ? "Click a call to see the mistakes." : "Click an agent to see only that agent's calls."}</span>
        </div>

        {view === "agents" && (
          <div>
            {!agents.length && <div className="empty">No audits match these filters.</div>}
            <div className="cg">
              {agents.map((a) => (
                <div key={a.name} className="ag" style={{ borderLeftColor: colr(a.avg), cursor: "pointer" }} onClick={() => { F.apply({ fa: [a.name] }); setView("calls"); }}>
                  <div className="row" style={{ marginBottom: 4 }}><div style={{ flex: 1 }}><h4>{a.name}</h4><small>{a.center} &middot; TL: {a.tl || "-"}</small></div><span className="score" style={{ background: colr(a.avg) }}>{a.avg}%</span></div>
                  <div className="m row" style={{ gap: 6, fontSize: 12, marginBottom: 6 }}>
                    <span className="tag own">{a.n} audit{a.n === 1 ? "" : "s"}</span><span className="tag own">Last {a.last}%</span>
                    {a.delta != null && <span className={"tag " + (a.delta > 0 ? "on1" : a.delta < 0 ? "bad" : "off1")}>{a.delta > 0 ? "▲" : a.delta < 0 ? "▼" : "–"} {Math.abs(a.delta)} pts</span>}
                  </div>
                  <small>{a.top.length ? "Often weak: " + a.top.map(([l, n]) => `${l} (${n})`).join(", ") : "No weak parameters"}</small>
                </div>))}
            </div>
          </div>
        )}

        {view === "calls" && (
          <div>
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
                    <small style={{ marginTop: 8 }}>{(h.date || "").split(",")[0]} &middot; {h.type}{h.durationSec ? " · " + fmtDur(h.durationSec) + " min" : ""}{h.file ? " · " + h.file : ""}</small>
                  </div>);
              })}
            </div>
            {list.length > more && <div className="row" style={{ marginTop: 12, justifyContent: "center" }}><button className="g" onClick={() => setMore(more + 60)}>Show more ({list.length - more} left)</button></div>}
          </div>
        )}
      </div>
      {cur && <Modal onClose={() => setCur(null)}><Detail r={cur} info={info(cur)} params={params} weakPct={mcfg.weakPct} taskMap={taskMap} busy={busy} onSend={(m) => sendMail(cur, m)} /></Modal>}
    </Gate>
  );
}
