const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const configured = () => Boolean(URL_ && TOKEN);

export async function pipeline(cmds) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: "POST",
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

// admin = full access, auditor = audit page only, null = not allowed
export function roleOf(req) {
  const admin = process.env.DASH_PASSWORD;
  const aud = process.env.AUDIT_PASSWORD;
  const p = req.headers.get("x-pass") || "";
  if (!admin) return "admin";
  if (p === admin) return "admin";
  if (aud && p === aud) return "auditor";
  return null;
}
