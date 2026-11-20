"use client";
import { useEffect } from "react";
import { useStore, dl, colr, heat, rd, avg, uniq, wkLbl, mandScore, pct, TENURES } from "../components/data";
import { Gate, AdminNav, Combo, MixBar } from "../components/ui";
import { FilterBar, useFilters } from "../components/filters";
import { infoOf } from "../../lib/filters";
import { weakParams, ownerOf } from "../../lib/defaults";

const shortWk = (l) => String(l).replace(/^Week\s*/i, "W").replace(/\s+/, " ");

export default function DashboardPage() {
  const S = useStore("full");
  const F = useFilters(S);
  const { params, amap, mcfg, tasks } = S;
  const list = F.V.list, weak = mcfg.weakPct;

  useEffect(() => {
    if (!S.configured || S.locked) return;
    const t = setInterval(() => S.refresh(), 45000);
    return () => clearInterval(t);
  }, [S.configured, S.locked]);

  const info = (h) => infoOf(amap, h);
  const weakOf = (h) => weakParams(h, params, weak);
  const rows = uniq(list.map((h) => h.rep)).map((a) => {
    const au = list.filter((h) => h.rep === a).sort((x, y) => y.ts - x.ts), i = info(au[0]);
    return { a, center: i.center, tl: i.tl, active: i.active, n: au.length, tot: Math.round(avg(au.map((h) => h.total))), delta: au[1] ? au[0].total - au[1].total : null, cells: params.map((p) => avg(au.filter((h) => h.sc[p.label]).map((h) => h.sc[p.label].s / h.sc[p.label].max))) };
  }).sort((x, y) => (x.center + x.tl + x.a).localeCompare(y.center + y.tl + y.a));
  const colAvg = params.map((_, i) => avg(rows.map((r) => r.cells[i]).filter((x) => x != null)));
  const avgAll = list.length ? rd(avg(list.map((h) => h.total))) : 0;
  const grp = (key) => uniq(rows.map((r) => r[key])).map((g) => { const rr = rows.filter((r) => r[key] === g); return { g, agents: rr.length, n: rr.reduce((x, r) => x + r.n, 0), tot: Math.round(avg(rr.map((r) => r.tot))) }; });
  const by = (key, cmp) => { const g = {}; list.forEach((h) => { const k = key(h) || "-"; (g[k] = g[k] || []).push(h); }); return Object.keys(g).map((k) => ({ label: k, n: g[k].length, avg: rd(avg(g[k].map((h) => h.total))), t: Math.min(...g[k].map((h) => h.ts || 0)) })).sort(cmp || ((a, b) => a.label.localeCompare(b.label))); };
  const ti = (l) => { const i = TENURES.indexOf(l); return i < 0 ? 99 : i; };
  const wkData = by((h) => wkLbl(h.ts), (a, b) => a.t - b.t), tlData = by((h) => info(h).tl), tnData = by((h) => info(h).tenure, (a, b) => ti(a.label) - ti(b.label));
  const stData = by((h) => h.cstatus), ctData = by((h) => h.type), sgData = by((h) => h.strategy), imData = by((h) => h.cmp && h.cmp.status);
  const pw = params.map((p) => { const a = list.filter((h) => h.sc[p.label]).map((h) => (h.sc[p.label].s / h.sc[p.label].max) * 100); return { label: p.label, v: a.length ? Math.round(avg(a)) : null }; }).filter((x) => x.v != null).sort((a, b) => a.v - b.v);
  const ownCount = { Trainer: 0, TL: 0 }; let needF = 0;
  list.forEach((h) => { const w = weakOf(h); if (w.length) needF++; w.forEach((x) => { ownCount[x.owner]++; }); });
  const mAvg = avg(list.map(mandScore).filter((x) => x != null));
  const listTs = new Set(list.map((h) => h.ts));
  const lt = tasks.filter((t) => listTs.has(t.auditTs));
  const pending = lt.filter((t) => t.status !== "Submitted").length;
  const pulse = wkData.slice(-8);
  const wkDelta = wkData.length >= 2 ? Math.round(wkData[wkData.length - 1].avg - wkData[wkData.length - 2].avg) : null;
  const board = uniq(rows.map((r) => r.center)).map((c) => ({ center: c, tls: uniq(rows.filter((r) => r.center === c).map((r) => r.tl)).map((t) => ({ tl: t, agents: rows.filter((r) => r.center === c && r.tl === t).sort((a, b) => a.tot - b.tot) })) }));
  const openAgent = (name) => { F.apply({ fa: [name] }); window.location.href = "/calls"; };

  return (
    <Gate S={S} title="Dashboard">
      <AdminNav active="/dashboard" S={S} sub="Dashboard" />
      <div className="main">
        <FilterBar F={F} title="Dashboard" sub="How calls are scoring across centers, team leaders and agents" />

        <section className="hero" aria-label="Summary">
          <div>
            <span className="hero-k">Average quality score</span>
            <div className="hero-n">{list.length ? Math.round(avgAll) : "-"}{list.length ? <small>%</small> : null}</div>
            {wkDelta != null && <span className={"hero-d " + (wkDelta >= 0 ? "up" : "dn")}>{wkDelta >= 0 ? "▲" : "▼"} {Math.abs(wkDelta)} points vs the previous week</span>}
            {pw.length > 0 && <p className="hero-s">Weakest parameter is {pw[0].label} at {pw[0].v}%. Strongest is {pw[pw.length - 1].label} at {pw[pw.length - 1].v}%.</p>}
          </div>
          <div className="hero-pulse" role="img" aria-label="Average score by week">
            {pulse.length ? pulse.map((p) => <div key={p.label} className="pb"><b>{Math.round(p.avg)}</b><i style={{ height: Math.max(6, Math.round(p.avg * 1.45)) }} /><span>{shortWk(p.label)}</span></div>) : <span style={{ opacity: 0.75, fontSize: 14 }}>No weekly data yet</span>}
          </div>
          <div className="hero-stats">
            <div><b>{list.length}</b><span>Audits</span></div>
            <div><b>{mAvg == null ? "-" : Math.round(mAvg) + "%"}</b><span>Mandatory statements met</span></div>
            <div><b>{needF}</b><span>Audits needing follow-up</span></div>
            <div><b>{pending}</b><span>Follow-ups pending</span></div>
          </div>
        </section>

        <div className="two">
          <div className="c">
            <div className="row" style={{ marginBottom: 4 }}><h3 style={{ margin: 0, flex: 1 }}>Where calls lose points</h3><span className="muted" style={{ fontSize: 13 }}>Weakest first. The line is the weak limit ({weak}%).</span></div>
            {!pw.length && <div className="empty">No data</div>}
            <div className="prm">{pw.map((p) => <div key={p.label} className="prm-r"><span className="prm-l">{p.label}<em>{ownerOf(params, p.label) === "Trainer" ? "Trainer" : "TL"}</em></span><div className="prm-b"><i className={p.v < weak ? "bad" : p.v >= 80 ? "good" : ""} style={{ width: p.v + "%" }} /><u style={{ left: weak + "%" }} /></div><b>{p.v}%</b></div>)}</div>
          </div>
          <div className="c">
            <h3>Who must act</h3>
            <div className="act"><div><b>{ownCount.TL}</b><span>weak parameters for the team leaders</span></div><div><b>{ownCount.Trainer}</b><span>weak parameters for the Trainer</span></div></div>
            <p className="muted" style={{ margin: "10px 0 0", fontSize: 14 }}>{pending} follow-up{pending === 1 ? "" : "s"} waiting, {lt.length - pending} done. <a href="/followups" style={{ fontWeight: 600 }}>Open follow-ups</a></p>
            <h3 style={{ marginTop: 22 }}>How calls ended</h3>
            <MixBar data={stData} />
          </div>
        </div>

        <section className="c board">
          <div className="row" style={{ marginBottom: 0 }}><h3 style={{ margin: 0, flex: 1 }}>Team board</h3><span className="muted" style={{ fontSize: 13 }}>One tile per agent, weakest first. Click a tile to see that agent's calls.</span></div>
          {!board.length && <div className="empty" style={{ marginTop: 12 }}>No audits match the filters.</div>}
          <div className="bcs">{board.map((c) => (
            <div key={c.center} className="bc"><h4>{c.center}</h4>
              {c.tls.map((t) => (
                <div key={t.tl} className="btl"><span className="btl-n">TL {t.tl || "-"}</span>
                  <div className="tiles">{t.agents.map((a) => (
                    <button key={a.a} className={"tile " + (a.tot < weak ? "bad" : a.tot >= 80 ? "good" : "")} onClick={() => openAgent(a.a)}>
                      <span className="tile-s">{a.tot}%</span><span className="tile-a">{a.a}</span>
                      <small>{a.n} audit{a.n === 1 ? "" : "s"}{a.delta != null ? (a.delta > 0 ? `, up ${a.delta}` : a.delta < 0 ? `, down ${Math.abs(a.delta)}` : ", no change") : ""}</small>
                    </button>))}
                  </div>
                </div>))}
            </div>))}</div>
        </section>

        <div className="gr4">
          <div className="ch"><h4>Call types</h4><MixBar data={ctData} /></div>
          <div className="ch"><h4>Strategy used</h4><MixBar data={sgData} /></div>
          <div className="ch"><h4>Change since the last call</h4><MixBar data={imData} /></div>
          <div className="ch"><h4>Follow-up status</h4><MixBar data={[{ label: "Done", n: lt.length - pending }, { label: "Pending", n: pending }].filter((x) => x.n)} /></div>
        </div>

        <div className="gr">
          <div className="ch"><h4>Weekly audits and average score</h4><Combo data={wkData} /></div>
          <div className="ch"><h4>Team leader: audits and average score</h4><Combo data={tlData} /></div>
          <div className="ch"><h4>Tenure: audits and average score</h4><Combo data={tnData} /></div>
        </div>

        <div className="c">
          <div className="row">
            <h3 style={{ margin: 0, flex: 1 }}>Agent-wise report <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>(all scores in %)</span></h3>
            <button className="g" disabled={!rows.length} onClick={() => dl("agent-report.csv", [["Center", "TL Name", "Agent Name", "Status", "Audit Count", ...params.map((p) => p.label + " %"), "Total %"], ...rows.map((r) => [r.center, r.tl, r.a, r.active ? "Active" : "Inactive", r.n, ...r.cells.map((c) => (c == null ? "" : Math.round(c * 100))), r.tot])])}>Report Download (Excel)</button>
            <button className="g" disabled={!list.length} onClick={() => dl("audit-wise-report.csv", [["Date", "Center", "TL Name", "Agent Name", "Customer", "Contact ID", "File", "Call length (min)", "Call Type", "Outcome", "Total %", ...params.map((p) => p.label + " %"), "Why"], ...list.map((h) => { const i = info(h); return [h.date, i.center, i.tl, h.rep, h.customer, h.contactId, h.file, h.durationSec ? Math.round(h.durationSec / 6) / 10 : "", h.type, h.outcome, h.total, ...params.map((p) => (h.sc[p.label] ? Math.round((h.sc[p.label].s / h.sc[p.label].max) * 100) : "")), h.why]; })])}>Audit-wise Download</button>
            <button className="g" onClick={() => window.print()}>Print / PDF</button>
          </div>
          {!rows.length ? <div className="empty">No audits match these filters. Run an audit on the Audit page or clear the filters.</div> : (
            <div className="sc"><table className="t dense"><thead><tr><th className="l">Center</th><th className="l">TL Name</th><th className="l">Agent Name</th><th>Status</th><th>Audit Count</th>{params.map((p) => <th key={p.label}>{p.label}<small>weight {p.max}</small></th>)}<th>Total %</th></tr></thead>
              <tbody>
                {rows.map((r) => <tr key={r.a}><td className="l">{r.center}</td><td className="l">{r.tl}</td><td className="l"><b>{r.a}</b></td><td><span className={"tag " + (r.active ? "on1" : "off1")}>{r.active ? "Active" : "Inactive"}</span></td><td>{r.n}</td>{r.cells.map((c, i) => <td key={i} style={{ background: heat(c == null ? null : c * 100, weak) }}>{c == null ? "-" : pct(c * 100)}</td>)}<td style={{ background: heat(r.tot, weak), fontWeight: 600 }}>{r.tot}%</td></tr>)}
                <tr><td className="l" colSpan={3}><b>TEAM AVERAGE</b></td><td></td><td><b>{list.length}</b></td>{colAvg.map((c, i) => <td key={i} style={{ fontWeight: 700 }}>{c == null ? "-" : pct(c * 100)}</td>)}<td style={{ fontWeight: 700 }}>{Math.round(avgAll)}%</td></tr>
              </tbody></table></div>
          )}
        </div>
        {rows.length > 0 && (
          <div className="cols">
            {[["Center-wise", "center"], ["TL-wise", "tl"]].map(([t, k]) => (
              <div className="c" key={k}><h3>{t} summary</h3>
                <table className="t"><thead><tr><th className="l">{k === "center" ? "Center" : "TL Name"}</th><th>Agents</th><th>Audits</th><th>Avg %</th></tr></thead>
                  <tbody>{grp(k).map((g) => <tr key={g.g}><td className="l">{g.g}</td><td>{g.agents}</td><td>{g.n}</td><td style={{ background: heat(g.tot, weak), fontWeight: 600 }}>{g.tot}%</td></tr>)}</tbody></table>
              </div>))}
          </div>
        )}
        <p className="muted noprint" style={{ marginTop: 16 }}>To see the individual calls, their mistakes and the recordings, open <a href="/calls" style={{ fontWeight: 600 }}>Audited calls</a>.</p>
      </div>
    </Gate>
  );
}
