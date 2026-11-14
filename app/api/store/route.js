export const dynamic = "force-dynamic";

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEYS = ["params2", "centers", "amap", "mcfg2"];

function denied(req) {
  const need = process.env.DASH_PASSWORD;
  return Boolean(need) && req.headers.get("x-pass") !== need;
}

async function pipeline(cmds) {
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

export async function GET(req) {
  if (!URL_ || !TOKEN) return Response.json({ configured: false });
  if (denied(req)) return Response.json({ error: "locked" }, { status: 401 });
  try {
    const [flat, vals] = await pipeline([["HGETALL", "audits"], ["MGET", ...KEYS]]);
    const audits = [];
    for (let i = 1; i < (flat || []).length; i += 2) {
      try { audits.push(JSON.parse(flat[i])); } catch {}
    }
    const out = { configured: true, audits };
    KEYS.forEach((k, i) => {
      try { out[k] = vals[i] ? JSON.parse(vals[i]) : null; } catch { out[k] = null; }
    });
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!URL_ || !TOKEN) return Response.json({ configured: false });
  if (denied(req)) return Response.json({ error: "locked" }, { status: 401 });
  try {
    const b = await req.json();
    if (b.action === "set" && KEYS.includes(b.key)) {
      await pipeline([["SET", b.key, JSON.stringify(b.value)]]);
    } else if (b.action === "audit" && b.audit && b.audit.ts) {
      await pipeline([["HSET", "audits", String(b.audit.ts), JSON.stringify(b.audit)]]);
    } else {
      return Response.json({ error: "bad request" }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}