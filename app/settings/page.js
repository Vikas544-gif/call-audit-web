"use client";
import { useMemo, useState } from "react";
import { useStore, dl, TENURES } from "../components/data";
import { Gate, AdminNav } from "../components/ui";
import { DEFAULT_PARAMS, DEFAULT_MAND } from "../../lib/defaults";
import { parseMapping } from "../../lib/mapping";
import { norm, uniqClean } from "../../lib/filters";

const H3 = ({ children }) => <h3 style={{ marginTop: 0 }}>{children}</h3>;

export default function SettingsPage() {
  const S = useStore("full");
  const { params, centers, amap, mcfg } = S;
  const [nc, setNc] = useState(""), [bulk, setBulk] = useState(""), [order, setOrder] = useState("agent-tl"), [msg, setMsg] = useState("");
  const [na, setNa] = useState({ name: "", center: "", tl: "", oo: "", tenure: TENURES[0], email: "", tlEmail: "" });
  const parsed = useMemo(() => parseMapping(bulk, order), [bulk, order]);
  const allCenters = uniqClean([...centers, ...amap.map((a) => a.center)]);

  const addAgent = () => {
    const name = na.name.trim();
    if (!name) return;
    if (amap.some((a) => norm(a.name) === norm(name))) { alert("This agent already exists."); return; }
    const center = (na.center || centers[0] || "").trim();
    S.saveMap([...amap, { name, center, tl: na.tl.trim(), oo: na.oo.trim(), tenure: na.tenure, email: na.email.trim(), tlEmail: na.tlEmail.trim(), active: true }], true);
    setNa({ name: "", center: na.center, tl: na.tl, oo: na.oo, tenure: na.tenure, email: "", tlEmail: na.tlEmail });
  };
  const doImport = () => {
    const m = [...amap], cs = [...centers];
    let added = 0, upd = 0;
    parsed.rows.forEach((r) => {
      const i = m.findIndex((a) => norm(a.name) === norm(r.name));
      if (i >= 0) { const merged = { ...m[i] }; Object.entries(r).forEach(([k, v]) => { if (v !== "" && v != null) merged[k] = v; }); m[i] = merged; upd++; }
      else { m.push(r); added++; }
      if (r.center && !cs.some((c) => norm(c) === norm(r.center))) cs.push(r.center);
    });
    S.saveCenters(cs, true); S.saveMap(m, true);
    setBulk(""); setMsg(`Imported ${parsed.rows.length} agents: ${added} new, ${upd} updated.${parsed.skipped ? ` ${parsed.skipped} line(s) had no agent name and were skipped.` : ""}`);
  };
  const setP = (i, k, v) => S.saveParams(params.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const totW = params.reduce((x, p) => x + (Number(p.max) || 0), 0);

  return (
    <Gate S={S} title="Settings">
      <AdminNav active="/settings" S={S} sub="Settings" />
      <div className="main">
        <div className="c">
          <H3>Agent mapping (Center, Agent, TL, Active/Inactive)</H3>
          <div className="row">
            <input placeholder="Agent Name" value={na.name} onChange={(e) => setNa({ ...na, name: e.target.value })} />
            <select value={na.center} onChange={(e) => setNa({ ...na, center: e.target.value })}><option value="">Select center</option>{allCenters.map((c) => <option key={c}>{c}</option>)}</select>
            <input placeholder="TL Name" value={na.tl} onChange={(e) => setNa({ ...na, tl: e.target.value })} />
            <input placeholder="Onboarding Officer" value={na.oo} onChange={(e) => setNa({ ...na, oo: e.target.value })} />
            <select value={na.tenure} onChange={(e) => setNa({ ...na, tenure: e.target.value })}>{TENURES.map((t) => <option key={t}>{t}</option>)}</select>
            <input placeholder="Agent email" value={na.email} onChange={(e) => setNa({ ...na, email: e.target.value })} />
            <input placeholder="TL email" value={na.tlEmail} onChange={(e) => setNa({ ...na, tlEmail: e.target.value })} />
            <button onClick={addAgent}>+ Add agent</button>
          </div>
          <div className="sc"><table className="t"><thead><tr><th className="l">Agent Name</th><th>Center</th><th>TL Name</th><th>Onboarding Officer</th><th>Tenure</th><th>Agent Email</th><th>TL Email</th><th>Status</th><th></th></tr></thead><tbody>
            {amap.map((a, i) => { const up = (k, v) => S.saveMap(amap.map((x, j) => (j === i ? { ...x, [k]: v } : x))); return (
              <tr key={i}>
                <td className="l"><input value={a.name} onChange={(e) => up("name", e.target.value)} /></td>
                <td><select value={a.center || ""} onChange={(e) => up("center", e.target.value)}><option value="">-</option>{allCenters.map((c) => <option key={c}>{c}</option>)}</select></td>
                <td><input value={a.tl || ""} onChange={(e) => up("tl", e.target.value)} /></td>
                <td><input value={a.oo || ""} onChange={(e) => up("oo", e.target.value)} /></td>
                <td><select value={a.tenure || ""} onChange={(e) => up("tenure", e.target.value)}><option value="">-</option>{TENURES.map((t) => <option key={t}>{t}</option>)}</select></td>
                <td><input value={a.email || ""} onChange={(e) => up("email", e.target.value)} /></td>
                <td><input value={a.tlEmail || ""} onChange={(e) => up("tlEmail", e.target.value)} /></td>
                <td><select value={a.active !== false ? "1" : "0"} onChange={(e) => up("active", e.target.value === "1")}><option value="1">Active</option><option value="0">Inactive</option></select></td>
                <td><button className="g" onClick={() => S.saveMap(amap.filter((_, j) => j !== i), true)}>Remove</button></td>
              </tr>); })}
            {!amap.length && <tr><td colSpan={9} className="muted">No agents yet. Add one above or paste from Excel below.</td></tr>}
          </tbody></table></div>
          <div className="row"><span className="muted">{amap.length} agents</span><button className="g" disabled={!amap.length} onClick={() => dl("agent-mapping.csv", [["Center", "Agent Name", "TL Name", "Status", "Onboarding Officer", "Tenure", "Agent Email", "TL Email"], ...amap.map((a) => [a.center, a.name, a.tl, a.active !== false ? "Active" : "Inactive", a.oo, a.tenure, a.email, a.tlEmail])])}>Download mapping (Excel)</button></div>

          <h4 style={{ marginBottom: 4 }}>Paste many agents at once from Excel</h4>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Copy the rows in Excel (with the header row if you have one) and paste here. With a header row the columns are matched by their names, in any order (Center, Agent Name, TL Name, Status, Onboarding Officer, Tenure, Agent Email, TL Email). Check the preview, then press Import.</p>
          <textarea style={{ width: "100%", minHeight: 100 }} value={bulk} onChange={(e) => { setBulk(e.target.value); setMsg(""); }} placeholder={"Center\tAgent Name\tTL Name\tStatus\nThane\tRahul Sharma\tAmit Patil\tActive"} />
          {bulk.trim() && (
            <div style={{ marginTop: 8 }}>
              <div className="row">
                <span className={"tag " + (parsed.rows.length ? "on1" : "bad")}>{parsed.rows.length} agents found</span>
                <span className="muted" style={{ fontSize: 13 }}>{parsed.header ? "Header row found: columns matched by name." : "No header row found."}</span>
                {!parsed.header && <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>Column order<select value={order} onChange={(e) => setOrder(e.target.value)}><option value="agent-tl">Center, Agent, TL, Status, ...</option><option value="tl-agent">Center, TL, Agent, Status, ...</option></select></label>}
              </div>
              {parsed.rows.length > 0 && (
                <div className="sc" style={{ maxHeight: 220 }}><table className="t"><thead><tr><th className="l">Agent</th><th>Center</th><th>TL</th><th>Status</th><th>Onboarding Officer</th><th>Tenure</th><th>Agent Email</th><th>TL Email</th></tr></thead><tbody>
                  {parsed.rows.slice(0, 8).map((r, i) => <tr key={i}><td className="l"><b>{r.name}</b></td><td>{r.center || "-"}</td><td>{r.tl || "-"}</td><td>{r.active ? "Active" : "Inactive"}</td><td>{r.oo || "-"}</td><td>{r.tenure || "-"}</td><td>{r.email || "-"}</td><td>{r.tlEmail || "-"}</td></tr>)}
                  {parsed.rows.length > 8 && <tr><td colSpan={8} className="muted">... and {parsed.rows.length - 8} more</td></tr>}
                </tbody></table></div>
              )}
              <div className="row"><button onClick={doImport} disabled={!parsed.rows.length}>Import {parsed.rows.length || ""} agents</button><button className="g" onClick={() => { setBulk(""); setMsg(""); }}>Clear</button></div>
            </div>
          )}
          {msg && <p style={{ color: "var(--good)", fontWeight: 700 }}>{msg}</p>}
        </div>

        <div className="c">
          <H3>Centers</H3>
          <div className="row">{centers.map((c) => <span key={c} className="tag on1" style={{ padding: "5px 10px" }}>{c} <a style={{ cursor: "pointer", marginLeft: 6 }} onClick={() => S.saveCenters(centers.filter((x) => x !== c), true)}>✕</a></span>)}</div>
          <div className="row"><input placeholder="New center (e.g. Andheri)" value={nc} onChange={(e) => setNc(e.target.value)} /><button onClick={() => { const v = nc.trim(); if (v && !centers.some((c) => norm(c) === norm(v))) S.saveCenters([...centers, v], true); setNc(""); }}>+ Add center</button></div>
        </div>

        <div className="c">
          <H3>Scoring parameters and who owns them</H3>
          <p className="muted" style={{ marginTop: 0 }}>Weightage is the share of the parameter in the total score. The question tells the AI what to look for. <b>Owner</b> decides who gets the follow-up when the parameter is weak: the Trainer gets a training request, the TL gets a coaching request. The system checks this automatically on every audit.</p>
          <div className="sc"><table className="t"><thead><tr><th className="l">Parameter</th><th>Weightage</th><th>Owner</th><th className="l">What the AI looks for (the question)</th><th></th></tr></thead><tbody>
            {params.map((p, i) => (
              <tr key={i}>
                <td className="l" style={{ minWidth: 200 }}><input value={p.label} onChange={(e) => setP(i, "label", e.target.value.toUpperCase())} /></td>
                <td style={{ width: 90 }}><input type="number" min="1" max="100" value={p.max} onChange={(e) => setP(i, "max", Math.max(1, Number(e.target.value) || 1))} /></td>
                <td style={{ width: 120 }}><select value={p.owner === "Trainer" ? "Trainer" : "TL"} onChange={(e) => setP(i, "owner", e.target.value)}><option value="Trainer">Trainer</option><option value="TL">TL</option></select></td>
                <td className="l" style={{ minWidth: 320 }}><input value={p.q || ""} onChange={(e) => setP(i, "q", e.target.value)} /></td>
                <td><button className="g" onClick={() => S.saveParams(params.filter((_, j) => j !== i), true)}>Remove</button></td>
              </tr>))}
          </tbody></table></div>
          <div className="row"><button onClick={() => S.saveParams([...params, { label: "NEW PARAMETER", max: 5, owner: "TL", q: "" }], true)}>+ Add parameter</button><button className="g" onClick={() => S.saveParams(DEFAULT_PARAMS, true)}>Reset to default</button><span className="muted">Total weightage: <b style={{ color: totW === 100 ? "var(--good)" : "var(--warn)" }}>{totW}</b>{totW !== 100 ? " (scores are shown as % of this total, so it does not have to be 100)" : ""}</span></div>
        </div>

        <div className="c">
          <H3>Call recordings</H3>
          <p className="muted" style={{ marginTop: 0 }}>The uploaded recording is kept so you can play the call any time you open an audited call. After the days below it is deleted by itself. Set 0 to delete the recording right after the script is made (the call can then not be played later). Recordings use storage in Vercel Blob, so a long time on many calls costs a little more.</p>
          <div className="fg">
            <label>Keep recordings for (days)<input type="number" min="0" max="730" value={mcfg.keepDays == null ? 90 : mcfg.keepDays} onChange={(e) => S.saveCfg({ ...mcfg, keepDays: Math.min(730, Math.max(0, Number(e.target.value) || 0)) })} /></label>
          </div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>Only new audits are affected. Customer voice is personal data: check your company policy and consent before you keep recordings.</p>
        </div>

        <div className="c">
          <H3>Late opening (call delay) rule</H3>
          <p className="muted" style={{ marginTop: 0 }}>The customer picks up and says hello. If the agent starts speaking later than the allowed seconds, the score of the opening parameter goes down automatically, and a "delayed opening" mistake is added. The delay is measured from the call script times.</p>
          <div className="row"><label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={mcfg.delayOn !== false} onChange={(e) => S.saveCfg({ ...mcfg, delayOn: e.target.checked }, true)} /> Reduce the opening score when the call opens late</label></div>
          <div className="fg">
            <label>Allowed delay (seconds)<input type="number" min="1" max="120" value={mcfg.delaySec == null ? 10 : mcfg.delaySec} onChange={(e) => S.saveCfg({ ...mcfg, delaySec: Math.max(1, Number(e.target.value) || 10) })} /></label>
            <label>Score taken off (% of the opening weightage)<input type="number" min="1" max="100" value={mcfg.delayPct == null ? 40 : mcfg.delayPct} onChange={(e) => S.saveCfg({ ...mcfg, delayPct: Math.min(100, Math.max(1, Number(e.target.value) || 40)) })} /></label>
            <label>Opening parameter<select value={mcfg.delayParam || "INTRODUCTION"} onChange={(e) => S.saveCfg({ ...mcfg, delayParam: e.target.value }, true)}>{params.map((p) => <option key={p.label}>{p.label}</option>)}</select></label>
          </div>
        </div>

        <div className="c">
          <H3>Mandatory statements</H3>
          <p className="muted" style={{ marginTop: 0 }}>One per line. Each one is checked yes / partial / no on every call.</p>
          <textarea style={{ width: "100%", minHeight: 150, fontFamily: "ui-monospace,monospace", fontSize: 13 }} value={mcfg.mand} onChange={(e) => S.saveCfg({ ...mcfg, mand: e.target.value })} />
          <div className="row"><button className="g" onClick={() => S.saveCfg({ ...mcfg, mand: DEFAULT_MAND }, true)}>Reset to default</button></div>
        </div>

        <div className="c">
          <H3>Scoring calibration</H3>
          <p className="muted" style={{ marginTop: 0 }}>Make the AI scorer more lenient (+) or stricter (-). The shift is added to every parameter score as a % of that parameter's weightage, so the total moves by about the same number of points. Only new audits are affected.</p>
          <div className="row" style={{ flexWrap: "nowrap" }}><span className="muted">Stricter</span><input type="range" min="-20" max="20" step="1" value={mcfg.calib || 0} onChange={(e) => S.saveCfg({ ...mcfg, calib: Number(e.target.value) })} /><span className="muted">More lenient</span><b style={{ minWidth: 40, textAlign: "right" }}>{(mcfg.calib || 0) > 0 ? "+" : ""}{mcfg.calib || 0}</b></div>
        </div>

        <div className="c">
          <H3>Email and follow-ups</H3>
          <p className="muted" style={{ marginTop: 0 }}>After each audit the agent gets the feedback email (TL and CC in copy). If a parameter is weak, its owner gets a follow-up email with a form: the Trainer for Trainer-owned parameters, the TL for the rest.</p>
          <div className="row"><label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={!!mcfg.auto} onChange={(e) => S.saveCfg({ ...mcfg, auto: e.target.checked }, true)} /> Send emails automatically after each audit</label></div>
          <div className="fg">
            <label>Trainer email(s), comma separated<input value={mcfg.trainer} onChange={(e) => S.saveCfg({ ...mcfg, trainer: e.target.value })} /></label>
            <label>CC email(s), e.g. manager<input value={mcfg.cc} onChange={(e) => S.saveCfg({ ...mcfg, cc: e.target.value })} /></label>
            <label>A parameter is weak when below (%)<input type="number" min="1" max="100" value={mcfg.weakPct} onChange={(e) => S.saveCfg({ ...mcfg, weakPct: Number(e.target.value) || 60 })} /></label>
          </div>
          <H3>Training loop emails</H3>
          <p className="muted" style={{ marginTop: 0 }}>When the Trainer or TL marks a follow-up done, the agent gets an acknowledgement link by email. Draft: the QA inbox gets a ready-to-send draft and a person clicks send. Auto: it goes to the agent by itself.</p>
          <div className="fg">
            <label>Mode<select value={mcfg.ackMode} onChange={(e) => S.saveCfg({ ...mcfg, ackMode: e.target.value }, true)}><option value="draft">Draft for QA to send</option><option value="auto">Send automatically to the agent</option><option value="off">Off</option></select></label>
            <label>QA email (gets the drafts)<input value={mcfg.qa} onChange={(e) => S.saveCfg({ ...mcfg, qa: e.target.value })} /></label>
          </div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>Needs MAIL_USER and MAIL_PASS (Gmail app password), or RESEND_API_KEY, in the Vercel environment variables.</p>
        </div>
      </div>
    </Gate>
  );
}
