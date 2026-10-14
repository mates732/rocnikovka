export function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar-context">
        <p className="topbar-kicker">Experiment</p>
        <p className="topbar-title">Automated plant growth measurement</p>
      </div>
      <div className="topbar-meta">
        <span className="protocol-chip">
          <span className="protocol-chip-dot" aria-hidden="true" />
          Protocol v1 · locked
        </span>
      </div>
    </header>
  );
}
