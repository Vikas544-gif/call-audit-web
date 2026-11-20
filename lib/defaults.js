// Shared by server routes and the browser pages.
export const DEFAULT_PARAMS = [
  { label: "INTRODUCTION", max: 5, owner: "TL", q: "Greeting, introduces self and Equentis/company, states purpose of call" },
  { label: "INVESTOR PROFILING/PROBING", max: 15, owner: "TL", q: "Asks about current investments, capital available, experience, risk appetite, occupation, surplus" },
  { label: "RAPPORT BUILDING", max: 15, owner: "TL", q: "Two-way conversation, personalization, listens and responds to the investor, not a monologue" },
  { label: "STRATEGY PITCHING", max: 15, owner: "Trainer", q: "Explains MPO / 5-in-5 / combo strategies correctly with holding periods, returns logic, portfolio construction" },
  { label: "OBJECTIONS ON CALL", max: 15, owner: "TL", q: "Handles doubts, fee questions, losses, comparisons; probes blocked funds and offers alternatives" },
  { label: "MARKET UPDATES/ECONOMY", max: 5, owner: "Trainer", q: "Shares market/economy updates, sector trends, past performance talk" },
  { label: "WEBSITE NAVIGATION", max: 5, owner: "TL", q: "Guides the investor through the website/dashboard live on call" },
  { label: "URGENCY CREATION", max: 5, owner: "TL", q: "Creates genuine urgency (limited period pricing, festive offer, why start now)" },
  { label: "TEMPLATES", max: 5, owner: "TL", q: "Call remarks/templates precise: remarks, where call taken from, content of the call" },
  { label: "STAGE MOVEMENT", max: 15, owner: "TL", q: "Moves investor to next stage: risk profiling, registration, follow-up fixed with date/time, payment steps" },
];

export const DEFAULT_MAND = [
  "Call is recorded for quality and training purpose (within 3 minutes of call start)",
  "When talking about returns on 3 lakhs investment, also talk about returns of 4 lakhs and 5 lakhs in MPO and 5into5",
  "Use CAGR calculator when profiling the investor's investment and returns",
  "Talk about returns in numbers at least 3-4 times on a call",
  "Reconfirm the returns in numbers with the investor again before pitching the fees",
  "Combo pitch needs to be used before pitching the combo strategy",
  "Templates need to be precise: remarks, call taken from (bay phone / mobile), content of the call",
  "Open and use IBEF website",
].join("\n");

// Owner table version. When it is raised, every saved parameter list gets the new owners ONCE (the server does it).
export const OWNERS_V = 2;
export const DEFAULT_OWNERS = {
  "INTRODUCTION": "TL", "INVESTOR PROFILING/PROBING": "TL", "RAPPORT BUILDING": "TL", "STRATEGY PITCHING": "Trainer",
  "OBJECTIONS ON CALL": "TL", "OBJECTIONS": "TL", "MARKET UPDATES/ECONOMY": "Trainer", "WEBSITE NAVIGATION": "TL",
  "URGENCY CREATION": "TL", "TEMPLATES": "TL", "STAGE MOVEMENT": "TL",
};
export const applyOwners = (params) => (params || []).map((p) => { const o = DEFAULT_OWNERS[String(p.label || "").trim().toUpperCase()]; return o ? { ...p, owner: o } : p; });

export const TENURES = ["0-3 Month", "3-6 Month", "More than 6 Month"];
export const STRATS = ["No Strategy", "5 in 5", "Combo", "MPO"];
export const STATUSES = ["Follow-up", "Interested", "Not Interested", "Not Connected"];
export const CTYPES = ["New Lead", "Work to Non Work"];

export const CENTERS = ["Thane", "Malad", "Navi Mumbai", "Pune"];

// auto: send mails after each audit | weakPct: a parameter below this % is "weak"
// keepDays: how long a call recording is kept so the call can be played later (0 = delete right after the script is made)
// ackMode: off | draft (QA gets a ready draft) | auto (agent gets the mail by itself)
// calib: shift in % of each parameter's weightage (+ lenient, - stricter)
// delay rule: if the agent starts speaking more than delaySec seconds after the customer picked up,
// delayPct % of the delayParam (opening) weightage is taken off
export const MCFG = { auto: true, trainer: "", cc: "", weakPct: 60, ackMode: "draft", qa: "", calib: 0, mand: DEFAULT_MAND, ownersV: OWNERS_V, delayOn: true, delaySec: 10, delayPct: 40, delayParam: "INTRODUCTION", keepDays: 90 };

export const ownerOf = (params, label) => ((params || []).find((p) => p.label === label) || {}).owner === "Trainer" ? "Trainer" : "TL";

export function weakParams(a, params, weakPct) {
  const lim = Number(weakPct == null ? 60 : weakPct);
  return Object.entries((a && a.sc) || {})
    .filter(([, v]) => v && v.max && (v.s / v.max) * 100 < lim)
    .map(([label, v]) => ({ label, s: v.s, max: v.max, pct: Math.round((v.s / v.max) * 100), owner: ownerOf(params, label) }));
}

export const mandList = (text) => String(text || "").split("\n").map((x) => x.trim()).filter(Boolean);
