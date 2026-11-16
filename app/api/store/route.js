import { configured, pipeline, authed, protectedApp } from "../../../lib/db";

export const dynamic = "force-dynamic";

const KEYS = ["params2", "centers", "amap", "mcfg2"];
const parse = (v) => { try { return v ? JSON.parse(v) : null; } catch { return null; } };

export async function GET(req) {
  if (!configured()) return Response.json({ configured: false });
  if (!authed(req)) return Response.json({ error: "locked" }, { status: 401 });
  try {
    const [flat, vals] = await pipeline([["HGETALL", "audits"], ["MGET", ...KEYS]]);
    const audits = [];
    for (let i = 1; i < (flat || []).length; i += 2) {
      const a = parse(flat[i]);
      if (a) audits.push(a);
    }
    audits.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const out = { configured: true, protected: protectedApp(), audits };
    KEYS.forEach((k, i) => { out[k] = parse(vals[i]); });
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!configured()) return Response.json({ configured: false });
  if (!authed(req)) return Response.json({ error: "locked" }, { status: 401 });
  try {
    const b = await req.json();
    if (b.action === "set" && KEYS.includes(b.key)) {
      await pipeline([["SET", b.key, JSON.stringify(b.value)]]);
    } else if (b.action === "audit" && b.audit && b.audit.ts) {
      await pipeline([["HSET", "audits", String(b.audit.ts), JSON.stringify(b.audit)]]);
    } else if (b.action === "audits" && Array.isArray(b.audits) && b.audits.length) {
      const args = [];
      b.audits.filter((a) => a && a.ts).forEach((a) => { args.push(String(a.ts), JSON.stringify(a)); });
      if (args.length) await pipeline([["HSET", "audits", ...args]]);
    } else {
      return Response.json({ error: "bad request" }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
