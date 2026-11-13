import { del } from "@vercel/blob";

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

const wait = (ms) => new Promise((s) => setTimeout(s, ms));

async function askGemini(prompt) {
  const models = [process.env.GEMINI_MODEL || "gemini-3.8-flash", "gemini-3.6-flash"];
  let lastErr = "Gemini error";
  for (let attempt = 0; attempt < 6; attempt++) {
    const model = models[attempt % models.length];
    const gr = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8000 },
      }),
    });
    const gj = await gr.json().catch(() => ({}));
    if (gr.ok) {
      const t = (gj.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
      if (t) return t;
      lastErr = "Gemini ne khaali jawab diya";
      continue;
    }
    lastErr = `${model}: ${gj.error?.message || "Gemini error " + gr.status}`;
    const retry = [429, 500, 503].includes(gr.status);
    const modelIssue = [400, 404].includes(gr.status) && /model/i.test(lastErr);
    if (!retry && !modelIssue) throw new Error(lastErr);
    if (retry) await wait(3000 * (attempt + 1));
  }
  throw new Error(lastErr);
}

async function askClaude(prompt) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5", max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || "Claude error " + r.status);
  return (j.content || []).map((c) => c.text || "").join("");
}

function parseJson(t) {
  const m = String(t).replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
  if (!m) throw new Error("AI ka jawab JSON nahi tha");
  return JSON.parse(m[0]);
}

async function getAudit(prompt) {
  let gErr = "";
  if (process.env.GEMINI_API_KEY) {
    for (let i = 0; i < 2; i++) {
      try { return parseJson(await askGemini(prompt)); } catch (e) { gErr = e.message; }
    }
  } else gErr = "GEMINI_API_KEY set nahi hai";
  if (process.env.ANTHROPIC_API_KEY) {
    try { return parseJson(await askClaude(prompt)); } catch (e) { throw new Error(`Audit fail. Gemini: ${gErr} | Claude: ${e.message}`); }
  }
  throw new Error(`Audit (Gemini) fail: ${gErr}`);
}

export async function POST(req) {
  const { url, callType, params } = await req.json();
  const plist = Array.isArray(params) && params.length ? params : [{ label: "OVERALL", max: 10 }];
  let stage = "Transcription";
  try {
    const transcript = await transcribe(url);
    if (!transcript || transcript.length < 40) throw new Error("Audio me awaaz nahi mili ya bahut chhota hai");
    stage = "Audit";
    const result = await getAudit(`${buildPrompt(plist)}\n\nCall type: ${callType}\n\nTRANSCRIPT:\n${transcript.slice(0, 60000)}`);
    return Response.json({ result, transcript });
  } catch (e) {
    return Response.json({ error: `[${stage}] ${e.message}` }, { status: 500 });
  } finally {
    try { await del(url); } catch {}
  }
}