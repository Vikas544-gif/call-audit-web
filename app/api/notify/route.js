import { configured, pipeline, authed, newId } from "../../../lib/db";
import { sendMail, mailConfigured, auditHtml, trainerHtml } from "../../../lib/mail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const emails = (a) => [].concat(a || []).map((x) => String(x || "").trim()).filter((x) => x.includes("@"));
const parse = (v) => { try { return v ? JSON.parse(v) : null; } catch { return null; } };

function originOf(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, "");
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

export async function POST(req) {
  if (!authed(req)) return Response.json({ error: "locked" }, { status: 401 });
  try {
    const b = await req.json();
    const a = b.audit;
    if (!a || !a.rep) return Response.json({ error: "Missing audit" }, { status: 400 });
    if (!mailConfigured()) {
      return Response.json({ error: "Email is not set up. Add MAIL_USER and MAIL_PASS (Gmail app password) in Vercel, then redeploy." }, { status: 501 });
    }
    const mode = b.mode || "audit";
    const out = {};

    if (mode === "audit" || mode === "both") {
      const to = emails(b.agentEmail);
      if (!to.length) out.agent = { ok: false, error: "Agent email is not set (Admin Settings > Agent mapping)." };
      else {
        try {
          await sendMail({ to, cc: [...emails(b.tlEmail), ...emails(b.ccEmails)], subject: `Call audit: ${a.rep} - ${a.total}%`, html: auditHtml(a) });
          out.agent = { ok: true };
        } catch (e) { out.agent = { ok: false, error: e.message }; }
      }
    }

    if (mode === "trainer" || mode === "both") {
      const to = emails(b.trainerEmails);
      if (!to.length) out.trainer = { ok: false, error: "Trainer email is not set (Admin Settings > Email and training alerts)." };
      else if (!configured()) out.trainer = { ok: false, error: "Database is not connected, so the training form cannot be saved." };
      else {
        let id = a.taskId;
        if (id) {
          const [v] = await pipeline([["HGET", "tasks", id]]);
          if (!parse(v)) id = null;
        }
        if (!id) {
          id = newId();
          const task = {
            id, created: Date.now(), auditTs: a.ts, agent: a.rep, center: a.center || "", tl: a.tl || "",
            score: a.total, outcome: a.outcome || "", weak: a.weak || [],
            mistakes: (a.mistakes || []).slice(0, 6).map((m) => m.mistake).filter(Boolean),
            status: "Pending",
          };
          await pipeline([["HSET", "tasks", id, JSON.stringify(task)]]);
        }
        out.taskId = id;
        try {
          await sendMail({ to, cc: emails(b.ccEmails), subject: `Training needed: ${a.rep} - ${a.total}%`, html: trainerHtml(a, `${originOf(req)}/training.html?id=${id}`) });
          out.trainer = { ok: true };
        } catch (e) { out.trainer = { ok: false, error: e.message }; }
      }
    }
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
