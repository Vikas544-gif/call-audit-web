import { randomBytes } from "crypto";

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const configured = () => Boolean(URL_ && TOKEN);

export async function pipeline(cmds) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: "POST",
    cache: "no-store", // database answers must never be cached by Next.js
    headers: { Authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(cmds),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Database error");
  return j.map((x) => {
    if (x.error) throw new Error(x.error);
    return x.result;
  });
}

export async function getJson(key) {
  const [v] = await pipeline([["GET", key]]);
  try { return v ? JSON.parse(v) : null; } catch { return null; }
}

// admin (DASH_PASSWORD) = everything. auditor (AUDIT_PASSWORD) = audit page only.
// If DASH_PASSWORD is not set the app is open to anyone with the link.
export const protectedApp = () => Boolean(process.env.DASH_PASSWORD);
export function roleOf(req, given) {
  const admin = process.env.DASH_PASSWORD, aud = process.env.AUDIT_PASSWORD;
  const p = given != null ? given : (req && req.headers.get("x-pass")) || "";
  if (!admin) return "admin";
  if (p === admin) return "admin";
  if (aud && p === aud) return "auditor";
  return null;
}

export const parse = (v) => { try { return v ? JSON.parse(v) : null; } catch { return null; } };

export const newId = () => randomBytes(9).toString("hex");
