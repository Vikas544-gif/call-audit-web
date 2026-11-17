import { configured, pipeline, roleOf, protectedApp, parse } from "../../../lib/db";
import { cmpOf } from "../../../lib/cmp";

export const dynamic = "force-dynamic";

const KEYS = ["params3", "centers", "amap", "mcfg3"];

async function readCfg() {
  const [vals] = await pipeline([["MGET", ...KEYS]]);
  const o = {};
  KEYS.forEach((k, i) => { o[k] = parse(vals[i]); });
  return o;
}

export async function GET(req) {
  const role = roleOf(req);
  if (!role) return Response.json({ error: "locked" }, { status: 401 });
  if (!configured()) return Response.json({ configured: false, role });
  const scope = new URL(req.url).searchParams.get("scope");
  try {
    if (scope === "audit") {
      const o = await readCfg();
      const amap = (o.amap || []).map(({ email, tlEmail, ...rest }) => rest);
      const c = o.mcfg3 || {};
      const mcfg3 = { auto: c.auto, weakPct: c.weakPct, calib: c.calib, mand: c.mand };
      return Response.json({ configured: true, role, params3: o.params3, centers: o.centers, amap, mcfg3 });
    }
    if (role !== "admin") return Response.json({ error: "admin only" }, { status: 403 });
    const [flat] = await pipeline([["HGETALL", "audits"]]);
    const audits = [];
    for (let i = 1; i < (flat || []).length; i += 2) { const a = parse(flat[i]); if (a) audits.push(a); }
    audits.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return Response.json({ configured: true, role, protected: protectedApp(), audits, ...(await readCfg()) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  const role = roleOf(req);
  if (!role) return Response.json({ error: "locked" }, { status: 401 });
  if (!configured()) return Response.json({ configured: false });
  try {
    const b = await req.json();
    if (b.action === "set" && KEYS.includes(b.key)) {
      if (role !== "admin") return Response.json({ error: "admin only" }, { status: 403 });
      await pipeline([["SET", b.key, JSON.stringify(b.value)]]);
      return Response.json({ ok: true });
    }
    if (b.action === "audit" && b.audit && b.audit.ts && b.audit.rep) {
      const a = b.audit;
      // "vs last call" is worked out here, so the audit page never needs to read other audits
      const [flat] = await pipeline([["HGETALL", "audits"]]);
      let prev = null;
      for (let i = 1; i < (flat || []).length; i += 2) {
        const x = parse(flat[i]);
        if (x && x.rep === a.rep && x.ts < a.ts && (!prev || x.ts > prev.ts)) prev = x;
      }
      a.cmp = cmpOf(a, prev);
      await pipeline([["HSET", "audits", String(a.ts), JSON.stringify(a)]]);
      return Response.json({ ok: true, audit: a });
    }
    if (b.action === "audits" && Array.isArray(b.audits) && b.audits.length) {
      if (role !== "admin") return Response.json({ error: "admin only" }, { status: 403 });
      const args = [];
      b.audits.filter((a) => a && a.ts).forEach((a) => { args.push(String(a.ts), JSON.stringify(a)); });
      if (args.length) await pipeline([["HSET", "audits", ...args]]);
      return Response.json({ ok: true });
    }
    return Response.json({ error: "bad request" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
