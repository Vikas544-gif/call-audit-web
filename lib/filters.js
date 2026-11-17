// Pure filter logic, shared by the Dashboard, Audited calls and Follow-ups pages.
export const EMPTY = { fc: [], ft: [], fa: [], fs: "Active", fw: "All", fo: "All", fn: "All", fg: "All", fct: "All", from: "", to: "", q: "" };

export const norm = (s) => String(s == null ? "" : s).trim().toLowerCase();
const clean = (s) => String(s == null ? "" : s).trim();
const has = (arr, v) => arr.some((x) => norm(x) === norm(v));

export const wkLbl = (t) => { if (!t) return "-"; const d = new Date(t); return `Week ${Math.ceil(d.getDate() / 7)} ${d.toLocaleString("en", { month: "short" })}`; };

// list without duplicates (case and spaces ignored), sorted
export function uniqClean(arr) {
  const seen = new Map();
  arr.forEach((x) => { const c = clean(x); if (c && !seen.has(norm(c))) seen.set(norm(c), c); });
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

// Who an audit belongs to now (from the agent mapping). An agent with no "active" field counts as active.
export function infoOf(amap, h) {
  const a = amap.find((x) => norm(x.name) === norm(h.rep));
  if (!a) return { name: h.rep, center: clean(h.center) || "-", tl: clean(h.tl) || "-", oo: h.oo || "-", tenure: h.tenure || "-", active: true };
  return { ...a, center: clean(a.center) || clean(h.center) || "-", tl: clean(a.tl) || clean(h.tl) || "-", oo: clean(a.oo) || "-", tenure: clean(a.tenure) || "-", active: a.active !== false };
}

export function computeFilter(hist, amap, centers, f) {
  const centerOpts = uniqClean([...centers, ...amap.map((a) => a.center)]);
  const inC = (a) => !f.fc.length || has(f.fc, a.center);
  const tlOpts = uniqClean(amap.filter(inC).map((a) => a.tl));
  const ftE = f.ft.filter((x) => has(tlOpts, x));
  const inT = (a) => inC(a) && (!ftE.length || has(ftE, a.tl));
  const agOpts = uniqClean([...amap.filter(inT).map((a) => a.name), ...(!f.fc.length && !ftE.length ? hist.map((h) => h.rep) : [])]);
  const faE = f.fa.filter((x) => has(agOpts, x));
  // dates are the user's local days (not UTC)
  const t0 = f.from ? new Date(f.from + "T00:00:00").getTime() : null;
  const t1 = f.to ? new Date(f.to + "T23:59:59.999").getTime() : null;
  const qq = norm(f.q);
  const list = hist.filter((h) => {
    const i = infoOf(amap, h);
    return (!f.fc.length || has(f.fc, i.center)) && (!ftE.length || has(ftE, i.tl)) && (!faE.length || has(faE, h.rep)) &&
      (f.fs === "All" || (f.fs === "Active" ? i.active : !i.active)) &&
      (f.fw === "All" || wkLbl(h.ts) === f.fw) && (f.fo === "All" || norm(i.oo) === norm(f.fo)) && (f.fn === "All" || norm(i.tenure) === norm(f.fn)) &&
      (f.fg === "All" || norm(h.strategy || "-") === norm(f.fg)) && (f.fct === "All" || norm(h.type || "-") === norm(f.fct)) &&
      (t0 == null || h.ts >= t0) && (t1 == null || h.ts <= t1) &&
      (!qq || [h.customer, h.contactId, h.rep, h.file].some((x) => norm(x).includes(qq)));
  });
  return { list, centerOpts, tlOpts, agOpts, ftE, faE, weeks: uniqClean(hist.map((h) => wkLbl(h.ts))), oos: uniqClean(amap.map((a) => a.oo)), total: hist.length };
}
