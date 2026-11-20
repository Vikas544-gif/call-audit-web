import { configured, pipeline, roleOf, protectedApp, parse } from "../../../lib/db";
import { cmpOf } from "../../../lib/cmp";
import { del } from "@vercel/blob";
import { parseEntry, purgeExpired, DAY } from "../../../lib/audio";
import { MCFG, OWNERS_V, DEFAULT_PARAMS, applyOwners } from "../../../lib/defaults";

export const dynamic = "force-dynamic";

const KEYS = ["params3", "centers", "amap", "mcfg3"];

async function readCfg() {
  const [vals] = await pipeline([["MGET", ...KEYS]]);
  const o = {};
  KEYS.forEach((k, i) => { o[k] = parse(vals[i]); });
  // one-time: when the owner table (Trainer / TL per parameter) changes, saved settings get the new owners once
  if (!o.mcfg3 || o.mcfg3.ownersV !== OWNERS_V) {
    o.params3 = applyOwners(o.params3 && o.params3.length ? o.params3 : DEFAULT_PARAMS);
    o.mcfg3 = { ...MCFG, ...(o.mcfg3 || {}), ownersV: OWNERS_V };
    await pipeline([["SET", "params3", JSON.stringify(o.params3)], ["SET", "mcfg3", JSON.stringify(o.mcfg3)]]);
  }
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
      const mcfg3 = { auto: c.auto, weakPct: c.weakPct, calib: c.calib, mand: c.mand, delayOn: c.delayOn, delaySec: c.delaySec, delayPct: c.delayPct, delayParam: c.delayParam };
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
      const key = String(a.rep).trim().toLowerCase();
      // "vs last call" is worked out here (the audit page never reads other audits). A small per-agent index keeps it fast.
      const [lastRaw] = await pipeline([["HGET", "last", key]]);
      let prev = parse(lastRaw);
      if (!prev || prev.ts >= a.ts) {
        prev = null;
        const [flat] = await pipeline([["HGETALL", "audits"]]);
        for (let i = 1; i < (flat || []).length; i += 2) {
          const x = parse(flat[i]);
          if (x && String(x.rep).trim().toLowerCase() === key && x.ts < a.ts && (!prev || x.ts > prev.ts)) prev = x;
        }
      }
      a.cmp = cmpOf(a, prev);
      const cmds = [];
      // the call recording (kept for keepDays) is attached to this audit, so the call can be played any time later
      if (b.audioId) {
        const [tx] = await pipeline([["HGET", "tx", String(b.audioId)]]);
        const e = parseEntry(tx);
        if (e) {
          const [mc] = await pipeline([["GET", "mcfg3"]]);
          const kd = (parse(mc) || {}).keepDays;
          const days = kd == null ? 90 : Number(kd) || 0;
          if (days > 0) {
            const exp = Date.now() + days * DAY;
            a.hasAudio = true; a.audioExp = exp;
            cmds.push(["HSET", "audio", String(a.ts), JSON.stringify({ url: e.url, t: Date.now(), exp })], ["ZADD", "audio_exp", String(exp), String(a.ts)]);
          } else { try { await del(e.url); } catch {} }
          cmds.push(["HDEL", "tx", String(b.audioId)], ["ZREM", "tx_exp", String(b.audioId)]);
        }
      }
      cmds.push(["HSET", "audits", String(a.ts), JSON.stringify(a)]);
      if (typeof b.transcript === "string" && b.transcript) cmds.push(["HSET", "scripts", String(a.ts), b.transcript.slice(0, 150000)]);
      const [cur] = await pipeline([["HGET", "last", key]]);
      const c = parse(cur);
      if (!c || c.ts < a.ts) cmds.push(["HSET", "last", key, JSON.stringify({ ts: a.ts, total: a.total, sc: a.sc, date: a.date })]);
      await pipeline(cmds);
      if (Math.random() < 0.25) { try { await purgeExpired(pipeline, del); } catch {} } // now and then, remove recordings whose time is over
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
