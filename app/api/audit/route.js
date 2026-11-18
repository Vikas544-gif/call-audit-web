import { roleOf } from "../../../lib/db";
import { relabel, verifyAll } from "../../../lib/transcript";

export const maxDuration = 120;

const GEM = process.env.GEMINI_BASE || "https://generativelanguage.googleapis.com/v1beta";

function buildPrompt(params, mand) {
  const shape = "{" + params.map((p) => `"${p.label}":0-${p.max}`).join(",") + "}";
  const list = params.map((p) => `- ${p.label} (max ${p.max})${p.q ? ": " + p.q : ""}`).join("\n");
  const ms = mand.length ? `\nMANDATORY STATEMENTS (result "yes", "partial" or "no"; "evidence" = the exact words from the script that prove it, or "" if none):\n${mand.map((m, i) => `${i + 1}. ${m}`).join("\n")}\nFor time-based statements (for example "within 3 minutes of call start") use the [mm:ss] times in the script.\n` : "";
  return `You are a senior quality auditor for Indian stock market / PMS / advisory / demat sales teams. You audit a sales call from its script.
The script has one line per speaker turn: "[mm:ss] Speaker A: words". It may be Hindi, English or Hinglish. The speaker names are only A, B, C: work out which speaker is the sales agent (the one who sells, introduces the company) and return it in "agentSpeaker" ("A", "B" ...). Use the [mm:ss] times for anything about timing, delays and dead air.
WRITE EVERY FIELD IN SIMPLE, CLEAR ENGLISH. The only exception is "quote": copy the exact words from the script in the original language, never translate it, never change it, keep it short (one sentence at most).

HOW TO SCORE each parameter (0 to its max points, whole or half points):
- 100% of max: done fully and well, with clear evidence in the script.
- about 70%: done, but incomplete or weak.
- about 40%: attempted but poor or partly wrong.
- 0: not done at all. Do not give marks for things that are not in the script.
Be strict and consistent. Use the description after the colon as what to look for.

EVIDENCE RULES: every item in "mistakes", "aiMistakes" and "flags" must have a "quote" that really exists in the script, and "at" = the [mm:ss] time of that line. Never invent a quote or a fact. If nothing is wrong, return an empty list. Put the most important items first. Keep every sentence short.

Return ONLY valid JSON (no markdown) in exactly this shape:
{"agentSpeaker":"A"|"B"|"unknown","outcome":"Likely Sale"|"Warm Lead"|"Lost","summary":"2 short lines","why":"the main reason the sale did or did not happen",
"strategy":"No Strategy"|"5 in 5"|"Combo"|"MPO","callStatus":"Follow-up"|"Interested"|"Not Interested"|"Not Connected",
"scores":${shape},
"mistakes":[{"parameter":"exact parameter name from the list","mistake":"","at":"mm:ss","quote":"","fix":"what to say instead"}],
"aiMistakes":[{"category":"short label","severity":"High"|"Medium"|"Low","mistake":"","at":"mm:ss","quote":"","why":"why it hurts the sale or the customer","fix":""}],
"mandatory":[{"statement":"exact statement text","result":"yes"|"partial"|"no","evidence":""}],
"flags":[{"issue":"compliance problem","severity":"High"|"Medium"|"Low","at":"mm:ss","quote":"","fix":""}],
"strengths":[""],"objections":[{"objection":"","handled":true,"better":""}],"missed":[""],"tips":[""]}
Limits: at most 8 mistakes, 8 aiMistakes, 5 flags, 4 strengths, 5 objections, 4 missed, 5 tips.
Every parameter that scores below 60% of its max must have at least one entry in "mistakes" with that parameter's name.
"aiMistakes" are mistakes you notice anywhere in the call that are NOT limited to the parameters: wrong or misleading information, guaranteed or assured returns, rudeness or poor tone, interrupting the customer, long silence or dead air, not answering a question, pressure selling, false urgency, not confirming details, a weak closing, unprofessional language, wrong product facts. "strategy" = the main strategy pitched ("No Strategy" if none). "callStatus" = how the call ended: "Interested" (agreed or clear interest), "Follow-up" (callback or follow-up fixed, or wants time), "Not Interested", "Not Connected" (no real conversation).
Check compliance carefully: guaranteed or assured returns, fixed profit claims, tips from operators, hiding risk, pressure selling, misleading past performance, asking for OTP or passwords.
PARAMETERS:
${list}
${ms}`;
}

// Gemini "thinking" is the slow part. Low thinking is enough for scoring against a checklist.
// Newer models take thinkingLevel, older ones thinkingBudget. We try them in turn and remember what works.
let thinkIdx = 0;
async function askGemini(prompt) {
  const mode = process.env.GEMINI_THINKING || "low"; // low | off | default
  const variants = mode === "default" ? [null] : mode === "off" ? [{ thinkingBudget: 0 }, null] : [{ thinkingLevel: "low" }, { thinkingBudget: 0 }, null];
  const models = [process.env.GEMINI_MODEL || "gemini-3.8-flash", "gemini-3.6-flash"];
  let lastErr = "Gemini error";
  for (let attempt = 0; attempt < 4; attempt++) {
    const model = models[attempt % models.length];
    for (let vi = Math.min(thinkIdx, variants.length - 1); vi < variants.length; vi++) {
      const gc = { responseMimeType: "application/json", maxOutputTokens: 7000, temperature: 0.2 };
      if (variants[vi]) gc.thinkingConfig = variants[vi];
      const gr = await fetch(`${GEM}/models/${model}:generateContent`, {
        method: "POST", headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: gc }),
      });
      const gj = await gr.json();
      if (gr.ok) { thinkIdx = vi; return gj; }
      lastErr = (gj.error && gj.error.message) || "Gemini error";
      if (gr.status === 400 && variants[vi]) continue; // this model does not accept that thinking setting: try the next one
      if (![429, 500, 503].includes(gr.status)) throw new Error(lastErr);
      break;
    }
    await new Promise((s) => setTimeout(s, 2000 * (attempt + 1)));
  }
  throw new Error(lastErr);
}

export async function POST(req) {
  if (!roleOf(req)) return Response.json({ error: "locked" }, { status: 401 });
  const { transcript, callType, params, mand } = await req.json();
  const plist = Array.isArray(params) && params.length ? params : [{ label: "OVERALL", max: 10 }];
  const mlist = Array.isArray(mand) ? mand.filter(Boolean).slice(0, 30) : [];
  try {
    if (!transcript || transcript.length < 40) throw new Error("The call script is empty");
    const gj = await askGemini(`${buildPrompt(plist, mlist)}\nCall type: ${callType}\n\nSCRIPT:\n${String(transcript).slice(0, 60000)}`);
    const cand = gj.candidates && gj.candidates[0];
    const text = ((cand && cand.content && cand.content.parts) || []).map((p) => p.text || "").join("").replace(/```json|```/g, "");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("The AI gave no answer, please try again");
    let result;
    try { result = JSON.parse(m[0]); } catch { throw new Error(cand && cand.finishReason === "MAX_TOKENS" ? "The AI answer was cut off (very long call). Please try again." : "The AI answer was not readable, please try again"); }
    const script = relabel(String(transcript), result.agentSpeaker);
    return Response.json({ result: verifyAll(result, script), transcript: script });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
