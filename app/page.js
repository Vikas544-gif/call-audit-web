export default function Home() {
  return (
    <div className="land">
      <h1 style={{ marginBottom: 6 }}>Sales Call Audit</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: 28 }}>Choose where you want to go.</p>
      <div className="cols">
        <a href="/audit">Audit page<br /><small className="muted" style={{ fontWeight: 500 }}>Upload calls and run audits</small></a>
        <a href="/dashboard">Dashboard<br /><small className="muted" style={{ fontWeight: 500 }}>Scores and charts (admin)</small></a>
        <a href="/calls">Audited calls<br /><small className="muted" style={{ fontWeight: 500 }}>Each call and agent (admin)</small></a>
        <a href="/mistakes">AI Mistakes<br /><small className="muted" style={{ fontWeight: 500 }}>What the AI found wrong (admin)</small></a>
        <a href="/followups">Follow-ups<br /><small className="muted" style={{ fontWeight: 500 }}>Trainer and TL actions (admin)</small></a>
        <a href="/settings">Settings<br /><small className="muted" style={{ fontWeight: 500 }}>Agents, parameters, emails (admin)</small></a>
      </div>
    </div>
  );
}
