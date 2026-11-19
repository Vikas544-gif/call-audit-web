import { Logo } from "./components/ui";

export default function Home() {
  const pages = [
    ["/dashboard", "Dashboard", "Scores and charts by center, team leader and agent"],
    ["/calls", "Audited calls", "Every call with its customer, mistakes and script"],
    ["/mistakes", "AI Mistakes", "What the AI found wrong, even outside the parameters"],
    ["/followups", "Follow-ups", "What the Trainer and the team leaders have to do"],
    ["/settings", "Settings", "Agents, parameters, owners and emails"],
  ];
  return (
    <div className="land">
      <div className="lb"><Logo />Sales Call Audit</div>
      <h1>Audit sales calls and send each fix to the right person</h1>
      <p className="lead">Upload a recording to get the score, the mistakes and the call script. Weak parameters go to the Trainer or the team leader who owns them.</p>
      <a className="go" href="/audit"><b>Run audits</b><span>Upload calls and see the result in a few minutes</span></a>
      <h2>Review results (admin password)</h2>
      <ul>{pages.map(([h, n, d]) => <li key={h}><a href={h}><b>{n}</b><span>{d}</span></a></li>)}</ul>
    </div>
  );
}
