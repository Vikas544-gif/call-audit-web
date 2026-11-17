import { configured, pipeline, roleOf, parse } from "../../../lib/db";
import { sendMail, mailConfigured, ackHtml, draftHtml, originOf } from "../../../lib/mail";

export const dynamic = "force-dynamic";

const clip = (s, n) => String(s == null ? "" : s).slice(0, n);
const first = (s) => String(s || "").split(/[,;\s]+/).filter((x) => x.includes("@"));

// GET ?id=  -> public (trainer / TL / agent open it from the email link; the id is unguessable)
// GET       -> admin only: list of all follow-up tasks
export async function GET(req) {
  if (!configured()) return Response.json({ tasks: [], error: "Database not connected" });
  const id = new URL(req.url).searchParams.get("id");
  try {
    if (id) {
      const [v] = await pipeline([["HGET", "tasks", id]]);
      const t = parse(v);
      if (!t) return Response.json({ error: "This link is not valid." }, { status: 404 });
      const { mistakesFull, ...pub } = t;
      return Response.json({ task: pub });
    }
    if (roleOf(req) !== "admin") return Response.json({ error: "locked" }, { status: 401 });
    const [flat] = await pipeline([["HGETALL", "tasks"]]);
    const tasks = [];
    for (let i = 1; i < (flat || []).length; i += 2) { const t = parse(flat[i]); if (t) { delete t.mistakesFull; tasks.push(t); } }
    tasks.sort((a, b) => (b.created || 0) - (a.created || 0));
    return Response.json({ tasks });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!configured()) return Response.json({ error: "Database not connected" }, { status: 501 });
  try {
    const b = await req.json();
    if (!b.id) return Response.json({ error: "Missing id" }, { status: 400 });
    const [v] = await pipeline([["HGET", "tasks", String(b.id)]]);
    const t = parse(v);
    if (!t) return Response.json({ error: "This link is not valid." }, { status: 404 });

    if (b.ack) {
      if (t.status !== "Submitted") return Response.json({ error: "This follow-up is not completed yet." }, { status: 400 });
      await pipeline([["HSET", "tasks", t.id, JSON.stringify({ ...t, ackAt: Date.now() })]]);
      return Response.json({ ok: true });
    }

    const trainer = clip(b.trainer, 120).trim();
    if (!trainer) return Response.json({ error: "Please enter your name." }, { status: 400 });
    const upd = { ...t, status: "Submitted", trainer, action: clip(b.action, 120), trainDate: clip(b.trainDate, 20), nextReview: clip(b.nextReview, 20), notes: clip(b.notes, 2000), submitted: Date.now(), ackMail: "" };

    // Acknowledgement mail: off | draft (QA gets a ready draft) | auto (agent gets it directly)
    try {
      const [vals] = await pipeline([["MGET", "mcfg3", "amap"]]);
      const cfg = parse(vals[0]) || {}, amap = parse(vals[1]) || [];
      const ag = amap.find((x) => x.name && x.name.toLowerCase() === String(t.agent).toLowerCase()) || {};
      const link = `${originOf(req)}/training.html?id=${t.id}&ack=1`;
      if (cfg.ackMode === "auto" && mailConfigured()) {
        const to = first(ag.email);
        if (!to.length) upd.ackMail = "Agent email is not set";
        else { await sendMail({ to, cc: first(ag.tlEmail), subject: `Your ${t.owner === "Trainer" ? "training" : "coaching"} is done - please acknowledge`, html: ackHtml(upd, link) }); upd.ackMail = "sent"; }
      } else if ((cfg.ackMode || "draft") === "draft" && mailConfigured() && first(cfg.qa).length) {
        await sendMail({ to: first(cfg.qa), subject: `Draft ready: acknowledgement mail for ${t.agent}`, html: draftHtml(upd, first(ag.email)[0], link) });
        upd.ackMail = "draft sent to QA";
      }
    } catch (e) { upd.ackMail = "error: " + e.message; }

    await pipeline([["HSET", "tasks", t.id, JSON.stringify(upd)]]);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
