import { del } from "@vercel/blob";
import { roleOf } from "../../../lib/db";

export const maxDuration = 300;

const AAI = "https://api.assemblyai.com/v2";
const H = { authorization: process.env.ASSEMBLYAI_API_KEY, "content-type": "application/json" };

function buildPrompt(params, mand) {
  const shape = "{" + params.map((p) => `"${p.label}":0-${p.max}`).join(",") + "}";
  const list = params.map((p) => `- ${p.label} (max ${p.max})${p.q ? ": " + p.q : ""}`).join("\n");
  const ms = mand.length ? `\nMANDATORY STATEMENTS (check each one; result is "yes", "partial" or "no", with a short evidence quote from the call or an empty string):\n${mand.map((m, i) => `${i + 1}. ${m}`).join("\n")}\n` : "";
  return `You are a strict sales call auditor for Indian stock market / trading / advisory / PMS / demat sales teams.
The call transcript may be in Hindi, English or Hinglish. WRITE EVERY TEXT FIELD IN SIMPLE, CLEAR ENGLISH ONLY (translate quotes if needed, keep the quote short).
Check especially for compliance problems: guaranteed or assured returns, fixed profit claims, insider/operator tips, hiding risk, pressure selling, unregistered advice, asking for OTP/passwords, misleading past performance.
Explain clearly WHY the sale did or did not happen: the exact mistakes the rep made.
Return ONLY valid JSON, no markdown, exact shape:
{"overall":0-100,"outcome":"Likely Sale"|"Warm Lead"|"Lost","summary":"2-3 lines","why":"main reason the sale happened or not",
"scores":${shape},
"mistakes":[{"parameter":"exact parameter name from the list","mistake":"","quote":"short exact line from the call","fix":"what to say instead"}],
"mandatory":[{"statement":"exact statement text","result":"yes"|"partial"|"no","evidence":""}],
"flags":[{"issue":"","severity":"High"|"Medium"|"Low","quote":"","fix":""}],
"strengths":["..."],
"objections":[{"objection":"","handled":true,"better":"better reply"}],
"missed":["missed selling opportunities"],
"tips":["5 concrete steps to increase sales"]}
Be honest and specific, cite actual lines, never invent things that are not in the transcript.
Score EACH parameter strictly between 0 and its max points, using the description after the colon as what to look for. Give 0 if the rep did not do it at all. Use whole or half points only. Every weak parameter must have at least one entry in "mistakes" with its "parameter" name.
PARAMETERS:
${list}
${ms}`;
}

async function transcribe(audio_url) {
  const body = { audio_url, language_detection: true, speaker_labels: true };
  if (process.env.AAI_SPEECH_MODEL) body.speech_model = process.env.AAI_SPEECH_MODEL;
  const r = await fetch(`${AAI}/transcript`, { method: "POST", headers: H, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "AssemblyAI error");
  for (let i = 0; i < 240; i++) {
    await new Promise((s) => setTimeout(s, i < 6 ? 1000 : 1500));
    const p = await (await fetch(`${AAI}/transcript/${j.id}`, { headers: H })).json();
    if (p.status === "completed") {
      if (p.utterances?.length) return p.utterances.map((u) => `Speaker ${u.speaker}: ${u.text}`).join("\n");
      return p.text || "";
    }
    if (p.status === "error") throw new Error(p.error);
  }
  throw new Error("Transcription is taking too long");
}

async function askGemini(prompt) {
  const models = [process.env.GEMINI_MODEL || "gemini-3.8-flash", "gemini-3.6-flash"];
  let lastErr = "Gemini error";
  for (let attempt = 0; attempt < 4; attempt++) {
    const model = models[attempt % models.length];
    const gr = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8000 } }),
    });
    const gj = await gr.json();
    if (gr.ok) return gj;
    lastErr = gj.error?.message || "Gemini error";
    if (![429, 500, 503].includes(gr.status)) throw new Error(lastErr);
    await new Promise((s) => setTimeout(s, 2500 * (attempt + 1)));
  }
  throw new Error(lastErr);
}

export async function POST(req) {
  if (!roleOf(req)) return Response.json({ error: "locked" }, { status: 401 });
  const { url, callType, params, mand } = await req.json();
  const plist = Array.isArray(params) && params.length ? params : [{ label: "OVERALL", max: 10 }];
  const mlist = Array.isArray(mand) ? mand.filter(Boolean).slice(0, 30) : [];
  try {
    const transcript = await transcribe(url);
    if (!transcript || transcript.length < 40) throw new Error("No speech found in the audio, or the audio is too short");
    const gj = await askGemini(`${buildPrompt(plist, mlist)}\n\nCall type: ${callType}\n\nTRANSCRIPT:\n${transcript.slice(0, 60000)}`);
    const text = (gj.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").replace(/```json|```/g, "");
    const result = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
    return Response.json({ result });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  } finally {
    try { await del(url); } catch {}
  }
}
