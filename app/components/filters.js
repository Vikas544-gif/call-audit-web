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
  const [open, setOpen] = useState(true);
  useEffect(() => { if (window.innerWidth < 900) setOpen(false); }, []);
  const sel = (label, key, opts) => <label key={key}>{label}<select value={f[key]} onChange={(e) => apply({ [key]: e.target.value })}><option value="All">All</option>{opts.map((x) => <option key={x}>{x}</option>)}</select></label>;
  const chips = [
    ...f.fc.map((x) => ({ k: "c" + x, t: "Center " + x, rm: () => apply({ fc: f.fc.filter((y) => y !== x) }) })),
    ...V.ftE.map((x) => ({ k: "t" + x, t: "TL " + x, rm: () => apply({ ft: f.ft.filter((y) => y !== x) }) })),
    ...V.faE.map((x) => ({ k: "a" + x, t: "Agent " + x, rm: () => apply({ fa: f.fa.filter((y) => y !== x) }) })),
    ...(f.q ? [{ k: "q", t: `Search "${f.q}"`, rm: () => apply({ q: "" }) }] : []),
    ...[["fw", "Week"], ["fo", "Onboarding"], ["fn", "Tenure"], ["fg", "Strategy"], ["fct", "Call type"]].filter(([k]) => f[k] !== "All").map(([k, n]) => ({ k, t: `${n} ${f[k]}`, rm: () => apply({ [k]: "All" }) })),
    ...(f.fs !== "Active" ? [{ k: "fs", t: f.fs === "All" ? "Active and inactive agents" : "Inactive agents", rm: () => apply({ fs: "Active" }) }] : []),
    ...(f.from ? [{ k: "from", t: "From " + f.from, rm: () => apply({ from: "" }) }] : []),
    ...(f.to ? [{ k: "to", t: "To " + f.to, rm: () => apply({ to: "" }) }] : []),
  ];
  return (
    <div className="band">
      <div className="pgh"><h2>{title}</h2><p>{sub}</p></div>
      <button className="g ftoggle noprint" onClick={() => setOpen(!open)}>{open ? "Hide filters" : "Show filters"}</button>
      <div className={"fpanel" + (open ? "" : " closed")}>
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
        <div className="fnow">
          <span className="cnt">Showing <b>{V.list.length}</b> of {V.total} audits</span>
          {chips.map((c) => <span key={c.k} className="chip noprint">{c.t}<button aria-label={"Remove filter " + c.t} onClick={c.rm}>×</button></span>)}
          {chips.length > 0 && <button className="g noprint" style={{ padding: "3px 12px", fontSize: 13 }} onClick={F.reset}>Reset filters</button>}
        </div>
      </div>
    </div>
  );
}
