import { del } from "@vercel/blob";
import { authed } from "../../../lib/db";

export const maxDuration = 300;

const AAI = "https://api.assemblyai.com/v2";
const H = { authorization: process.env.ASSEMBLYAI_API_KEY, "content-type": "application/json" };

const BASE = `You are a strict sales call auditor for Indian stock market / trading / advisory / PMS / demat sales teams.
Audit the call transcript (Hindi, English or Hinglish). Write all text fields in simple Hinglish (Roman script).
Check especially for compliance problems: guaranteed or assured returns, fixed profit claims, insider/operator tips, hiding risk, pressure selling, unregistered advice, asking for OTP/passwords, misleading past performance.
Also explain clearly WHY the sale did or did not happen: the exact mistakes the rep made.
Return ONLY valid JSON, no markdown, exact shape:
{"overall":0-100,"outcome":"Likely Sale"|"Warm Lead"|"Lost","summary":"2-3 lines","why":"main reason sale aayi ya nahi aayi",
"scores":__SCORES__,
"mistakes":[{"mistake":"","quote":"short exact quote","fix":"what to say instead"}],
"flags":[{"issue":"","severity":"High"|"Medium"|"Low","quote":"","fix":""}],
"strengths":["..."],
"objections":[{"objection":"","handled":true,"better":"better reply"}],
"missed":["missed selling opportunities"],
"tips":["5 concrete steps to increase sales"]}
Be honest and specific, cite actual lines, never invent things not in the transcript.
Score EACH parameter below strictly between 0 and its max points. Give 0 if the rep did not do it at all. Use whole or half points only. Mention weak parameters in "mistakes".
PARAMETERS:
__LIST__`;

function buildPrompt(params) {
  const shape = "{" + params.map((p) => `"${p.label}":0-${p.max}`).join(",") + "}";
  const list = params.map((p) => `- ${p.label} (max ${p.max})`).join("\n");
  return BASE.replace("__SCORES__", shape).replace("__LIST__", list);
}

async function transcribe(audio_url) {
  const r = await fetch(`${AAI}/transcript`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ audio_url, language_detection: true, speaker_labels: true }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "AssemblyAI error");
  for (let i = 0; i < 120; i++) {
    await new Promise((s) => setTimeout(s, 3000));
    const p = await (await fetch(`${AAI}/transcript/${j.id}`, { headers: H })).json();
    if (p.status === "completed") {
      if (p.utterances?.length) return p.utterances.map((u) => `Speaker ${u.speaker}: ${u.text}`).join("\n");
      return p.text || "";
    }
    if (p.status === "error") throw new Error(p.error);
  }
  throw new Error("Transcription me bahut time lag gaya");
}

async function askGemini(prompt) {
  const models = [process.env.GEMINI_MODEL || "gemini-3.8-flash", "gemini-3.6-flash"];
  let lastErr = "Gemini error";
  for (let attempt = 0; attempt < 4; attempt++) {
    const model = models[attempt % models.length];
    const gr = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8000 },
      }),
    });
    const gj = await gr.json();
    if (gr.ok) return gj;
    lastErr = gj.error?.message || "Gemini error";
    if (![429, 500, 503].includes(gr.status)) throw new Error(lastErr);
    await new Promise((s) => setTimeout(s, 4000 * (attempt + 1)));
  }
  throw new Error(lastErr);
}

export async function POST(req) {
  if (!authed(req)) return Response.json({ error: "locked" }, { status: 401 });
  const { url, callType, params } = await req.json();
  const plist = Array.isArray(params) && params.length ? params : [{ label: "OVERALL", max: 10 }];
  try {
    const transcript = await transcribe(url);
    if (!transcript || transcript.length < 40) throw new Error("Audio me awaaz nahi mili ya bahut chhota hai");
    const gj = await askGemini(`${buildPrompt(plist)}\n\nCall type: ${callType}\n\nTRANSCRIPT:\n${transcript.slice(0, 60000)}`);
    const text = (gj.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").replace(/```json|```/g, "");
    const result = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
    return Response.json({ result, transcript });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  } finally {
    try { await del(url); } catch {}
  }
}
