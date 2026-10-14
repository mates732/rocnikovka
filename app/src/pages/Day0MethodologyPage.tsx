import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { ErrorSummary } from "../components/ErrorSummary";
import { services } from "../data/adapters";
import { apiUrl } from "../data/apiBase";
import type { Day0MethodologyDecisionService } from "../services/interfaces";
import type { Day0MethodologyDecision, DecisionStatus } from "../types/entities";

type Day0MethodologyPageDeps = {
  day0MethodologyDecisionService: Day0MethodologyDecisionService;
};

type Day0MethodologyPageProps = { services?: Day0MethodologyPageDeps };

export function Day0MethodologyPage({ services: deps = services }: Day0MethodologyPageProps = {}) {
  const [decisions, setDecisions] = useState<Day0MethodologyDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/day0/methodology-decisions"));
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setDecisions(data.data);
        }
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const blockingSowing = decisions.filter((d) => d.blocks_sowing && d.status !== "approved" && d.status !== "not_applicable");
  const blockingEmergence = decisions.filter((d) => d.blocks_emergence && d.status !== "approved" && d.status !== "not_applicable");
  const blockingMeasurements = decisions.filter((d) => d.blocks_measurements && d.status !== "approved" && d.status !== "not_applicable");

  if (loading) {
    return (
      <section className="page" aria-labelledby="dec-title">
        <PageHeader eyebrow="Day 0" title="Metodologická rozhodnutí" titleId="dec-title" />
        <div className="panel"><EmptyState title="Načítání" description="Načítám metodologická rozhodnutí..." /></div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page" aria-labelledby="dec-title">
        <PageHeader eyebrow="Day 0" title="Metodologická rozhodnutí" titleId="dec-title" />
        <div className="panel">
          <p className="empty-state-title">Nelze načíst data</p>
          <ErrorSummary error={error} fallbackMessage="Nepodařilo se načíst metodologická rozhodnutí" />
        </div>
      </section>
    );
  }

  return (
    <section className="page" aria-labelledby="dec-title">
      <PageHeader
        eyebrow="Day 0"
        title="Metodologická rozhodnutí"
        description="Pracovní registr nerozhodnutých bodů protokolu. Nemanipulujte s původním Protokolem v1 — tyto záznamy doplňují provozní detaily a sledují změnu rozsahu na 27 květináčů. Rozhodnutí NIKDY neoznačujte jako schválená, pokud nejsou."
        titleId="dec-title"
      />

      <section className="panel" aria-labelledby="blocking-heading">
        <div className="panel-heading">
          <h2 id="blocking-heading">Stav blokování</h2>
        </div>
        <dl className="metadata-grid">
          <div><dt>Blokuje výsev</dt><dd><StatusBadge status={blockingSowing.length === 0 ? "PASS" : "FAIL"} /></dd></div>
          <div><dt>Blokuje emergenci</dt><dd><StatusBadge status={blockingEmergence.length === 0 ? "PASS" : "WARN"} /></dd></div>
          <div><dt>Blokuje měření</dt><dd><StatusBadge status={blockingMeasurements.length === 0 ? "PASS" : "WARN"} /></dd></div>
        </dl>
        {blockingSowing.length > 0 && (
          <p className="form-hint" style={{ marginTop: "0.75rem" }}>
            Nevyřešená rozhodnutí blokující výsev: {blockingSowing.map((d) => d.title).join(", ")}.
          </p>
        )}
      </section>

      <section className="panel" aria-labelledby="register-heading">
        <div className="panel-heading">
          <h2 id="register-heading">Register rozhodnutí</h2>
        </div>
        {decisions.length === 0 ? (
          <EmptyState
            title="Žádná metodologická rozhodnutí"
            description="Inicializujte Day 0 z hlavního dashboardu pro naplnění výchozích rozhodnutí."
          />
        ) : (
          <div className="decision-cards">
            {decisions.map((d) => (
              <article key={d.decision_id} className={`decision-card decision-${d.status}`}>
                <header className="decision-header">
                  <h3>{d.title}</h3>
                  <StatusBadge status={d.status === "approved" ? "PASS" : d.status === "rejected" ? "FAIL" : d.status === "not_applicable" ? "NOT_RUN" : d.status === "proposed" ? "WARN" : "NOT_RUN"} />
                </header>
                <p className="decision-description">{d.description}</p>
                {d.protocol_reference && (
                  <p className="decision-ref"><code>{d.protocol_reference}</code></p>
                )}
                <footer className="decision-blocks">
                  {d.blocks_sowing && <span className="block-badge">blokuje výsev</span>}
                  {d.blocks_emergence && <span className="block-badge">blokuje emergenci</span>}
                  {d.blocks_measurements && <span className="block-badge">blokuje měření</span>}
                  {!d.blocks_sowing && !d.blocks_emergence && !d.blocks_measurements && (
                    <span className="block-badge block-neutral">neblokuje</span>
                  )}
                </footer>
                {d.decision && <p className="decision-notes">Rozhodnutí: {d.decision}</p>}
                {d.decided_by && (
                  <p className="decision-meta">
                    Rozhodl(a): {d.decided_by} {d.decided_at ? `dne ${d.decided_at}` : ""}
                  </p>
                )}
                {d.notes && <p className="decision-meta">{d.notes}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="action-links" style={{ marginTop: "1rem" }}>
        <Link className="btn btn-ghost" to="/experiment/day0">Zpět na Day 0 přehled</Link>
        <Link className="btn btn-ghost" to="/experiment/protocol">Zobrazit uzamčený protocol</Link>
      </div>
    </section>
  );
}