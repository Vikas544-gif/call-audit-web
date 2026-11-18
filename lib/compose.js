import { resolveAuto, norm } from "./filters";
import { openingDelay, firstAgentLine, fmtT } from "./transcript";
import { STRATS, STATUSES } from "./defaults";

const rd = (n) => Math.round(n * 10) / 10;
const normM = (m) => (Array.isArray(m) ? m : []).filter((x) => x && x.statement).map((x) => ({ statement: String(x.statement), result: ["yes", "partial", "no"].includes(String(x.result).toLowerCase()) ? String(x.result).toLowerCase() : "no", evidence: x.evidence || "", verified: x.verified !== false }));

// Turns the AI answer into the audit record that is saved.
// Order: AI points -> calibration -> opening delay penalty -> total %.
export function composeAudit({ res, ag, file, meta, params, mcfg, transcript, ts, date }) {
  const calib = Number(mcfg.calib) || 0;
  const sc = {};
  params.forEach((p) => {
    const raw = Number(res.scores && res.scores[p.label]) || 0;
    sc[p.label] = { s: Math.max(0, Math.min(p.max, rd(raw + (p.max * calib) / 100))), max: p.max };
  });
  const mistakes = (Array.isArray(res.mistakes) ? res.mistakes : []).map((m) => ({ ...m }));

  let delay = null, penalty = 0;
  if (mcfg.delayOn !== false) {
    delay = openingDelay(transcript);
    const dp = params.find((p) => norm(p.label) === norm(mcfg.delayParam || "INTRODUCTION"));
    const grace = Number(mcfg.delaySec == null ? 10 : mcfg.delaySec);
    if (delay != null && dp && delay > grace) {
      const before = sc[dp.label].s, after = Math.max(0, rd(before - (dp.max * Number(mcfg.delayPct == null ? 40 : mcfg.delayPct)) / 100));
      penalty = rd(before - after); sc[dp.label].s = after;
      const fa = firstAgentLine(transcript);
      mistakes.unshift({ parameter: dp.label, mistake: `Opening was delayed: the agent started speaking ${delay} seconds after the customer picked up`, at: fa ? fmtT(fa.t) : "", quote: fa ? fa.text : "", fix: `Greet and introduce yourself within ${grace} seconds of the customer picking up`, verified: true, auto: true });
    }
  }
  let s = 0, m = 0;
  Object.values(sc).forEach((v) => { s += v.s; m += v.max; });
  const { scores, overall, strategy, callStatus, agentSpeaker, ...rest } = res;
  return {
    ...rest, mistakes, aiMistakes: Array.isArray(res.aiMistakes) ? res.aiMistakes : [], mandatory: normM(res.mandatory), sc, total: m ? Math.round((s / m) * 100) : 0,
    openingDelay: delay, delayPenalty: penalty, durationSec: meta.durationSec || null,
    rep: ag.name, center: ag.center, tl: ag.tl, oo: ag.oo || "", tenure: ag.tenure || "", file,
    customer: (meta.customer || "").trim(), contactId: (meta.contactId || "").trim(), type: meta.callType,
    strategy: resolveAuto(meta.strategy, STRATS, strategy, "No Strategy"), cstatus: resolveAuto(meta.cstatus, STATUSES, callStatus, "Follow-up"),
    ts, date,
  };
}
