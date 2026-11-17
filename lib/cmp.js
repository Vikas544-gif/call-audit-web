const rd = (n) => Math.round(n * 10) / 10;
export function cmpOf(r, prev) {
  if (!prev) return { status: "First audit" };
  const d = r.total - prev.total;
  const ch = Object.keys(r.sc || {}).filter((k) => prev.sc && prev.sc[k]).map((k) => ({ k, d: rd((r.sc[k].s / r.sc[k].max - prev.sc[k].s / prev.sc[k].max) * 100) }));
  return {
    status: d >= 2 ? "Improved" : d <= -2 ? "Declined" : "No change", delta: d, prev: prev.total, prevDate: (prev.date || "").split(",")[0],
    up: ch.filter((x) => x.d > 0).sort((a, b) => b.d - a.d).slice(0, 3), down: ch.filter((x) => x.d < 0).sort((a, b) => a.d - b.d).slice(0, 3),
  };
}
