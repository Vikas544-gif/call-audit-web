import { del } from "@vercel/blob";
import { configured, pipeline, roleOf, parse } from "../../../lib/db";
import { verifyAudio, parseEntry } from "../../../lib/audio";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Streams a saved recording (with Range support, so the player can jump around). Needs a signed link from /api/audio-url.
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const ts = q.get("ts");
  if (!verifyAudio(ts, q.get("exp"), q.get("sig"))) return new Response("This link has expired. Open the call again.", { status: 403 });
  if (!configured()) return new Response("Database not connected", { status: 501 });
  const [raw] = await pipeline([["HGET", "audio", String(ts)]]);
  const e = parseEntry(raw);
  if (!e) return new Response("No recording", { status: 404 });
  const range = req.headers.get("range");
  const up = await fetch(e.url, { headers: range ? { range } : {} });
  if (!up.ok && up.status !== 206) return new Response("Recording not available", { status: 502 });
  const h = new Headers();
  for (const k of ["content-type", "content-length", "content-range", "last-modified"]) if (up.headers.get(k)) h.set(k, up.headers.get(k));
  h.set("accept-ranges", "bytes");
  h.set("cache-control", "private, max-age=300");
  return new Response(up.body, { status: up.status, headers: h });
}

// admin deletes the saved recording of one call
export async function DELETE(req) {
  if (roleOf(req) !== "admin") return Response.json({ error: "locked" }, { status: 401 });
  if (!configured()) return Response.json({ error: "Database not connected" }, { status: 501 });
  const ts = new URL(req.url).searchParams.get("ts");
  if (!ts) return Response.json({ error: "Missing ts" }, { status: 400 });
  try {
    const [raw] = await pipeline([["HGET", "audio", String(ts)]]);
    const e = parseEntry(raw);
    if (e) { try { await del(e.url); } catch {} }
    const [au] = await pipeline([["HGET", "audits", String(ts)]]);
    const a = parse(au);
    const cmds = [["HDEL", "audio", String(ts)], ["ZREM", "audio_exp", String(ts)]];
    if (a) cmds.push(["HSET", "audits", String(ts), JSON.stringify({ ...a, hasAudio: false, audioExp: null })]);
    await pipeline(cmds);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
