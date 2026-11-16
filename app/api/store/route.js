import { configured, pipeline, roleOf } from "../../../lib/db";

export const dynamic = "force-dynamic";

const KEYS = ["params2", "centers", "amap", "mcfg2"];
const parse = (v) => { try { return v ? JSON.parse(v) : null; } catch { return null; } };

export async function GET(req) {
  if (!configured()) return Response.json({ configured: false });
  const role = roleOf(req);
  if (!role) return Response.json({ error: "locked" }, { status: 401 });
  const scope = new URL(req.url).searchParams.get("scope");
  try {
    if (scope === "audit") {
      const [vals] = await pipeline([["MGET", ...KEYS]]);
      const o = {};
      KEYS.forEach((k, i) => { o[k] = parse(vals[i]); });
      const amap = (o.amap || []).map(({ email, tlEmail, ...rest }) => rest);
      const c = o.mcfg2 || {};
      const mcfg2 = { auto: c.auto, thr: c.thr, calib: c.calib, mand: c.mand, trainer: c.trainer ? "set" : "", cc: "" };
      return Response.json({ configured: true, role, params2: o.params2, centers: o.centers, amap, mcfg2 });
    }
    if (role !== "admin") return Response.json({ error: "admin only" }, { status: 403 });
    const [flat, vals] = await pipeline([["HGETALL", "audits"], ["MGET", ...KEYS]]);
    const audits = [];
    for (let i = 1; i < (flat || []).length; i += 2) {
      const a = parse(flat[i]);
      if (a) audits.push(a);
    }
    const out = { configured: true, role, audits };
    KEYS.forEach((k, i) => { out[k] = parse(vals[i]); });
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!configured()) return Response.json({ configured: false });
  const role = roleOf(req);
  if (!role) return Response.json({ error: "locked" }, { status: 401 });
  try {
    const b = await req.json();
    if (b.action === "set" && KEYS.includes(b.key)) {
      if (role !== "admin") return Response.json({ error: "admin only" }, { status: 403 });
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
