"use client";
import { useEffect, useState } from "react";
import { useStore } from "../components/data";
import { Gate, AdminNav, Modal, Detail } from "../components/ui";
import { infoOf, norm } from "../../lib/filters";

export default function FollowupsPage() {
  const S = useStore("full");
  const { params, amap, mcfg, tasks, audits } = S;
  const [owner, setOwner] = useState("All"), [status, setStatus] = useState("All"), [q, setQ] = useState(""), [cur, setCur] = useState(null);
  useEffect(() => {
    if (!S.configured || S.locked) return;
    const t = setInterval(() => S.loadTasks(), 30000);
    return () => clearInterval(t);
  }, [S.configured, S.locked]);

  const done = (t) => t.status === "Submitted";
  const rows = tasks.filter((t) => (owner === "All" || t.owner === owner) && (status === "All" || (status === "Done" ? done(t) : !done(t))) &&
    (!q.trim() || [t.agent, t.customer, t.contactId, t.tl, (t.weak || []).join(" ")].some((x) => norm(x).includes(norm(q)))));
  const cnt = (o, d) => tasks.filter((t) => t.owner === o && done(t) === d).length;
  const taskMap = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const open = (t) => { const a = audits.find((x) => x.ts === t.auditTs); if (a) setCur(a); };

  return (
    <Gate S={S} title="Follow-ups">
      <AdminNav active="/followups" S={S} sub="Follow-ups" />
      <div className="main">
        <div className="kp">
          {[["Trainer: pending", cnt("Trainer", false)], ["Trainer: done", cnt("Trainer", true)], ["TL: pending", cnt("TL", false)], ["TL: done", cnt("TL", true)], ["Agent acknowledged", tasks.filter((t) => t.ackAt).length]].map(([a, b]) => <div key={a} className="kc"><span>{a}</span><b>{b}</b></div>)}
        </div>
        <div className="c">
          <div className="row">
            <h3 style={{ margin: 0, flex: 1 }}>Follow-ups (Trainer and TL)</h3>
            <select value={owner} onChange={(e) => setOwner(e.target.value)}><option value="All">Owner: All</option><option value="Trainer">Trainer</option><option value="TL">TL</option></select>
            <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="All">Status: All</option><option>Pending</option><option>Done</option></select>
            <input placeholder="Search agent, customer, contact ID" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 240 }} />
            <button className="g" onClick={S.loadTasks}>Refresh</button>
          </div>
          {rows.length ? (
            <div className="sc"><table className="t"><thead><tr><th>Date</th><th className="l">Agent</th><th className="l">Customer</th><th>Owner</th><th className="l">Weak parameters</th><th>Status</th><th className="l">Done by</th><th className="l">Action taken</th><th className="l">Notes</th><th>Next review</th><th>Agent ack</th><th></th></tr></thead><tbody>
              {rows.map((t) => (
                <tr key={t.id}><td>{new Date(t.created).toLocaleDateString("en-GB")}</td><td className="l"><b>{t.agent}</b><br /><small className="muted">{infoOf(amap, { rep: t.agent }).center} · TL {t.tl || "-"}</small></td><td className="l">{t.customer || "-"}{t.contactId ? <div className="muted">ID {t.contactId}</div> : null}</td><td><span className="tag own">{t.owner === "TL" ? "TL" : "Trainer"}</span></td><td className="l">{(t.weak || []).join(", ")}</td><td><span className={"tag " + (done(t) ? "on1" : "warn1")}>{done(t) ? "Done" : "Pending"}</span></td><td className="l">{t.trainer || "-"}</td><td className="l">{t.action || "-"}</td><td className="l">{t.notes || "-"}</td><td>{t.nextReview || "-"}</td><td>{t.ackAt ? "Yes" : "-"}</td>
                  <td style={{ whiteSpace: "nowrap" }}><button className="g" onClick={() => open(t)} disabled={!audits.find((x) => x.ts === t.auditTs)}>View call</button> <button className="g" onClick={() => navigator.clipboard && navigator.clipboard.writeText(location.origin + "/training.html?id=" + t.id)}>Copy link</button></td></tr>))}
            </tbody></table></div>
          ) : <div className="empty">No follow-ups match. When a parameter scores below the weak limit ({mcfg.weakPct}%), its owner (Trainer or TL) gets an email, and the form they submit shows here.</div>}
        </div>
      </div>
      {cur && <Modal onClose={() => setCur(null)}><Detail r={cur} info={infoOf(amap, cur)} params={params} weakPct={mcfg.weakPct} taskMap={taskMap} /></Modal>}
    </Gate>
  );
}
