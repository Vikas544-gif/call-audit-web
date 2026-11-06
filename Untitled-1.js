import { del } from "@vercel/blob";

export const maxDuration = 300;

const AAI = "https://api.assemblyai.com/v2";
const H = { authorization: process.env.ASSEMBLYAI_API_KEY, "content-type": "application/json" };

const PROMPT = `You are a strict sales call auditor for Indian stock market / trading / advisory / PMS / demat sales teams.
Audit the call transcript (Hindi, English or Hinglish). Write all text fields in simple Hinglish (Roman script).
Check especially for compliance problems: guaranteed or assured returns, fixed profit claims, insider/operator tips, hiding risk, pressure selling, unregistered advice, asking for OTP/passwords, misleading past performance.
Also explain clearly WHY the sale did or did not happen: the exact mistakes the rep made.
Return ONLY valid JSON, no markdown, exact shape:
{"overall":0-100,"outcome":"Likely Sale"|"Warm Lead"|"Lost","summary":"2-3 lines","why":"main reason sale aayi ya nahi aayi",
"scores":{"opening":0-10,"discovery":0-10,"product":0-10,"objection":0-10,"compliance":0-10,"closing":0-10},
"mistakes":[{"mistake":"","quote":"short exact quote","fix":"what to say instead"}],
"flags":[{"issue":"","severity":"High"|"Medium"|"Low","quote":"","fix":""}],
"strengths":["..."],
"objections":[{"objection":"","handled":true,"better":"better reply"}],
"missed":["missed selling opportunities"],
"tips":["5 concrete steps to increase sales"]}
Be honest and specific, cite actual lines, never invent things not in the transcript.`;

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

export async function POST(req) {
  const { url, callType } = await req.json();
  try {
    const transcript = await transcribe(url);
    if (!transcript || transcript.length < 40) throw new Error("Audio me awaaz nahi mili ya bahut chhota hai");
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const gr = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${PROMPT}\n\nCall type: ${callType}\n\nTRANSCRIPT:\n${transcript.slice(0, 60000)}` }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8000 },
      }),
    });
    const gj = await gr.json();
    if (!gr.ok) throw new Error(gj.error?.message || "Gemini error");
    const text = (gj.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").replace(/```json|```/g, "");
    const result = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
    return Response.json({ result, transcript });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  } finally {
    try { await del(url); } catch {}
  }
}