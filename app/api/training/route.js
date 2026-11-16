import { configured, pipeline, authed } from "../../../lib/db";

export const dynamic = "force-dynamic";

const parse = (v) => { try { return v ? JSON.parse(v) : null; } catch { return null; } };
const clip = (s, n) => String(s == null ? "" : s).slice(0, n);

// GET ?id=...  -> public: the trainer opens this from the email link (the id is unguessable)
// GET          -> dashboard only: list of all training tasks
export async function GET(req) {
  if (!configured()) return Response.json({ tasks: [], error: "Database not connected" }, { status: 200 });
  const id = new URL(req.url).searchParams.get("id");
  try {
    if (id) {
      const [v] = await pipeline([["HGET", "tasks", id]]);
      const t = parse(v);
      if (!t) return Response.json({ error: "This training link is not valid." }, { status: 404 });
      const { id: tid, agent, center, tl, score, weak, mistakes, status, trainer } = t;
      return Response.json({ task: { id: tid, agent, center, tl, score, weak, mistakes, status, trainer } });
    }
    if (!authed(req)) return Response.json({ error: "locked" }, { status: 401 });
    const [flat] = await pipeline([["HGETALL", "tasks"]]);
    const tasks = [];
    for (let i = 1; i < (flat || []).length; i += 2) {
      const t = parse(flat[i]);
      if (t) tasks.push(t);
    }
    tasks.sort((a, b) => (b.created || 0) - (a.created || 0));
    return Response.json({ tasks });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Trainer submits the plan (public, needs the id from the email link)
export async function POST(req) {
  if (!configured()) return Response.json({ error: "Database not connected" }, { status: 501 });
  try {
    const b = await req.json();
    if (!b.id) return Response.json({ error: "Missing training id" }, { status: 400 });
    const [v] = await pipeline([["HGET", "tasks", String(b.id)]]);
    const t = parse(v);
    if (!t) return Response.json({ error: "This training link is not valid." }, { status: 404 });
    const trainer = clip(b.trainer, 120).trim();
    if (!trainer) return Response.json({ error: "Please enter your name." }, { status: 400 });
    const upd = {
      ...t,
      status: "Submitted",
      trainer,
      action: clip(b.action, 120),
      trainDate: clip(b.trainDate, 20),
      nextReview: clip(b.nextReview, 20),
      notes: clip(b.notes, 2000),
      submitted: Date.now(),
    };
    await pipeline([["HSET", "tasks", t.id, JSON.stringify(upd)]]);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
