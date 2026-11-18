import { del } from "@vercel/blob";
import { configured, pipeline, roleOf } from "../../../lib/db";
import { buildTranscript } from "../../../lib/transcript";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const AAI = process.env.AAI_BASE || "https://api.assemblyai.com/v2";
const H = () => ({ authorization: process.env.ASSEMBLYAI_API_KEY, "content-type": "application/json" });

// The browser starts the transcription (POST) and then asks for the result every second or so (GET).
// No request waits for the whole transcription, so long calls never hit a server time limit.
export async function POST(req) {
  if (!roleOf(req)) return Response.json({ error: "locked" }, { status: 401 });
  try {
    const { url } = await req.json();
    if (!url) return Response.json({ error: "Missing audio url" }, { status: 400 });
    const body = { audio_url: url, speaker_labels: true };
    // set AAI_LANGUAGE (for example "hi" or "en") to skip language detection: faster, and often better for one language
    if (process.env.AAI_LANGUAGE) body.language_code = process.env.AAI_LANGUAGE; else body.language_detection = true;
    if (process.env.AAI_SPEECH_MODEL) body.speech_model = process.env.AAI_SPEECH_MODEL;
    const r = await fetch(`${AAI}/transcript`, { method: "POST", headers: H(), body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "AssemblyAI error");
    if (configured()) await pipeline([["HSET", "tx", j.id, url]]);
    return Response.json({ id: j.id });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

async function cleanup(id) {
  try {
    if (!configured()) return;
    const [u] = await pipeline([["HGET", "tx", id]]);
    if (u) { try { await del(u); } catch {} await pipeline([["HDEL", "tx", id]]); }
  } catch {}
}

export async function GET(req) {
  if (!roleOf(req)) return Response.json({ error: "locked" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
  try {
    const p = await (await fetch(`${AAI}/transcript/${encodeURIComponent(id)}`, { headers: H() })).json();
    if (p.status === "completed") {
      await cleanup(id); // the audio is deleted as soon as it is transcribed
      const transcript = buildTranscript(p.utterances, p.text);
      if (!transcript || transcript.length < 40) return Response.json({ status: "error", error: "No speech found in the audio, or the audio is too short" });
      return Response.json({ status: "completed", transcript, duration: p.audio_duration || null });
    }
    if (p.status === "error") { await cleanup(id); return Response.json({ status: "error", error: p.error || "Transcription failed" }); }
    return Response.json({ status: p.status || "queued" });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
