"use client";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_PARAMS, CENTERS, MCFG } from "../../lib/defaults";

export const TENURES = ["0-3 Month", "3-6 Month", "More than 6 Month"];
export const STRATS = ["No Strategy", "5 in 5", "Combo", "MPO"];
export const STATUSES = ["Follow-up", "Interested", "Not Interested", "Not Connected"];
export const CTYPES = ["New Lead", "Work to Non Work"];

export const colr = (p) => (p >= 75 ? "#0b9a72" : p >= 50 ? "#d29a1f" : "#d4493a");
export const heat = (p) => (p == null ? "transparent" : p >= 75 ? "rgba(11,154,114,.22)" : p >= 50 ? "rgba(210,154,31,.24)" : "rgba(212,73,58,.24)");
export const rd = (n) => Math.round(n * 10) / 10;
export const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
export const uniq = (a) => [...new Set(a.filter(Boolean))].sort();
export { wkLbl } from "../../lib/filters";
export const pct = (v) => (v == null || isNaN(v) ? "-" : Math.round(v) + "%");
export const fixA = (arr) => (Array.isArray(arr) ? arr : []).filter((a) => a && a.ts && a.rep).map((a) => ({ ...a, sc: a.sc || {}, mistakes: a.mistakes || [], mandatory: a.mandatory || [], tasks: a.tasks || [] }));
export const mandScore = (a) => { const m = a.mandatory || []; return m.length ? (m.reduce((x, y) => x + (y.result === "yes" ? 1 : y.result === "partial" ? 0.5 : 0), 0) / m.length) * 100 : null; };

export const getPass = () => { try { return localStorage.getItem("cap") || ""; } catch { return ""; } };
export const setPass = (v) => { try { localStorage.setItem("cap", v); } catch {} };
export const api = (path, o = {}) => fetch(path, { ...o, headers: { ...(o.headers || {}), "x-pass": getPass(), ...(o.body ? { "content-type": "application/json" } : {}) } });
const rd1 = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

let lastTs = 0;
export const nextTs = () => { let t = Date.now(); if (t <= lastTs) t = lastTs + 1; lastTs = t; return t; };

export function dl(name, rows) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
  a.download = name; a.click();
}

const KEYMAP = { params: "params3", centers: "centers", amap: "amap", mcfg: "mcfg3" };

// scope "audit" = audit page (config only) | "full" = dashboard (everything, admin only)
export function useStore(scope) {
  const [st, setSt] = useState({ ready: false, locked: false, configured: true, role: "", error: "" });
  const [params, setParams] = useState(DEFAULT_PARAMS), [centers, setCenters] = useState(CENTERS), [amap, setAmap] = useState([]), [mcfg, setMcfg] = useState(MCFG);
  const [audits, setAudits] = useState([]), [tasks, setTasks] = useState([]);
  const timers = useRef({});

  const [save, setSave] = useState({ s: "idle", msg: "" });
  const doSave = async (k, v) => {
    setSave({ s: "saving", msg: "" });
    try {
      const r = await api("/api/store", { method: "POST", body: JSON.stringify({ action: "set", key: KEYMAP[k], value: v }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `Save failed (${r.status})`);
      setSave({ s: "saved", msg: "" });
    } catch (e) { setSave({ s: "error", msg: e.message || "Network error" }); }
  };
  // typing is saved after a short pause; buttons (add, remove, import) pass now=true and save at once
  const persist = (k, v, now) => {
    clearTimeout(timers.current[k]);
    if (now) { timers.current[k] = null; return doSave(k, v); }
    setSave({ s: "saving", msg: "" });
    timers.current[k] = setTimeout(() => { timers.current[k] = null; doSave(k, v); }, 500);
  };
  useEffect(() => {
    const warn = (e) => { if (Object.values(timers.current).some(Boolean)) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const loadTasks = async () => { try { const r = await api("/api/training"); if (r.ok) setTasks((await r.json()).tasks || []); } catch {} };
  const refresh = async () => {
    try {
      const r = await api("/api/store");
      if (!r.ok) return;
      const j = await r.json();
      if (Array.isArray(j.audits)) setAudits(fixA(j.audits));
      loadTasks();
    } catch {}
  };
  const load = async () => {
    try {
      const r = await api("/api/store" + (scope === "audit" ? "?scope=audit" : ""));
      if (r.status === 401 || r.status === 403) { setSt({ ready: true, locked: true, configured: true, role: "", error: "", wrong: Boolean(getPass()) }); return; }
      const j = await r.json();
      if (!j.configured) { setSt({ ready: true, locked: false, configured: false, role: j.role || "", error: "" }); return; }
      setParams(j.params3 && j.params3.length ? j.params3 : DEFAULT_PARAMS);
      setCenters(j.centers || CENTERS);
      setAmap(j.amap || []);
      setMcfg({ ...MCFG, ...(j.mcfg3 || {}) });
      if (scope !== "audit") {
        setAudits(fixA(j.audits));
        // bring over the agent list typed on an older version (saved in this browser)
        if (!j.amap) { const la = rd1("amap", null); if (la && la.length) { setAmap(la); persist("amap", la); } }
        if (!j.centers) { const lc = rd1("centers", null); if (lc && lc.length) { setCenters(lc); persist("centers", lc); } }
        loadTasks();
      }
      setSt({ ready: true, locked: false, configured: true, role: j.role, error: "" });
    } catch (e) { setSt({ ready: true, locked: false, configured: true, role: "", error: e.message || "Network error" }); }
  };
  useEffect(() => { load(); }, []);
  const unlock = (p) => { setPass(p); setSt((s) => ({ ...s, ready: false })); load(); };

  return {
    ...st, params, centers, amap, mcfg, audits, tasks, setAudits, setTasks, refresh, loadTasks, unlock, reload: load,
    save,
    saveParams: (v, now) => { setParams(v); return persist("params", v, now); },
    saveCenters: (v, now) => { setCenters(v); return persist("centers", v, now); },
    saveMap: (v, now) => { setAmap(v); return persist("amap", v, now); },
    saveCfg: (v, now) => { setMcfg(v); return persist("mcfg", v, now); },
  };
}
