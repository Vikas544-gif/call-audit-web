export default function Home() {
  return (
    <div className="land">
      <h1 style={{ marginBottom: 6 }}>Sales Call Audit</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: 28 }}>Choose where you want to go.</p>
      <div className="cols">
        <a href="/audit">Audit page<br /><small className="muted" style={{ fontWeight: 500 }}>Upload calls and run audits</small></a>
        <a href="/dashboard">Dashboard<br /><small className="muted" style={{ fontWeight: 500 }}>Scores, follow-ups and settings</small></a>
      </div>
    </div>
  );
}
