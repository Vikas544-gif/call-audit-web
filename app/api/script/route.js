import { configured, pipeline, roleOf } from "../../../lib/db";

export const dynamic = "force-dynamic";

// the saved call script (admin only)
export async function GET(req) {
  if (roleOf(req) !== "admin") return Response.json({ error: "locked" }, { status: 401 });
  if (!configured()) return Response.json({ error: "Database not connected" }, { status: 501 });
  const ts = new URL(req.url).searchParams.get("ts");
  if (!ts) return Response.json({ error: "Missing ts" }, { status: 400 });
  try {
    const [t] = await pipeline([["HGET", "scripts", String(ts)]]);
    if (!t) return Response.json({ error: "No script saved for this call" }, { status: 404 });
    return Response.json({ transcript: t });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
