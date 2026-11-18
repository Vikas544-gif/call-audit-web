// Call script (transcript) helpers. A script line looks like:  [00:12] Agent: Hello sir ...
export const fmtT = (sec) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

// AssemblyAI utterances -> script text (speakers are still "Speaker A", "Speaker B")
export function buildTranscript(utterances, fallbackText) {
  if (!utterances || !utterances.length) return String(fallbackText || "");
  return utterances.map((u) => `[${fmtT((u.start || 0) / 1000)}] Speaker ${u.speaker}: ${String(u.text || "").trim()}`).join("\n");
}

export function parseTranscript(text) {
  return String(text || "").split("\n").map((l) => {
    const m = l.match(/^\[(\d+):(\d{2})\]\s+([^:]{1,30}):\s*(.*)$/);
    return m ? { t: Number(m[1]) * 60 + Number(m[2]), who: m[3].trim(), text: m[4] } : null;
  }).filter(Boolean);
}

// "Speaker A/B" -> Agent / Customer, once the AI told us which speaker is the sales agent
export function relabel(text, agentSpeaker) {
  const a = String(agentSpeaker || "").trim().toUpperCase().replace(/^SPEAKER\s+/, "");
  if (!/^[A-Z0-9]$/.test(a)) return text;
  return String(text).split("\n").map((l) => l.replace(/^(\[\d+:\d{2}\]\s+)Speaker ([A-Za-z0-9]+)(:)/, (m, p, s, c) => p + (s.toUpperCase() === a ? "Agent" : "Customer") + c)).join("\n");
}

// seconds between the customer picking up and the agent starting to speak (null = cannot be worked out)
export function openingDelay(text) {
  const L = parseTranscript(text);
  const a = L.find((x) => x.who === "Agent");
  if (!a) return null;
  const c = L.find((x) => x.who === "Customer");
  if (!c) return null;
  return Math.max(0, a.t - (c.t < a.t ? c.t : 0));
}
export const firstAgentLine = (text) => parseTranscript(text).find((x) => x.who === "Agent") || null;

// ---- quote check: is a quote the AI gave really in the script?
export const nz = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const bodyOf = (t) => String(t || "").split("\n").map((l) => l.replace(/^\[\d+:\d{2}\]\s+[^:]{1,30}:\s*/, "")).join(" ");

export function quoteFound(transcript, quote) {
  const q = nz(quote);
  if (q.length < 6) return true; // too short to check
  const hay = nz(bodyOf(transcript));
  if (hay.includes(q)) return true;
  const qw = q.split(" "), hw = hay.split(" "), n = Math.min(3, qw.length);
  const grams = (w) => { const g = []; for (let i = 0; i + n <= w.length; i++) g.push(w.slice(i, i + n).join(" ")); return g; };
  const set = new Set(grams(hw)), qg = grams(qw);
  return qg.length > 0 && qg.filter((x) => set.has(x)).length / qg.length >= 0.6;
}

// does this script line contain any of the quotes?
export function lineHasQuote(lineText, quotes) {
  const l = nz(lineText);
  if (l.length < 4) return false;
  return (quotes || []).some((q) => { const z = nz(q); return z.length >= 6 && (l.includes(z) || (l.length >= 20 && z.includes(l))); });
}

// add verified:true/false to every quote the AI returned
export function verifyAll(res, transcript) {
  const mark = (arr, key) => (Array.isArray(arr) ? arr : []).map((x) => ({ ...x, verified: quoteFound(transcript, x[key]) }));
  return {
    ...res,
    mistakes: mark(res.mistakes, "quote"), aiMistakes: mark(res.aiMistakes, "quote"), flags: mark(res.flags, "quote"),
    mandatory: (Array.isArray(res.mandatory) ? res.mandatory : []).map((m) => ({ ...m, verified: m.evidence ? quoteFound(transcript, m.evidence) : true })),
  };
}
