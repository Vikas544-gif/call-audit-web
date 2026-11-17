export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY || (process.env.MAIL_USER && process.env.MAIL_PASS));

export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function sendMail({ to, cc, subject, html }) {
  const toL = [].concat(to || []).filter(Boolean);
  const ccL = [].concat(cc || []).filter(Boolean).filter((x) => !toL.includes(x));
  if (!toL.length) throw new Error("No recipient email");
  if (process.env.RESEND_API_KEY) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM || "onboarding@resend.dev", to: toL, cc: ccL.length ? ccL : undefined, subject, html }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || "Resend error " + r.status);
    return;
  }
  const nodemailer = (await import("nodemailer")).default;
  const auth = { user: process.env.MAIL_USER, pass: String(process.env.MAIL_PASS).replace(/\s+/g, "") };
  const t = process.env.SMTP_HOST
    ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === "1", auth, tls: { rejectUnauthorized: false } })
    : nodemailer.createTransport({ service: "gmail", auth });
  await t.sendMail({ from: `"${process.env.MAIL_FROM_NAME || "QA Team"}" <${process.env.MAIL_USER}>`, to: toL.join(","), cc: ccL.join(",") || undefined, subject, html });
}

export function originOf(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, "");
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

const box = "font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#14181f;max-width:680px";
const h3 = "margin:18px 0 6px;font-size:15px;color:#0f1f3d";
const td = "padding:5px 9px;border:1px solid #e3e6ec";
const li = (a) => (a || []).map((x) => `<li>${esc(x)}</li>`).join("");
const btn = (href, text) => `<p style="margin:20px 0"><a href="${esc(href)}" style="background:#0b7a5b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">${esc(text)}</a></p>`;
const who = (a) => `<p style="margin:0 0 8px;color:#344054">Customer: <b>${esc(a.customer || "-")}</b>${a.contactId ? ` &middot; Contact ID: <b>${esc(a.contactId)}</b>` : ""}${a.date ? ` &middot; ${esc((a.date || "").split(",")[0])}` : ""}</p>`;
const mist = (list) => (list || []).slice(0, 8).map((m) => `<div style="border-left:3px solid #c0392b;padding:4px 10px;margin:8px 0;background:#f5f6f8"><b>${esc(m.mistake)}</b>${m.parameter ? ` <span style="color:#667085;font-size:12px">[${esc(m.parameter)}]</span>` : ""}<div style="color:#667085;font-style:italic">"${esc(m.quote)}"</div><div>Say instead: ${esc(m.fix)}</div></div>`).join("");

export function auditHtml(a, weak) {
  const wk = new Set((weak || []).map((w) => w.label));
  const rows = Object.entries(a.sc || {}).map(([k, v]) => `<tr><td style="${td}">${esc(k)}${wk.has(k) ? ' <b style="color:#c0392b">(needs work)</b>' : ""}</td><td style="${td};text-align:center">${esc(Math.round((v.s / v.max) * 100))}%</td></tr>`).join("");
  const miss = (a.mandatory || []).filter((m) => m.result !== "yes");
  return `<div style="${box}"><h2 style="margin:0 0 4px">Call audit feedback: ${esc(a.rep)}</h2>${who(a)}
<p style="margin:0 0 8px">Score: <b>${esc(a.total)}%</b> &middot; ${esc(a.outcome)} &middot; ${esc(a.type || "")}</p>
<p>${esc(a.summary)}</p><h3 style="${h3}">Why the sale did or did not happen</h3><p>${esc(a.why)}</p>
<h3 style="${h3}">Parameter scores</h3><table style="border-collapse:collapse">${rows}</table>
${(a.mistakes || []).length ? `<h3 style="${h3}">Mistakes and how to fix them</h3>${mist(a.mistakes)}` : ""}
${miss.length ? `<h3 style="${h3}">Mandatory statements missed or partial</h3><ul>${miss.map((m) => `<li>${esc(m.statement)} <i>(${esc(m.result)})</i></li>`).join("")}</ul>` : ""}
${(a.tips || []).length ? `<h3 style="${h3}">Next steps to improve sales</h3><ul>${li(a.tips)}</ul>` : ""}</div>`;
}

export function followHtml(t, link) {
  const tr = t.owner === "Trainer";
  return `<div style="${box}"><h2 style="margin:0 0 4px">${tr ? "Training needed" : "Coaching needed"}: ${esc(t.agent)}</h2>${who(t)}
<p>Call audit score <b>${esc(t.score)}%</b> (${esc(t.outcome)}). ${tr ? "These parameters are owned by the Trainer. Please plan a training and record it below." : "These parameters are owned by the Team Leader. Please give feedback or coaching to the agent and record it below."}</p>
<h3 style="${h3}">Weak parameters</h3><ul>${li(t.weak)}</ul>
${(t.mistakesFull || []).length ? `<h3 style="${h3}">Key mistakes</h3>${mist(t.mistakesFull)}` : ""}
${btn(link, tr ? "Submit training plan" : "Submit coaching feedback")}<p style="color:#667085;font-size:12px">Or open this link: ${esc(link)}</p></div>`;
}

export function ackHtml(t, link) {
  return `<div style="${box}"><h2 style="margin:0 0 4px">Your ${t.owner === "Trainer" ? "training" : "coaching"} is done</h2>${who(t)}
<p>Hi ${esc(t.agent)}, <b>${esc(t.trainer)}</b> has completed a follow-up on your call audit (${esc(t.score)}%).</p>
<ul><li>Action: ${esc(t.action)}</li>${t.trainDate ? `<li>Date: ${esc(t.trainDate)}</li>` : ""}${t.nextReview ? `<li>Next review: ${esc(t.nextReview)}</li>` : ""}</ul>
${t.notes ? `<p>${esc(t.notes)}</p>` : ""}${btn(link, "Acknowledge")}</div>`;
}

export function draftHtml(t, agentEmail, ackLink) {
  const subj = `Your ${t.owner === "Trainer" ? "training" : "coaching"} is done - please acknowledge`;
  const body = `Hi ${t.agent},\n\n${t.trainer} has completed a follow-up on your call audit (${t.score}%).\nAction: ${t.action}\n${t.nextReview ? "Next review: " + t.nextReview + "\n" : ""}\nPlease acknowledge here: ${ackLink}\n`;
  const href = `mailto:${encodeURIComponent(agentEmail || "")}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
  return `<div style="${box}"><h2 style="margin:0 0 4px">Draft ready to send</h2><p>${esc(t.trainer)} completed a follow-up for <b>${esc(t.agent)}</b>. Click the button, check the draft and press send.</p>${btn(href, "Open draft")}<p style="color:#667085;font-size:12px">Agent email: ${esc(agentEmail || "not set")}</p></div>`;
}
