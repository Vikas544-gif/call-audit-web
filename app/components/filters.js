"use client";
import { useEffect, useMemo, useState } from "react";
import { EMPTY, computeFilter } from "../../lib/filters";
import { Slicer } from "./ui";
import { TENURES, STRATS, CTYPES } from "./data";

// One filter state shared by Dashboard and Audited calls (kept for this browser tab).
export function useFilters(S) {
  const [f, setF] = useState(EMPTY), [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try { const s = JSON.parse(sessionStorage.getItem("flt") || "null"); if (s) setF({ ...EMPTY, ...s }); } catch {}
    setLoaded(true);
  }, []);
  const V = useMemo(() => computeFilter(S.audits, S.amap, S.centers, f), [S.audits, S.amap, S.centers, f]);
  const put = (nf) => { setF(nf); if (loaded) { try { sessionStorage.setItem("flt", JSON.stringify(nf)); } catch {} } };
  // any change also drops picks that are no longer possible (e.g. a TL of a center that was just un-selected)
  const apply = (patch) => {
    let nf = { ...f, ...patch };
    const r = computeFilter(S.audits, S.amap, S.centers, nf);
    nf = { ...nf, ft: r.ftE, fa: r.faE };
    put(nf);
  };
  return { f, V, apply, reset: () => put(EMPTY) };
}

export function FilterBar({ F, title, sub }) {
  const { f, V, apply } = F;
  const sel = (label, key, opts) => <label key={key}>{label}<select value={f[key]} onChange={(e) => apply({ [key]: e.target.value })}><option value="All">All</option>{opts.map((x) => <option key={x}>{x}</option>)}</select></label>;
  return (
    <div className="band">
      <div className="bt"><h2>{title}</h2><span>{!f.fc.length ? "ALL CENTRES" : f.fc.join(", ").toUpperCase()}  |  {sub}</span></div>
      <div className="slg noprint">
        <Slicer title="Center" opts={V.centerOpts} sel={f.fc} onChange={(v) => apply({ fc: v })} />
        <Slicer title="Team Leader" opts={V.tlOpts} sel={V.ftE} onChange={(v) => apply({ ft: v })} />
        <Slicer title="Agent" opts={V.agOpts} sel={V.faE} onChange={(v) => apply({ fa: v })} />
      </div>
      <div className="flt noprint">
        <label style={{ maxWidth: 260 }}>Find customer<input placeholder="Customer name or contact ID" value={f.q} onChange={(e) => apply({ q: e.target.value })} /></label>
        {sel("Weekly", "fw", V.weeks)}{sel("Onboarding Officer", "fo", V.oos)}{sel("Tenure", "fn", TENURES)}{sel("Strategy", "fg", STRATS)}{sel("Types of Calls", "fct", CTYPES)}
        <label>Agent status<select value={f.fs} onChange={(e) => apply({ fs: e.target.value })}><option>Active</option><option>Inactive</option><option value="All">Active + Inactive</option></select></label>
        <label>From<input type="date" value={f.from} onChange={(e) => apply({ from: e.target.value })} /></label>
        <label>To<input type="date" value={f.to} onChange={(e) => apply({ to: e.target.value })} /></label>
      </div>
      <div className="row noprint" style={{ marginTop: 12, marginBottom: 0 }}>
        <span className="cnt">Showing <b>{V.list.length}</b> of {V.total} audits</span>
        <button className="g" onClick={F.reset}>Reset filters</button>
      </div>
    </div>
  );
}
