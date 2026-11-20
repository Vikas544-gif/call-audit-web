import { configured, pipeline, roleOf } from "../../../lib/db";
import { signAudio } from "../../../lib/audio";

export const dynamic = "force-dynamic";

// admin asks for a playable link (valid for one hour) for a saved recording
export async function GET(req) {
  if (roleOf(req) !== "admin") return Response.json({ error: "locked" }, { status: 401 });
  if (!configured()) return Response.json({ error: "Database not connected" }, { status: 501 });
  const ts = new URL(req.url).searchParams.get("ts");
  if (!ts) return Response.json({ error: "Missing ts" }, { status: 400 });
  const [raw] = await pipeline([["HGET", "audio", String(ts)]]);
  if (!raw) return Response.json({ error: "No recording saved for this call (it may have expired)" }, { status: 404 });
  const exp = Date.now() + 3600000;
  return Response.json({ url: `/api/audio?ts=${encodeURIComponent(ts)}&exp=${exp}&sig=${signAudio(ts, exp)}` });
}
