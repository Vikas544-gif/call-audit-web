"use client";
import { useEffect } from "react";
import { useStore, dl, colr, heat, rd, avg, uniq, wkLbl, mandScore, pct, TENURES } from "../components/data";
import { Gate, AdminNav, Combo, Donut, HBars } from "../components/ui";
import { FilterBar, useFilters } from "../components/filters";
import { infoOf } from "../../lib/filters";
import { weakParams } from "../../lib/defaults";

export default function DashboardPage() {
  const S = useStore("full");
  const F = useFilters(S);
  const { params, amap, mcfg, tasks } = S;
  const list = F.V.list;

  useEffect(() => {
    if (!S.configured || S.locked) return;
    const t = setInterval(() => S.refresh(), 45000);
    return () => clearInterval(t);
  }, [S.configured, S.locked]);

  const info = (h) => infoOf(amap, h);
  const weakOf = (h) => weakParams(h, params, mcfg.weakPct);
  const rows = uniq(list.map((h) => h.rep)).map((a) => {
    const au = list.filter((h) => h.rep === a), i = info(au[0]);
    return { a, center: i.center, tl: i.tl, active: i.active, n: au.length, tot: Math.round(avg(au.map((h) => h.total))), cells: params.map((p) => avg(au.filter((h) => h.sc[p.label]).map((h) => h.sc[p.label].s / h.sc[p.label].max))) };
  }).sort((x, y) => (x.center + x.tl + x.a).localeCompare(y.center + y.tl + y.a));
  const colAvg = params.map((_, i) => avg(rows.map((r) => r.cells[i]).filter((x) => x != null)));
  const avgAll = list.length ? rd(avg(list.map((h) => h.total))) : 0;
  const grp = (key) => uniq(rows.map((r) => r[key])).map((g) => { const rr = rows.filter((r) => r[key] === g); return { g, agents: rr.length, n: rr.reduce((x, r) => x + r.n, 0), tot: Math.round(avg(rr.map((r) => r.tot))) }; });
  const by = (key, cmp) => { const g = {}; list.forEach((h) => { const k = key(h) || "-"; (g[k] = g[k] || []).push(h); }); return Object.keys(g).map((k) => ({ label: k, n: g[k].length, avg: rd(avg(g[k].map((h) => h.total))), t: Math.min(...g[k].map((h) => h.ts || 0)) })).sort(cmp || ((a, b) => a.label.localeCompare(b.label))); };
  const ti = (l) => { const i = TENURES.indexOf(l); return i < 0 ? 99 : i; };
  const wkData = by((h) => wkLbl(h.ts), (a, b) => a.t - b.t), tlData = by((h) => info(h).tl), tnData = by((h) => info(h).tenure, (a, b) => ti(a.label) - ti(b.label));
  const stData = by((h) => h.cstatus), ctData = by((h) => h.type), sgData = by((h) => h.strategy), imData = by((h) => h.cmp && h.cmp.status);
  const pw = params.map((p) => { const a = list.filter((h) => h.sc[p.label]).map((h) => (h.sc[p.label].s / h.sc[p.label].max) * 100); return { label: p.label, v: a.length ? Math.round(avg(a)) : null }; }).filter((x) => x.v != null).sort((a, b) => b.v - a.v);
  const ownCount = { Trainer: 0, TL: 0 }; let needF = 0;
  list.forEach((h) => { const w = weakOf(h); if (w.length) needF++; w.forEach((x) => { ownCount[x.owner]++; }); });
  const ownData = [{ label: "Trainer", n: ownCount.Trainer }, { label: "Team Leader", n: ownCount.TL }].filter((x) => x.n);
  const mAvg = avg(list.map(mandScore).filter((x) => x != null));
  const listTs = new Set(list.map((h) => h.ts));
  const lt = tasks.filter((t) => listTs.has(t.auditTs));
  const pending = lt.filter((t) => t.status !== "Submitted").length;

  return (
    <Gate S={S} title="Dashboard">
      <AdminNav active="/dashboard" S={S} sub="Dashboard" />
      <div className="main">
        <FilterBar F={F} title="Call Quality Audit Dashboard" sub="Executive summary" />
        <div className="kp">
          {[["TOTAL AUDITS", list.length, "#2f6bff"], ["AVG QUALITY SCORE", list.length ? Math.round(avgAll) + "%" : "-", "#10b981"], ["MANDATORY STATEMENTS MET", mAvg == null ? "-" : Math.round(mAvg) + "%", "#8b5cf6"], ["AUDITS NEEDING FOLLOW-UP", needF, "#f59e0b"], ["FOLLOW-UPS PENDING", pending, "#06b6d4"]].map(([a, b, col]) => <div key={a} className="kc" style={{ borderColor: col }}><span>{a}</span><b style={{ color: col }}>{b}</b></div>)}
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
          <div className="row">
            <h3 style={{ margin: 0, flex: 1 }}>Agent-wise report <span className="muted" style={{ fontWeight: 600, fontSize: 13 }}>(all scores in %)</span></h3>
            <button className="g" disabled={!rows.length} onClick={() => dl("agent-report.csv", [["Center", "TL Name", "Agent Name", "Status", "Audit Count", ...params.map((p) => p.label + " %"), "Total %"], ...rows.map((r) => [r.center, r.tl, r.a, r.active ? "Active" : "Inactive", r.n, ...r.cells.map((c) => (c == null ? "" : Math.round(c * 100))), r.tot])])}>Report Download (Excel)</button>
            <button className="g" disabled={!list.length} onClick={() => dl("audit-wise-report.csv", [["Date", "Center", "TL Name", "Agent Name", "Customer", "Contact ID", "File", "Call length (min)", "Call Type", "Outcome", "Total %", ...params.map((p) => p.label + " %"), "Why"], ...list.map((h) => { const i = info(h); return [h.date, i.center, i.tl, h.rep, h.customer, h.contactId, h.file, h.durationSec ? Math.round(h.durationSec / 6) / 10 : "", h.type, h.outcome, h.total, ...params.map((p) => (h.sc[p.label] ? Math.round((h.sc[p.label].s / h.sc[p.label].max) * 100) : "")), h.why]; })])}>Audit-wise Download</button>
            <button className="g" onClick={() => window.print()}>Print / PDF</button>
          </div>
          {!rows.length ? <div className="empty">No audits match these filters. Run an audit on the Audit page or press Reset filters.</div> : (
            <div className="sc"><table className="t"><thead><tr><th className="l">Center</th><th className="l">TL Name</th><th className="l">Agent Name</th><th>Status</th><th>Audit Count</th>{params.map((p) => <th key={p.label}>{p.label}<br />(weight {p.max})</th>)}<th>Total %</th></tr></thead>
              <tbody>
                {rows.map((r) => <tr key={r.a}><td className="l">{r.center}</td><td className="l">{r.tl}</td><td className="l"><b>{r.a}</b></td><td><span className={"tag " + (r.active ? "on1" : "off1")}>{r.active ? "Active" : "Inactive"}</span></td><td>{r.n}</td>{r.cells.map((c, i) => <td key={i} style={{ background: heat(c == null ? null : c * 100) }}>{c == null ? "-" : pct(c * 100)}</td>)}<td style={{ background: heat(r.tot), fontWeight: 700 }}>{r.tot}%</td></tr>)}
                <tr><td className="l" colSpan={3}><b>TEAM AVERAGE</b></td><td></td><td><b>{list.length}</b></td>{colAvg.map((c, i) => <td key={i} style={{ fontWeight: 700 }}>{c == null ? "-" : pct(c * 100)}</td>)}<td style={{ fontWeight: 700 }}>{Math.round(avgAll)}%</td></tr>
              </tbody></table></div>
          )}
        </div>
        {rows.length > 0 && (
          <div className="cols">
            {[["Center-wise", "center"], ["TL-wise", "tl"]].map(([t, k]) => (
              <div className="c" key={k}><h3>{t} summary</h3>
                <table className="t"><thead><tr><th className="l">{k === "center" ? "Center" : "TL Name"}</th><th>Agents</th><th>Audits</th><th>Avg %</th></tr></thead>
                  <tbody>{grp(k).map((g) => <tr key={g.g}><td className="l">{g.g}</td><td>{g.agents}</td><td>{g.n}</td><td style={{ background: heat(g.tot), fontWeight: 700 }}>{g.tot}%</td></tr>)}</tbody></table>
              </div>))}
            <div className="c"><h3>Parameter-wise team average</h3>
              {params.map((p, i) => { const v = colAvg[i] == null ? 0 : colAvg[i] * 100; return <div className="bar" key={p.label}><label>{p.label}</label><i><s style={{ width: `${v}%`, background: colr(v) }} /></i><b>{Math.round(v)}%</b></div>; })}
            </div>
          </div>
        )}
        <p className="muted noprint" style={{ marginTop: 14 }}>Want to see the individual calls and their mistakes? Open <a href="/calls" style={{ fontWeight: 700 }}>Audited calls</a>.</p>
      </div>
    </Gate>
  );
}
