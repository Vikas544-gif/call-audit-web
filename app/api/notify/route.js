import { configured, pipeline, roleOf, newId, parse } from "../../../lib/db";
import { sendMail, mailConfigured, auditHtml, followHtml, originOf } from "../../../lib/mail";
import { weakParams, MCFG } from "../../../lib/defaults";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const emails = (a) => (Array.isArray(a) ? a : String(a || "").split(/[,;\s]+/)).map((x) => String(x || "").trim()).filter((x) => x.includes("@"));

// mode: "all" = agent mail + follow-ups | "agent" = only the agent mail | "tasks" = only trainer/TL follow-ups
// Emails are looked up on the server, so the audit page never sees them.
export async function POST(req) {
  if (!roleOf(req)) return Response.json({ error: "locked" }, { status: 401 });
  if (!configured()) return Response.json({ error: "Database is not connected." }, { status: 501 });
  try {
    const b = await req.json();
    const a = b.audit;
    if (!a || !a.rep || !a.ts) return Response.json({ error: "Missing audit" }, { status: 400 });
    if (!mailConfigured()) return Response.json({ error: "Email is not set up. Add MAIL_USER and MAIL_PASS (Gmail app password) in Vercel, then redeploy." }, { status: 501 });
    const mode = b.mode || "all";
    const [vals] = await pipeline([["MGET", "params3", "amap", "mcfg3"]]);
    const params = parse(vals[0]) || [], amap = parse(vals[1]) || [], cfg = { ...MCFG, ...(parse(vals[2]) || {}) };
    const ag = amap.find((x) => x.name && x.name.toLowerCase() === a.rep.toLowerCase()) || {};
    const cc = emails(cfg.cc), weak = weakParams(a, params, cfg.weakPct);
    const mail = { ...(a.mail || {}) }, tasks = [...(a.tasks || [])];

    if (mode === "all" || mode === "agent") {
      const to = emails(ag.email);
      if (!to.length) { mail.agent = false; mail.agentErr = "Agent email is not set (Settings > Agent mapping)."; }
      else {
        try { await sendMail({ to, cc: [...emails(ag.tlEmail), ...cc], subject: `Call audit: ${a.rep} - ${a.total}%`, html: auditHtml(a, weak) }); mail.agent = true; mail.agentErr = ""; }
        catch (e) { mail.agent = false; mail.agentErr = e.message; }
      }
    }

    if (mode === "all" || mode === "tasks") {
      for (const owner of ["Trainer", "TL"]) {
        const mine = weak.filter((w) => w.owner === owner);
        const key = owner === "Trainer" ? "trainer" : "tl";
        if (!mine.length) continue;
        const to = owner === "Trainer" ? emails(cfg.trainer) : emails(ag.tlEmail);
        if (!to.length) { mail[key] = false; mail[key + "Err"] = owner === "Trainer" ? "Trainer email is not set (Settings > Email and follow-ups)." : "TL email is not set (Settings > Agent mapping)."; continue; }
        let tk = tasks.find((x) => x.owner === owner);
        const labels = new Set(mine.map((w) => w.label));
        const related = (a.mistakes || []).filter((m) => labels.has(m.parameter));
        const task = {
          id: tk ? tk.id : newId(), created: Date.now(), auditTs: a.ts, owner, agent: a.rep, center: a.center || "", tl: a.tl || "",
          customer: a.customer || "", contactId: a.contactId || "", score: a.total, outcome: a.outcome || "",
          weak: mine.map((w) => `${w.label} (${w.pct}%)`), mistakes: related.map((m) => m.mistake), mistakesFull: related, status: "Pending",
        };
        if (tk) {
          const [old] = await pipeline([["HGET", "tasks", tk.id]]);
          const o = parse(old);
          if (o) { task.created = o.created; Object.assign(task, o, { weak: task.weak }); }
        } else { tasks.push({ id: task.id, owner }); }
        await pipeline([["HSET", "tasks", task.id, JSON.stringify(task)]]);
        try { await sendMail({ to, cc, subject: `${owner === "Trainer" ? "Training" : "Coaching"} needed: ${a.rep} - ${a.total}%`, html: followHtml(task, `${originOf(req)}/training.html?id=${task.id}`) }); mail[key] = true; mail[key + "Err"] = ""; }
        catch (e) { mail[key] = false; mail[key + "Err"] = e.message; }
      }
    }

    const [cur] = await pipeline([["HGET", "audits", String(a.ts)]]);
    const stored = parse(cur);
    if (stored) await pipeline([["HSET", "audits", String(a.ts), JSON.stringify({ ...stored, mail, tasks })]]);
    return Response.json({ mail, tasks, weak });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
