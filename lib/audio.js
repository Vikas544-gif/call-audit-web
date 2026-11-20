import { createHmac, timingSafeEqual } from "crypto";

// Signed, short-lived links so a normal <audio> tag can play a saved recording without the password in the URL.
const secret = () => process.env.AUDIO_SECRET || process.env.DASH_PASSWORD || process.env.KV_REST_API_TOKEN || "open";
export const signAudio = (ts, exp) => createHmac("sha256", secret()).update(`${ts}.${exp}`).digest("hex");
export function verifyAudio(ts, exp, sig) {
  if (!ts || !sig || !(Number(exp) > Date.now())) return false;
  const a = Buffer.from(signAudio(ts, exp)), b = Buffer.from(String(sig));
  return a.length === b.length && timingSafeEqual(a, b);
}

export const DAY = 86400000;
export const parseEntry = (raw) => { try { const e = JSON.parse(raw); return e && e.url ? e : null; } catch { return raw ? { url: String(raw) } : null; } };

// Deletes recordings whose time is over, and uploads that were never saved with an audit (older than a day).
export async function purgeExpired(pipeline, del, now = Date.now(), limit = 10) {
  let n = 0;
  for (const [zset, hash] of [["audio_exp", "audio"], ["tx_exp", "tx"]]) {
    const [ids] = await pipeline([["ZRANGEBYSCORE", zset, "-inf", String(now), "LIMIT", "0", String(limit)]]);
    for (const id of ids || []) {
      const [raw] = await pipeline([["HGET", hash, id]]);
      const e = parseEntry(raw);
      let ok = true;
      if (e) { try { await del(e.url); } catch (err) { ok = /not.?found|404/i.test(String((err && err.message) || "")); } }
      if (ok) { await pipeline([["HDEL", hash, id], ["ZREM", zset, id]]); n++; }
    }
  }
  return n;
}
