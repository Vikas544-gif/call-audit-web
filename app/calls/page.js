"use client";
import { useEffect, useState } from "react";
import { useStore, api, colr, avg, uniq, fmtDur } from "../components/data";
import { Gate, AdminNav, Modal, Detail } from "../components/ui";
import { FilterBar, useFilters } from "../components/filters";
import { infoOf, custKey } from "../../lib/filters";
import { weakParams } from "../../lib/defaults";

const dayOf = (ts) => new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const timeOf = (ts) => new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export default function CallsPage() {
  const S = useStore("full");
  const F = useFilters(S);
  const { params, amap, mcfg, tasks } = S;
  const hist = S.audits, list = F.V.list;
  const [view, setView] = useState("cust"), [open, setOpen] = useState(null), [busy, setBusy] = useState(false), [more, setMore] = useState(60);

  useEffect(() => {
    if (!S.configured || S.locked) return;
    const t = setInterval(() => { if (!busy) S.refresh(); }, 45000);
    return () => clearInterval(t);
  }, [S.configured, S.locked, busy]);

  const info = (h) => infoOf(amap, h);
  const taskMap = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const weakOf = (h) => weakParams(h, params, mcfg.weakPct);

  // one group per customer: the calls of the same customer sit in one card
  const groups = (() => {
    const m = new Map();
    list.forEach((h) => { const k = custKey(h); if (!m.has(k)) m.set(k, []); m.get(k).push(h); });
    return [...m.entries()].map(([key, calls]) => { calls.sort((a, b) => a.ts - b.ts); const latest = calls[calls.length - 1]; return { key, calls, latest, reps: uniq(calls.map((c) => c.rep)) }; }).sort((a, b) => b.latest.ts - a.latest.ts);
  })();

  const sendMail = async (r, mode) => {
    setBusy(true);
    try {
      const res = await api("/api/notify", { method: "POST", body: JSON.stringify({ audit: r, mode }) });
      const j = await res.json();
      const u = res.ok ? { ...r, mail: j.mail, tasks: j.tasks } : { ...r, mail: { ...(r.mail || {}), err: j.error || "Email failed" } };
      S.setAudits(hist.map((x) => (x.ts === r.ts ? u : x))); S.loadTasks();
    } catch (e) { S.setAudits(hist.map((x) => (x.ts === r.ts ? { ...r, mail: { ...(r.mail || {}), err: e.message } } : x))); }
    setBusy(false);
  };

  const delAudits = async (tss, question) => {
    if (!window.confirm(question)) return;
    setBusy(true);
    try {
      const res = await api("/api/store", { method: "POST", body: JSON.stringify({ action: "delete", tss }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not delete");
      const gone = new Set(tss.map(Number));
      const rest = open ? (groups.find((g) => g.key === open.key) || { calls: [] }).calls.filter((c) => !gone.has(c.ts)) : [];
      S.setAudits(hist.filter((h) => !gone.has(h.ts))); S.loadTasks();
      setOpen(open && rest.length ? { key: open.key, ts: rest[rest.length - 1].ts } : null);
    } catch (e) { window.alert(e.message); }
    setBusy(false);
  };
  const askOne = (h) => delAudits([h.ts], `Delete this audit${h.customer ? " of " + h.customer : ""}? Its script, recording and follow-ups are removed too. This cannot be undone.`);
  const askGroup = (g) => delAudits(g.calls.map((c) => c.ts), `Delete all ${g.calls.length} audits of ${g.latest.customer || "this customer"}? Their scripts, recordings and follow-ups are removed too. This cannot be undone.`);

  // a card for one call
  const callCard = (h, g) => {
    const mine = hist.filter((x) => x.rep === h.rep).sort((x, y) => (x.ts || 0) - (y.ts || 0));
    const n = mine.findIndex((x) => x.ts === h.ts) + 1, i = info(h), nm = (h.mistakes || []).length, wk = weakOf(h).length;
    return (
      <div key={h.ts} className="cd" onClick={() => setOpen({ key: g ? g.key : custKey(h), ts: h.ts })}>
        <div className="h"><div><b>{h.customer || "Customer not named"}</b><small>{h.contactId ? "ID " + h.contactId : "No contact ID"}</small></div><span className="score" style={{ background: colr(h.total) }}>{h.total}%</span></div>
        <div className="cu">{h.rep}<span className="muted" style={{ fontWeight: 400 }}>, {i.center}, TL {i.tl || "-"}</span></div>
        <div className="m"><span>Audit {n} of {mine.length}</span><span style={{ color: nm ? "var(--bad)" : "var(--good)" }}>{nm} mistake{nm === 1 ? "" : "s"}</span><span>{wk} weak</span><span>{h.outcome}</span>{h.cmp && h.cmp.delta != null && <span style={{ color: h.cmp.delta > 0 ? "var(--good)" : h.cmp.delta < 0 ? "var(--bad)" : "var(--mute)" }}>{h.cmp.delta > 0 ? "▲" : h.cmp.delta < 0 ? "▼" : "–"} {Math.abs(h.cmp.delta)} pts</span>}</div>
        <small style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}><span>{dayOf(h.ts)}, {timeOf(h.ts)}</span><span>{h.type}</span>{h.durationSec ? <span>{fmtDur(h.durationSec)} min</span> : null}<button className="cdx" disabled={busy} onClick={(e) => { e.stopPropagation(); askOne(h); }} aria-label="Delete this audit">Delete</button></small>
      </div>);
  };
  // a card for a customer with 2 or more audited calls
  const groupCard = (g) => {
    const L = g.latest, nm = g.calls.reduce((x, c) => x + (c.mistakes || []).length, 0);
    return (
      <div key={g.key} className="cd grp" onClick={() => setOpen({ key: g.key, ts: L.ts })}>
        <div className="h"><div><b>{L.customer || "Customer not named"}</b><small>{L.contactId ? "ID " + L.contactId : "No contact ID"}</small></div><span className="score" style={{ background: colr(L.total) }} title="Latest call">{L.total}%</span></div>
        <div className="cu">{g.reps.join(", ")}<span className="muted" style={{ fontWeight: 400 }}>, {info(L).center}</span></div>
        <div className="m"><span style={{ background: "var(--accent)", color: "#fff" }}>{g.calls.length} audits</span><span>avg {Math.round(avg(g.calls.map((c) => c.total)))}%</span>{g.calls.some((c) => c.durationSec) ? <span>{fmtDur(g.calls.reduce((x, c) => x + (c.durationSec || 0), 0))} min in total</span> : null}<span style={{ color: nm ? "var(--bad)" : "var(--good)" }}>{nm} mistake{nm === 1 ? "" : "s"}</span></div>
        <div className="strip" aria-label="Score of each call, oldest first">{g.calls.map((c, i) => <i key={c.ts} style={{ background: colr(c.total) }} title={`Call ${i + 1}: ${c.total}% on ${dayOf(c.ts)}`}>{c.total}</i>)}</div>
        <small style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}><span>{dayOf(g.calls[0].ts)} to {dayOf(L.ts)}</span><button className="cdx" disabled={busy} onClick={(e) => { e.stopPropagation(); askGroup(g); }} aria-label={`Delete all ${g.calls.length} audits`}>Delete all</button></small>
      </div>);
  };

  // one card per agent
  const agents = uniq(list.map((h) => h.rep)).map((name) => {
    const au = list.filter((h) => h.rep === name).sort((a, b) => b.ts - a.ts), i = info(au[0]), wk = {};
    au.forEach((h) => weakOf(h).forEach((w) => { wk[w.label] = (wk[w.label] || 0) + 1; }));
    return { name, center: i.center, tl: i.tl, n: au.length, avg: Math.round(avg(au.map((h) => h.total))), last: au[0].total, delta: au[1] ? au[0].total - au[1].total : null, top: Object.entries(wk).sort((a, b) => b[1] - a[1]).slice(0, 3), lastTs: au[0].ts };
  }).sort((a, b) => b.lastTs - a.lastTs);

  const og = open ? groups.find((g) => g.key === open.key) : null;
  const sel = og ? og.calls.find((c) => c.ts === open.ts) || og.latest : null;

  return (
    <Gate S={S} title="Audited calls">
      <AdminNav active="/calls" S={S} sub="Audited calls" />
      <div className="main">
        <FilterBar F={F} title="Audited Calls" sub="Every audit, with the customer and the mistakes" />
        <div className="row noprint" style={{ marginBottom: 14 }}>
          <div className="seg">
            <button className={view === "cust" ? "on" : ""} onClick={() => setView("cust")}>By customer ({groups.length})</button>
            <button className={view === "calls" ? "on" : ""} onClick={() => setView("calls")}>By call ({list.length})</button>
            <button className={view === "agents" ? "on" : ""} onClick={() => setView("agents")}>By agent ({agents.length})</button>
          </div>
          <span className="muted" style={{ fontSize: 13 }}>{view === "cust" ? "The calls of one customer are in one card. Open a card to choose a call." : view === "calls" ? "One card for every call." : "Click an agent to see only that agent's calls."}</span>
        </div>

        {view === "agents" && (
          <div>
            {!agents.length && <div className="empty">No audits match these filters.</div>}
            <div className="cg">
              {agents.map((a) => (
                <div key={a.name} className="ag" style={{ cursor: "pointer" }} onClick={() => { F.apply({ fa: [a.name] }); setView("cust"); }}>
                  <div className="row" style={{ marginBottom: 4 }}><div style={{ flex: 1 }}><h4>{a.name}</h4><small>{a.center}, TL {a.tl || "-"}</small></div><span className="score" style={{ background: colr(a.avg) }}>{a.avg}%</span></div>
                  <div className="m row" style={{ gap: 6, fontSize: 12, marginBottom: 6 }}>
                    <span className="tag own">{a.n} audit{a.n === 1 ? "" : "s"}</span><span className="tag own">Last {a.last}%</span>
                    {a.delta != null && <span className={"tag " + (a.delta > 0 ? "on1" : a.delta < 0 ? "bad" : "off1")}>{a.delta > 0 ? "▲" : a.delta < 0 ? "▼" : "–"} {Math.abs(a.delta)} pts</span>}
                  </div>
                  <small>{a.top.length ? "Often weak: " + a.top.map(([l, n]) => `${l} (${n})`).join(", ") : "No weak parameters"}</small>
                </div>))}
            </div>
          </div>
        )}

        {view !== "agents" && (
          <div>
            {!list.length && <div className="empty">No audits match these filters yet.</div>}
            <div className="cg">
              {view === "cust" ? groups.slice(0, more).map((g) => (g.calls.length > 1 ? groupCard(g) : callCard(g.latest, g))) : list.slice(0, more).map((h) => callCard(h))}
            </div>
            {(view === "cust" ? groups.length : list.length) > more && <div className="row" style={{ marginTop: 12, justifyContent: "center" }}><button className="g" onClick={() => setMore(more + 60)}>Show more ({(view === "cust" ? groups.length : list.length) - more} left)</button></div>}
          </div>
        )}
      </div>
      {open && og && sel && (
        <Modal onClose={() => setOpen(null)}>
          {og.calls.length > 1 && (
            <div>
              <div className="cust-h"><h3>{sel.customer || "Customer not named"}</h3>{sel.contactId ? <span className="muted">Contact ID {sel.contactId}</span> : null}<span className="tag own">{og.calls.length} audited calls</span></div>
              <div className="cpick" role="tablist" aria-label="Choose a call">
                {og.calls.map((c, i) => (
                  <button key={c.ts} role="tab" aria-selected={c.ts === sel.ts} className={"cpk" + (c.ts === sel.ts ? " on" : "")} onClick={() => setOpen({ key: og.key, ts: c.ts })}>
                    <span className="cpk-n">Call {i + 1}{i === og.calls.length - 1 ? " (latest)" : ""}</span>
                    <b>{dayOf(c.ts)}</b>
                    <span>{timeOf(c.ts)}{c.durationSec ? `, ${fmtDur(c.durationSec)} min` : ""}</span>
                    <span className="cpk-r"><span className="score" style={{ background: colr(c.total) }}>{c.total}%</span><small>{c.rep}</small></span>
                  </button>))}
              </div>
            </div>)}
          <Detail key={sel.ts} r={sel} info={info(sel)} params={params} weakPct={mcfg.weakPct} taskMap={taskMap} busy={busy} onSend={(m) => sendMail(sel, m)} onDelete={() => askOne(sel)} />
        </Modal>)}
    </Gate>
  );
}
