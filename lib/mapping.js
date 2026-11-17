// Reads agent mapping pasted from Excel / CSV.
// With a header row the columns are found by name (any order). Without one, `order` decides.
const FIELDS = ["center", "agent", "tl", "status", "oo", "tenure", "email", "tlEmail"];
export const ORDERS = {
  "agent-tl": ["center", "agent", "tl", "status", "oo", "tenure", "email", "tlEmail"],
  "tl-agent": ["center", "tl", "agent", "status", "oo", "tenure", "email", "tlEmail"],
};

function headerField(c) {
  const s = String(c || "").toLowerCase().replace(/[_\-.]/g, " ").trim();
  if (!s) return null;
  const isMail = /e ?mail|mail id/.test(s);
  if (isMail) return /\btl\b|team lead|leader|manager/.test(s) ? "tlEmail" : "email";
  if (/cent(er|re)|location|branch/.test(s)) return "center";
  if (/status|active/.test(s)) return "status";
  if (/onboard|\boo\b/.test(s)) return "oo";
  if (/tenure|vintage/.test(s)) return "tenure";
  if (/\btl\b|team lead|leader/.test(s)) return "tl";
  if (/agent|officer|employee|name|caller/.test(s)) return "agent";
  return null;
}

export function parseMapping(text, order = "agent-tl") {
  const lines = String(text || "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { rows: [], skipped: 0, header: false };
  const delim = lines.some((l) => l.includes("\t")) ? "\t" : lines.some((l) => l.includes(";")) ? ";" : ",";
  const split = (l) => l.split(delim).map((x) => x.replace(/^"|"$/g, "").trim());
  let cols = ORDERS[order] || ORDERS["agent-tl"], header = false, start = 0;
  const first = split(lines[0]);
  if (!first.some((c) => c.includes("@"))) {
    const mapped = first.map(headerField);
    if (mapped.includes("agent") || (mapped.filter(Boolean).length >= 2 && mapped.includes("center"))) { cols = mapped; header = true; start = 1; }
  }
  const rows = []; let skipped = 0;
  for (let k = start; k < lines.length; k++) {
    const cells = split(lines[k]), o = {};
    cols.forEach((f, i) => { if (f && !(f in o) && cells[i] != null) o[f] = cells[i]; });
    if (!o.agent) { skipped++; continue; }
    rows.push({
      name: o.agent, center: o.center || "", tl: o.tl || "", oo: o.oo || "", tenure: o.tenure || "", email: o.email || "", tlEmail: o.tlEmail || "",
      active: !/^(inactive|in-active|not active|no|n|0|false|left|resigned|exit)/i.test(o.status || ""),
    });
  }
  return { rows, skipped, header };
}
