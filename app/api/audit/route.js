import { del } from "@vercel/blob";

export const maxDuration = 300;

const AAI = "https://api.assemblyai.com/v2";
const H = { authorization: process.env.ASSEMBLYAI_API_KEY, "content-type": "application/json" };

const BASE = `You are a strict sales call auditor for Indian stock market / trading / advisory / PMS / demat sales teams.
Audit the call transcript (Hindi, English or Hinglish). Write ALL text fields (summary, why, mistakes, fixes, strengths, missed, tips, evidence) in clear, simple English, even when the call is in Hindi or Hinglish. Short exact quotes from the call may stay in the original language.
Check especially for compliance problems: guaranteed or assured returns, fixed profit claims, insider/operator tips, hiding risk, pressure selling, unregistered advice, asking for OTP/passwords, misleading past performance.
Also explain clearly WHY the sale did or did not happen: the exact mistakes the rep made.
Return ONLY valid JSON, no markdown, exact shape:
{"overall":0-100,"outcome":"Likely Sale"|"Warm Lead"|"Lost","summary":"2-3 lines","why":"main reason the sale did or did not happen",
"scores":__SCORES__,
"mandatory":[{"statement":"","result":"yes"|"no"|"na","evidence":"short quote or reason from the call"}],
"mistakes":[{"mistake":"","quote":"short exact quote","fix":"what to say instead"}],
"flags":[{"issue":"","severity":"High"|"Medium"|"Low","quote":"","fix":""}],
"strengths":["..."],
"objections":[{"objection":"","handled":true,"better":"better reply"}],
"objection_tags":["exact option text, or Other: short text"],
"missed":["missed selling opportunities"],
"tips":["5 concrete steps to increase sales"]}
Be honest and specific, cite actual lines, never invent things not in the transcript.
Score EACH parameter below strictly between 0 and its max points. Give 0 if the rep did not do it at all. Use whole or half points only. Mention weak parameters in "mistakes".
PARAMETERS (use the question given after each name to decide the score):
__LIST__
OBJECTION OPTIONS (in "objection_tags" list every option the investor actually raised on this call, copying the option text exactly; if an objection fits none of them write "Other: <short text>"; if the investor raised no objection return an empty array):
__OBJ__
MANDATORY STATEMENTS TO PROMOTE SALES (for each one return yes if the rep clearly did it, no if not done, na if it does not apply to this call; keep the statement text exactly as given; if the list is empty return an empty array):
__MAND__`;

function buildPrompt(params, mandatory, objOptions) {
  const shape = "{" + params.map((p) => `"${p.label}":0-${p.max}`).join(",") + "}";
  const list = params.map((p) => `- ${p.label} (max ${p.max})${p.q ? ": " + p.q : ""}`).join("\n");
  const mand = (mandatory || []).length ? mandatory.map((m) => `- ${m}`).join("\n") : "(none)";
  const obj = (objOptions || []).length ? objOptions.map((o) => `- ${o}`).join("\n") : "(none)";
  return BASE.replace("__SCORES__", shape).replace("__LIST__", list).replace("__OBJ__", obj).replace("__MAND__", mand);
}

const wait = (ms) => new Promise((s) => setTimeout(s, ms));

async function askGemini(prompt, deadline) {
  const models = [process.env.GEMINI_MODEL || "gemini-3.8-flash", "gemini-3.6-flash"];
  let lastErr = "Gemini error";
  for (let attempt = 0; attempt < 5; attempt++) {
    if (Date.now() > deadline - 12000) { lastErr = lastErr + " (out of time, please try again)"; break; }
    const model = models[attempt % models.length];
    const gr = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal: AbortSignal.timeout(Math.max(8000, Math.min(60000, deadline - Date.now() - 8000))),
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
      lastErr = "Gemini returned an empty response";
      continue;
    }
    lastErr = `${model}: ${gj.error?.message || "Gemini error " + gr.status}`;
    const retry = [429, 500, 503].includes(gr.status);
    const modelIssue = [400, 404].includes(gr.status) && /model/i.test(lastErr);
    if (!retry && !modelIssue) throw new Error(lastErr);
    if (retry) await wait(Math.min(3000 * (attempt + 1), Math.max(0, deadline - Date.now() - 15000)));
  }
  throw new Error(lastErr);
}

async function askClaude(prompt, deadline) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(Math.max(8000, Math.min(90000, deadline - Date.now() - 5000))),
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5", max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || "Claude error " + r.status);
  return (j.content || []).map((c) => c.text || "").join("");
}

function parseJson(t) {
  const m = String(t).replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
  if (!m) throw new Error("AI response was not valid JSON");
  return JSON.parse(m[0]);
}

async function getAudit(prompt, deadline) {
  let gErr = "";
  if (process.env.GEMINI_API_KEY) {
    for (let i = 0; i < 2 && Date.now() < deadline - 20000; i++) {
      try { return parseJson(await askGemini(prompt, deadline)); } catch (e) { gErr = e.message; }
    }
  } else gErr = "GEMINI_API_KEY is not set";
  if (process.env.ANTHROPIC_API_KEY) {
    try { return parseJson(await askClaude(prompt, deadline)); } catch (e) { throw new Error(`Audit fail. Gemini: ${gErr} | Claude: ${e.message}`); }
  }
  throw new Error(`Audit (Gemini) fail: ${gErr}`);
}

async function aaiGet(id) {
  const r = await fetch(`${AAI}/transcript/${id}`, { headers: H });
  return r.json();
}

function fmt(p) {
  if (p.utterances?.length) return p.utterances.map((u) => `Speaker ${u.speaker}: ${u.text}`).join("\n");
  return p.text || "";
}

export async function POST(req) {
  const { action, url, id, callType, params, mandatory, objOptions } = await req.json();
  const plist = Array.isArray(params) && params.length ? params : [{ label: "OVERALL", max: 10 }];
  let stage = "Transcription";
  try {
    if (action === "start") {
      const r = await fetch(`${AAI}/transcript`, {
        method: "POST",
        headers: H,
        body: JSON.stringify({ audio_url: url, language_detection: true, speaker_labels: true }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "AssemblyAI error");
      return Response.json({ id: j.id });
    }

    if (action === "status") {
      const p = await aaiGet(id);
      if (p.status === "error") throw new Error(p.error || "Transcription error");
      return Response.json({ status: p.status });
    }

    if (action === "audit") {
      const p = await aaiGet(id);
      if (p.status !== "completed") throw new Error("Transcription is not complete yet");
      const transcript = fmt(p);
      if (!transcript || transcript.length < 40) throw new Error("No speech found in the audio, or the recording is too short");
      stage = "Audit";
      const deadline = Date.now() + (Number(process.env.MAX_SECONDS) || 150) * 1000;
      const result = await getAudit(`${buildPrompt(plist, Array.isArray(mandatory) ? mandatory : [], Array.isArray(objOptions) ? objOptions : [])}\n\nCall type: ${callType}\n\nTRANSCRIPT:\n${transcript.slice(0, 120000)}`, deadline);
      try { if (url) await del(url); } catch {}
      return Response.json({ result, transcript });
    }

    if (action === "cleanup") {
      try { if (url) await del(url); } catch {}
      return Response.json({ ok: true });
    }

    throw new Error("Unknown action");
  } catch (e) {
    return Response.json({ error: `[${stage}] ${e.message}` }, { status: 500 });
  }
}