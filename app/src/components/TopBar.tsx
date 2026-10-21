import { Link, useLocation } from "react-router-dom";
import { Wordmark } from "./Sidebar";

export function TopBar() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <Link to="/" className="topbar-brand-link" aria-label="PHYTOMETER — Home">
          <Wordmark className="topbar-wordmark" />
        </Link>
      </div>
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