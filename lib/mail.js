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
  const t = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.MAIL_USER, pass: String(process.env.MAIL_PASS).replace(/\s+/g, "") } });
  await t.sendMail({ from: `"${process.env.MAIL_FROM_NAME || "QA Team"}" <${process.env.MAIL_USER}>`, to: toL.join(","), cc: ccL.join(",") || undefined, subject, html });
}

const box = "font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#14181f;max-width:680px";
const h2 = "margin:18px 0 6px;font-size:15px;color:#0f1f3d";
const li = (a) => (a || []).map((x) => `<li>${esc(x)}</li>`).join("");
const mist = (a) => (a.mistakes || []).slice(0, 6).map((m) => `<div style="border-left:3px solid #c0392b;padding:4px 10px;margin:8px 0;background:#f5f6f8"><b>${esc(m.mistake)}</b><div style="color:#667085;font-style:italic">"${esc(m.quote)}"</div><div>Say instead: ${esc(m.fix)}</div></div>`).join("");

export function auditHtml(a) {
  const rows = Object.entries(a.sc || {}).map(([k, v]) => `<tr><td style="padding:4px 8px;border:1px solid #e3e6ec">${esc(k)}</td><td style="padding:4px 8px;border:1px solid #e3e6ec;text-align:center">${esc(v.s)}/${esc(v.max)}</td></tr>`).join("");
  const no = (a.mandatory || []).filter((m) => m.result === "no").map((m) => m.statement);
  return `<div style="${box}"><h2 style="margin:0 0 4px">Call audit feedback: ${esc(a.rep)}</h2>
<p style="margin:0 0 8px">Score: <b>${esc(a.total)}%</b> &middot; ${esc(a.outcome)} &middot; ${esc(a.type || "")} &middot; ${esc(a.date || "")}</p>
<p>${esc(a.summary)}</p><h3 style="${h2}">Why the sale did or did not happen</h3><p>${esc(a.why)}</p>
<h3 style="${h2}">Parameter scores</h3><table style="border-collapse:collapse">${rows}</table>
${(a.mistakes || []).length ? `<h3 style="${h2}">Mistakes and how to fix them</h3>${mist(a)}` : ""}
${no.length ? `<h3 style="${h2}">Mandatory statements not done</h3><ul>${li(no)}</ul>` : ""}
${(a.tips || []).length ? `<h3 style="${h2}">Next steps to improve sales</h3><ul>${li(a.tips)}</ul>` : ""}</div>`;
}

export function trainerHtml(a, link) {
  return `<div style="${box}"><h2 style="margin:0 0 4px">Training needed: ${esc(a.rep)}</h2>
<p>Call audit score <b>${esc(a.total)}%</b> (${esc(a.outcome)}). Please plan a training and record it using the button below.</p>
${(a.weak || []).length ? `<h3 style="${h2}">Weak parameters</h3><ul>${li(a.weak)}</ul>` : ""}
${(a.mistakes || []).length ? `<h3 style="${h2}">Key mistakes</h3>${mist(a)}` : ""}
<p style="margin:20px 0"><a href="${esc(link)}" style="background:#0b7a5b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Submit training plan</a></p>
<p style="color:#667085;font-size:12px">Or open this link: ${esc(link)}</p></div>`;
}
