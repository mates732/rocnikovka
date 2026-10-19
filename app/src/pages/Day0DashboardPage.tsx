import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { ErrorSummary } from "../components/ErrorSummary";
import { services } from "../data/adapters";
import { apiUrl } from "../data/apiBase";
import { describeApiOrigin, hasExternalApiBase } from "../data/apiBase";
import { DAY0_PLAN, plannedPotIds, detectPotConflicts } from "../data/day0Plan";
import type { Day0EquipmentService } from "../services/interfaces";
import type { Day0Equipment, Day0PhysicalConfig, Day0PotAllocation, Day0MethodologyDecision } from "../types/entities";
type Day0DashboardDeps = {
  day0EquipmentService: Pick<Day0EquipmentService, "list">;
  plantService: {
    listPlants(): Promise<Array<{ plant_id: string; pot_id: string }>>;
  };
};

type Day0DashboardProps = { services?: Day0DashboardDeps };

const PREPOPULATED_ITEMS = [
  { name: "Květináče", category: "Základní vybavení", quantity: DAY0_PLAN.pots, unit: "ks", is_prepopulated: true },
  { name: "Podmisky", category: "Základní vybavení", quantity: DAY0_PLAN.pots, unit: "ks", is_prepopulated: true },
  { name: "Substrát (suchý)", category: "Materiál", quantity: DAY0_PLAN.totalSubstrateG, unit: "g", is_prepopulated: true },
  { name: "Semena fazole Aidagold", category: "Materiál", quantity: DAY0_PLAN.plannedSeeds, unit: "ks", is_prepopulated: true },
  { name: "Váha", category: "Měřicí přístroje", quantity: 1, unit: "ks", is_prepopulated: false },
  { name: "Pravítko", category: "Měřicí přístroje", quantity: 1, unit: "ks", is_prepopulated: false },
  { name: "Kalibrační reference (ArUco + měřítko)", category: "Měřicí přístroje", quantity: 1, unit: "ks", is_prepopulated: false },
  { name: "Kamera / telefon", category: "Fotografování", quantity: 1, unit: "ks", is_prepopulated: false },
  { name: "Stativ / opěrka kamery", category: "Fotografování", quantity: 1, unit: "ks", is_prepopulated: false },
  { name: "Osvětlení", category: "Fotografování", quantity: 1, unit: "ks", is_prepopulated: false },
  { name: "Štítky na rostliny", category: "Základní vybavení", quantity: DAY0_PLAN.pots, unit: "ks", is_prepopulated: false },
  { name: "Teploměr", category: "Měřicí přístroje", quantity: 1, unit: "ks", is_prepopulated: false },
  { name: "Hygrometr", category: "Měřicí přístroje", quantity: 1, unit: "ks", is_prepopulated: false },
];

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
}

const DEFAULT_DECISIONS = [
  {
    title: "Vzorová velikost experimentu",
    description: "Protokol v1 specifikuje 15 rostlin/skupina (45 celkem), minimálně 12/skupina (36 celkem). Praktický plán: 9 květináčů/skupina (27 celkem). Každý květináč dostane 3 semínka — květináč zůstává experimentální jednotkou, nikoli 3 nezávislé replikace. Rozhodnutí o finální vzorové velikosti musí být explicitně schváleno a zdokumentováno.",
    protocol_reference: "Protocol v1 §3, randomization_protocol.md",
    status: "unresolved" as const,
    blocks_sowing: true,
    blocks_emergence: false,
    blocks_measurements: false,
  },
  {
    title: "Specifikace kalibrační reference",
    description: "Přesné rozměry měřítka na ArUco kartě, finální pozice v rámu, materiál laminace. Určuje se během pilotu.",
    protocol_reference: "calibration_reference.md §95–99 (PILOT DECISION)",
    status: "unresolved" as const,
    blocks_sowing: false,
    blocks_emergence: false,
    blocks_measurements: true,
  },
  {
    title: "Frekvence rotace květináčů",
    description: "Týdenní vs. dvoutýdenní rotace pozic uvnitř skupin. Ovlivňuje mitigaci mikrogradientů.",
    protocol_reference: "randomization_protocol.md §96–98 (PILOT DECISION)",
    status: "unresolved" as const,
    blocks_sowing: false,
    blocks_emergence: false,
    blocks_measurements: false,
  },
  {
    title: "Prahové hodnoty kvality snímku",
    description: "Numerické prahy pro ostrost (Laplacova variance), expozici, okluzi pro automatizované PASS/WARN/FAIL.",
    protocol_reference: "image_quality_protocol.md §56–57, §69–70, §117–118 (PILOT DECISION)",
    status: "unresolved" as const,
    blocks_sowing: false,
    blocks_emergence: false,
    blocks_measurements: true,
  },
  {
    title: "Nastavení kamery a snímání",
    description: "Konkrétní zařízení, orientace, vzdálenost, úhel, osvětlení, pozadí. Musí být konzistentní po celý experiment.",
    protocol_reference: "Protocol v1 §10, §15",
    status: "unresolved" as const,
    blocks_sowing: false,
    blocks_emergence: false,
    blocks_measurements: true,
  },
  {
    title: "Výpočet výchozí a cílové hmotnosti pro zálivku",
    description: "Základní hmotnost prázdného květináče, podmisky, suchého substrátu, semínka. Metoda výpočtu cílové hmotnosti podle skupin 100/85/70.",
    protocol_reference: "Protocol v1 §6–8",
    status: "unresolved" as const,
    blocks_sowing: true,
    blocks_emergence: false,
    blocks_measurements: false,
  },
  {
    title: "Randomizační postup",
    description: "Metoda náhodného přiřazení rostlin do skupin G0/G1/G2, datum, osoba, auditovatelný záznam.",
    protocol_reference: "Protocol v1 §4, randomization_protocol.md",
    status: "unresolved" as const,
    blocks_sowing: true,
    blocks_emergence: false,
    blocks_measurements: false,
  },
  {
    title: "Zálohování dat",
    description: "Postup pravidelné zálohy SQLite databáze, redundance úložiště obrazů, test restore.",
    protocol_reference: "Protocol v1 §22",
    status: "unresolved" as const,
    blocks_sowing: false,
    blocks_emergence: false,
    blocks_measurements: false,
  },
];

export function Day0DashboardPage({ services: deps = services }: Day0DashboardProps = {}) {
  const [equipment, setEquipment] = useState<Day0Equipment[]>([]);
  const [physicalConfig, setPhysicalConfig] = useState<Day0PhysicalConfig | undefined>(undefined);
  const [potAllocation, setPotAllocation] = useState<Day0PotAllocation[]>([]);
  const [methodologyDecisions, setMethodologyDecisions] = useState<Day0MethodologyDecision[]>([]);
  const [plants, setPlants] = useState<Array<{ plant_id: string; pot_id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [eq, pc, pa, md, pl] = await Promise.all([
          deps.day0EquipmentService.list(),
          fetch(apiUrl("/api/day0/physical-config"), { credentials: "include" }).then((r) => (r.ok ? r.json() : null)).then((d) => d?.data).catch(() => undefined),
          fetch(apiUrl("/api/day0/pot-allocation"), { credentials: "include" }).then((r) => (r.ok ? r.json() : null)).then((d) => d?.data).catch(() => []),
          fetch(apiUrl("/api/day0/methodology-decisions"), { credentials: "include" }).then((r) => (r.ok ? r.json() : null)).then((d) => d?.data).catch(() => []),
          deps.plantService.listPlants().catch(() => []),
        ]);
        if (!cancelled) {
          setEquipment(eq);
          setPhysicalConfig(pc);
          setPotAllocation(pa);
          setMethodologyDecisions(md);
          setPlants(pl);
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
  }, [deps]);

  const initializeDefaults = async () => {
    // Idempotent: never re-create rows that already exist. A partial previous
    // run is tolerated — only the missing halves are created.
    const needsEquipment = equipment.length === 0;
    const needsDecisions = methodologyDecisions.length === 0;
    if (!needsEquipment && !needsDecisions) return;

    const now = new Date().toISOString().replace(/\.\d{3}Z$/, "");
    // Prepopulated items are PLANNED values, never physically verified.
    const equipmentItems = PREPOPULATED_ITEMS.map((item) => ({
      equipment_id: generateId("EQ"),
      ...item,
      model: undefined,
      resolution: undefined,
      verified: false,
      verified_at: undefined,
      verified_by: undefined,
      notes: undefined,
      is_prepopulated: true,
      created_at: now,
      updated_at: now,
    }));

    // Decisions are seeded UNRESOLVED — an initialization never approves anything.
    const decisions = DEFAULT_DECISIONS.map((d) => ({
      decision_id: generateId("DEC"),
      ...d,
      decision: undefined,
      decided_by: undefined,
      decided_at: undefined,
      notes: undefined,
      created_at: now,
      updated_at: now,
    }));

    try {
      const posts: Promise<Response>[] = [];
      if (needsEquipment) {
        for (const item of equipmentItems) {
          posts.push(
            fetch(apiUrl("/api/day0/equipment"), {
          credentials: "include",              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(item),
            })
          );
        }
      }
      if (needsDecisions) {
        for (const d of decisions) {
          posts.push(
            fetch(apiUrl("/api/day0/methodology-decisions"), {
          credentials: "include",              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(d),
            })
          );
        }
      }
      await Promise.all(posts);
      setInitialized(true);
      // Refresh
      const [eq, md] = await Promise.all([
        deps.day0EquipmentService.list(),
        fetch(apiUrl("/api/day0/methodology-decisions"), { credentials: "include" }).then((r) => r.json()).then((d) => d.data).catch(() => []),
      ]);
      setEquipment(eq);
      setMethodologyDecisions(md);
    } catch (err) {
      setError(err);
    }
  };

  if (loading) {
    return (
      <section className="page" aria-labelledby="day0-title">
        <PageHeader eyebrow="Experiment" title="Day 0 — Příprava experimentu" titleId="day0-title" />
        <div className="panel"><EmptyState title="Načítání" description="Načítám data přípravy experimentu..." /></div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page" aria-labelledby="day0-title">
        <PageHeader eyebrow="Experiment" title="Day 0 — Příprava experimentu" titleId="day0-title" />
        <div className="panel">
          <p className="empty-state-title">Nelze načíst data</p>
          <ErrorSummary error={error} fallbackMessage="Nepodařilo se načíst data přípravy experimentu" />
          <p className="form-hint">
            Požadavky směřují na: <code>{describeApiOrigin()}</code>
            {!hasExternalApiBase && " — backend není nasazen na stejné doméně, proto požadavky vrací HTTP 404."}
          </p>
        </div>
      </section>
    );
  }

  const verifiedCount = equipment.filter((e) => e.verified).length;
  const totalEquipment = equipment.length;
  const potAllocationCount = potAllocation.length;
  const decisionsCount = methodologyDecisions.length;
  const approvedDecisions = methodologyDecisions.filter((d) => d.status === "approved").length;
  const unresolvedDecisions = methodologyDecisions.filter((d) => d.status === "unresolved").length;
  const blockingSowing = methodologyDecisions.filter((d) => d.blocks_sowing && d.status !== "approved");
  const blockingMeasurements = methodologyDecisions.filter((d) => d.blocks_measurements && d.status !== "approved");

  // ---- Readiness rows: every value is computed from persisted records ----
  // Planned values never imply a completed physical action, so each row states
  // what is actually recorded and links to the page that resolves it.
  const potIds = plannedPotIds();
  const potConflicts = detectPotConflicts(
    potIds,
    plants.map((p) => p.pot_id)
  );

  const potsAllocated = potAllocationCount === DAY0_PLAN.pots;
  const perGroupComplete =
    potAllocation.filter((a) => a.group_name === "G1").length === DAY0_PLAN.groups.G1 &&
    potAllocation.filter((a) => a.group_name === "G2").length === DAY0_PLAN.groups.G2 &&
    potAllocation.filter((a) => a.group_name === "G3").length === DAY0_PLAN.groups.G3;

  const sownPots = potAllocation.filter((a) => a.sowing_status === "sown" && a.sowing_date);
  const preparedPots = potAllocation.filter((a) => a.empty_pot_mass_g != null || a.saucer_mass_g != null);
  const emergedPots = potAllocation.filter((a) => a.emergence_status === "emerged" && a.emergence_date);

  const hasAnyWaterRecord = potAllocation.some((a) => a.initial_water_ml != null);

  const plannedVolumes = physicalConfig
    ? {
        G1: physicalConfig.planned_water_ml_g1,
        G2: physicalConfig.planned_water_ml_g2,
        G3: physicalConfig.planned_water_ml_g3,
      }
    : undefined;
  const plannedVolumesComplete =
    !!plannedVolumes && plannedVolumes.G1 != null && plannedVolumes.G2 != null && plannedVolumes.G3 != null;

  type ReadinessState = "done" | "todo" | "blocked";
  type ReadinessRow = {
    id: string;
    label: string;
    detail: string;
    state: ReadinessState;
    link: string;
    linkLabel: string;
  };

  const readinessRows: ReadinessRow[] = [];

  readinessRows.push(
    equipment.length === 0
      ? {
          id: "init",
          label: "Výchozí data Day 0",
          detail: "Zatím nebyla inicializována žádná výchozí data (výbavení, rozhodnutí).",
          state: "todo",
          link: "/experiment/day0",
          linkLabel: "Inicializovat níže",
        }
      : totalEquipment === 0
      ? {
          id: "equipment",
          label: "Inventář vybavení",
          detail: "Inventář je prázdný.",
          state: "todo",
          link: "/experiment/day0/equipment",
          linkLabel: "Přidat položky",
        }
      : verifiedCount === totalEquipment
      ? {
          id: "equipment",
          label: "Inventář vybavení",
          detail: `Všech ${totalEquipment} položek fyzicky ověřeno.`,
          state: "done",
          link: "/experiment/day0/equipment",
          linkLabel: "Zkontrolovat",
        }
      : {
          id: "equipment",
          label: "Inventář vybavení",
          detail: `${verifiedCount} z ${totalEquipment} ověřeno. Předvyplněné položky zatím nejsou fyzicky potvrzeny.`,
          state: "todo",
          link: "/experiment/day0/equipment",
          linkLabel: "Potvrdit vybavení",
        }
  );

readinessRows.push(
    !physicalConfig
      ? {
          id: "config",
          label: "Fyzické nastavení",
          detail: "Konfigurace kamery, osvětlení a snímání ještě nebyla uložena.",
          state: "todo",
          link: "/experiment/day0/physical-config",
          linkLabel: "Vyplnit nastavení",
        }
      : plannedVolumesComplete
      ? {
          id: "config",
          label: "Plánovaný objem zálivky",
          detail: `Plán: G1 ${plannedVolumes?.G1} ml, G2 ${plannedVolumes?.G2} ml, G3 ${plannedVolumes?.G3} ml na květináč (jen plán).`,
          state: "done",
          link: "/experiment/day0/physical-config",
          linkLabel: "Upravit plán",
        }
      : {
          id: "config",
          label: "Plánovaný objem zálivky",
          detail: "Plánované objemy pro skupiny nejsou kompletní. Zadejte je jako plán — aplikace je nikdy nezapíše jako skutečnou zálivku.",
          state: "todo",
          link: "/experiment/day0/physical-config",
          linkLabel: "Doplňte objemy",
        }
  );

  readinessRows.push(
    potAllocationCount === 0
      ? {
          id: "pots",
          label: "Alokace 27 květináčů",
          detail: `Plán: ${DAY0_PLAN.pots} květináčů, ${DAY0_PLAN.groups.G1}/${DAY0_PLAN.groups.G2}/${DAY0_PLAN.groups.G3} na skupinu.`,
          state: "todo",
          link: "/experiment/day0/pot-allocation",
          linkLabel: "Vytvořit alokaci",
        }
      : potsAllocated && perGroupComplete
      ? {
          id: "pots",
          label: "Alokace 27 květináčů",
          detail: `${potAllocationCount} květináčů, ${DAY0_PLAN.groups.G1}/${DAY0_PLAN.groups.G2}/${DAY0_PLAN.groups.G3} na skupinu.`,
          state: "done",
          link: "/experiment/day0/pot-allocation",
          linkLabel: "Zkontrolovat",
        }
      : {
          id: "pots",
          label: "Alokace 27 květináčů",
          detail: `${potAllocationCount} z ${DAY0_PLAN.pots} květináčů; skupiny G1=${potAllocation.filter((a) => a.group_name === "G1").length}, G2=${potAllocation.filter((a) => a.group_name === "G2").length}, G3=${potAllocation.filter((a) => a.group_name === "G3").length}.`,
          state: "todo",
          link: "/experiment/day0/pot-allocation",
          linkLabel: "Dokončit alokaci",
        }
  );

  if (potConflicts.length > 0) {
    readinessRows.push({
      id: "conflict",
      label: "Konflikt POT ID",
      detail: `Květináče ${potConflicts.join(", ")} už patří existujícím rostlinám (např. PLT-001). Nebudou přepsány — vyřešte ručně, např. posunutím rozsahu nových květináčů.`,
      state: "blocked",
      link: "/experiment/day0/pot-allocation",
      linkLabel: "Vyřešit konflikt",
    });
  }

  readinessRows.push({
    id: "sowing",
    label: "Výsev",
    detail:
      sownPots.length === 0
        ? `Žádný květináč není zaznamenán jako vysetý. Plán: ${DAY0_PLAN.seedsPerPot} semena na květináč (${DAY0_PLAN.plannedSeeds} celkem).`
        : `${sownPots.length} z ${potAllocationCount} květináčů označeno jako vyseté, ${sownPots.reduce((s, a) => s + (a.seeds_sown ?? 0), 0)} semen zaznamenáno jako skutečně vysetých.`,
    state: potAllocationCount > 0 && sownPots.length === potAllocationCount ? "done" : "todo",
    link: "/experiment/day0/pot-allocation",
    linkLabel: "Zaznamenat výsev",
  });

  readinessRows.push({
    id: "emergence",
    label: "Vzejití",
    detail:
      emergedPots.length === 0
        ? "Žádná emergence nebyla zaznamenána. Datum vzejití se zapisuje ručně, nikdy neodvozuje se z data výsevu."
        : `${emergedPots.length} z ${potAllocationCount} květináčů má zaznamenané skutečné datum vzejití.`,
    state: emergedPots.length > 0 && emergedPots.length === potAllocationCount ? "done" : "todo",
    link: "/experiment/day0/pot-allocation",
    linkLabel: "Zaznamenat vzejití",
  });

  readinessRows.push({
    id: "watering",
    label: "Počáteční zálivka (pozorování)",
    detail: hasAnyWaterRecord
      ? "Počáteční zálivka byla alespoň u některého květináče zaznamenána jako pozorování."
      : "Žádné pozorování počáteční zálivky. Zaznamenává se jako pozorování (ml), nikdy jako cílová gravimetrická hmotnost.",
    state: hasAnyWaterRecord ? "done" : "todo",
    link: "/experiment/day0/pot-allocation",
    linkLabel: "Zaznamenat zálivku",
  });

  readinessRows.push({
    id: "decisions",
    label: "Metodologická rozhodnutí",
    detail:
      unresolvedDecisions === 0 && decisionsCount > 0
        ? `Všech ${decisionsCount} rozhodnutí vyřešeno.`
        : `${unresolvedDecisions} z ${decisionsCount} rozhodnutí je nevyřešeno. Neslouží k doplnění statistik — ke každému je uvedeno, zda blokuje výsev, emergenci nebo měření.`,
    state: unresolvedDecisions === 0 && decisionsCount > 0 ? "done" : blockingSowing.length > 0 ? "blocked" : "todo",
    link: "/experiment/day0/methodology-decisions",
    linkLabel: "Prohlédnout rozhodnutí",
  });

  const nextAction = readinessRows.find((r) => r.state !== "done");
  const allReady = nextAction === undefined;

  return (
    <section className="page" aria-labelledby="day0-title">
      <PageHeader
        eyebrow="Experiment"
        title="Day 0 — Příprava experimentu"
        description="Volitelný den přípravy před výsevem. Zde si zdokumentujete vybavení, nastavení, výsev a metodologická rozhodnutí. Neovlivňuje biologické experimentové dny."
        titleId="day0-title"
      />

      <section className="panel" aria-labelledby="next-action-heading">
        <div className="panel-heading">
          <h2 id="next-action-heading">Další krok</h2>
        </div>
        {allReady ? (
          <div className="day0-success">
            <StatusBadge status="PASS" />
            <strong>Příprava hotova.</strong> Můžete zahájit každodenní záznamy v Daily Lab Log.
          </div>
        ) : (
          <div className="readiness-row" data-state={nextAction.state}>
            <div className="readiness-info">
              <strong>{nextAction.label}</strong>
              <span className="readiness-detail">{nextAction.detail}</span>
            </div>
            <div className="readiness-actions">
              <StatusBadge
                status={nextAction.state === "done" ? "PASS" : nextAction.state === "blocked" ? "FAIL" : "WARN"}
              />
              <Link className="btn btn-primary btn-sm" to={nextAction.link}>
                {nextAction.linkLabel}
              </Link>
            </div>
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="overview-heading">
        <div className="panel-heading">
          <h2 id="overview-heading">Přehled připravenosti</h2>
          <p>Všechny hodnoty vycházejí z uložených záznamů. Existující záznam neznamená dokončenou akci.</p>
        </div>
        <div className="day0-overview-grid">
          <div className="overview-card">
            <div className="overview-card-title">Vybavení</div>
            <div className="overview-card-value">
              <span className="mono-cell">{verifiedCount}</span> / <span className="mono-cell">{totalEquipment}</span> ověřeno
            </div>
            <Link className="btn btn-ghost" to="/experiment/day0/equipment">Spravovat vybavení</Link>
          </div>
          <div className="overview-card">
            <div className="overview-card-title">Fyzické nastavení</div>
            <div className="overview-card-value">
              {plannedVolumesComplete
                ? `Plán ${plannedVolumes?.G0}/${plannedVolumes?.G1}/${plannedVolumes?.G2} ml`
                : physicalConfig ? "Konfigurováno" : "Nenastaveno"}
            </div>
            <Link className="btn btn-ghost" to="/experiment/day0/physical-config">Upravit nastavení</Link>
          </div>
          <div className="overview-card">
            <div className="overview-card-title">Alokace květináčů</div>
            <div className="overview-card-value">
              <span className="mono-cell">{potAllocationCount}</span> / <span className="mono-cell">{DAY0_PLAN.pots}</span> květináčů
            </div>
            <Link className="btn btn-ghost" to="/experiment/day0/pot-allocation">Spravovat alokaci</Link>
          </div>
          <div className="overview-card">
            <div className="overview-card-title">Metodologická rozhodnutí</div>
            <div className="overview-card-value">
              <span className="mono-cell">{approvedDecisions}</span> schváleno / <span className="mono-cell">{unresolvedDecisions}</span> nevyřešeno
            </div>
            <Link className="btn btn-ghost" to="/experiment/day0/methodology-decisions">Spravovat rozhodnutí</Link>
          </div>
        </div>

        <div className="readiness-list" style={{ marginTop: "var(--space-4)" }}>
          {readinessRows.map((row) => (
            <div key={row.id} className="readiness-row" data-state={row.state}>
              <div className="readiness-info">
                <strong>{row.label}</strong>
                <span className="readiness-detail">{row.detail}</span>
              </div>
              <div className="readiness-actions">
                <StatusBadge
                  status={row.state === "done" ? "PASS" : row.state === "blocked" ? "FAIL" : "WARN"}
                />
                <Link className="btn btn-ghost btn-sm" to={row.link}>
                  {row.linkLabel}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="groups-heading">
        <div className="panel-heading">
          <h2 id="groups-heading">Skupiny a plán</h2>
        </div>
        <div className="day0-overview-grid">
          {(["G0", "G1", "G2"] as const).map((group) => {
            const groupPots = potAllocation.filter((a) => a.group_name === group);
            const groupSown = groupPots.filter((a) => a.sowing_status === "sown").length;
            const groupEmerged = groupPots.filter((a) => a.emergence_status === "emerged").length;
            const planned = plannedVolumes?.[group];
            return (
              <div key={group} className="day0-group-card">
                <h3 className="day0-group-title">
                  <span className={`chip chip-group chip-group-${group}`}>{group}</span>
                </h3>
                <div className="day0-group-stats">
                  <div className="day0-stat">
                    <span>Květináčů</span>
                    <span className="day0-stat-value">
                      {groupPots.length} / {DAY0_PLAN.groups[group]}
                    </span>
                  </div>
                  <div className="day0-stat">
                    <span>Vysetých</span>
                    <span className="day0-stat-value">{groupSown}</span>
                  </div>
                  <div className="day0-stat">
                    <span>Klíčivých</span>
                    <span className="day0-stat-value">{groupEmerged}</span>
                  </div>
                  <div className="day0-stat">
                    <span>Plán zálivky</span>
                    <span className="day0-stat-value">{planned != null ? `${planned} ml` : "—"}</span>
                  </div>
                </div>
                {planned == null && (
                  <p className="day0-note">Plánovaný objem není nastaven — jde pouze o plán, nikoli o cílovou hmotnost.</p>
                )}
              </div>
            );
          })}
        </div>
        <dl className="day0-planned-volume" style={{ marginTop: "var(--space-4)" }}>
          <div>
            <strong>Plán experimentu</strong>
            <ul>
              <li>{DAY0_PLAN.pots} květináčů · {DAY0_PLAN.groups.G0}/{DAY0_PLAN.groups.G1}/{DAY0_PLAN.groups.G2} na skupinu</li>
              <li>{DAY0_PLAN.seedsPerPot} semena/květináč · {DAY0_PLAN.plannedSeeds} celkem</li>
              <li>{DAY0_PLAN.substratePerPotG} g substrátu/květináč · {DAY0_PLAN.totalSubstrateG.toLocaleString("cs-CZ")} g celkem</li>
              <li>rozlišení váhy {DAY0_PLAN.scaleResolutionG} g</li>
            </ul>
          </div>
        </dl>
        {preparedPots.length > 0 && (
          <p className="day0-note">
            Hmotnost prázdného květináče či podmisky je zadána u {preparedPots.length} květináčů.
            Přibližné hodnoty označujte jako „Přibližně" — aplikace je nikdy nedopočítává průměrem.
          </p>
        )}
      </section>

      <section className="panel" aria-labelledby="decisions-heading">
        <div className="panel-heading">
          <h2 id="decisions-heading">Rozhodnutí blokující další fázi</h2>
        </div>
        {blockingSowing.length > 0 && (
          <div className="day0-warning-block">
            <StatusBadge status="FAIL" />
            <strong>Blokuje výsev:</strong> {blockingSowing.map((d) => d.title).join(", ")}.
          </div>
        )}
        {blockingMeasurements.length > 0 && (
          <div className="day0-warning-block warn">
            <StatusBadge status="WARN" />
            <strong>Blokuje formální měření:</strong> {blockingMeasurements.map((d) => d.title).join(", ")}.
          </div>
        )}
        {blockingSowing.length === 0 && blockingMeasurements.length === 0 && (
          <p className="readiness-detail">
            Žádné nevyřešené rozhodnutí nebrání přípravě. Rozhodnutí týkající se kalibrace, kvality snímku
            a cílových hmotností je nutné vyřešit před zahájením formálního měření.
          </p>
        )}
        <div className="action-links" style={{ marginTop: "var(--space-3)" }}>
          <Link className="btn btn-ghost" to="/experiment/day0/methodology-decisions">Otevřít registr rozhodnutí</Link>
          <Link className="btn btn-ghost" to="/experiment/protocol">Uzamčený protokol v1</Link>
        </div>
      </section>

      <section className="panel" aria-labelledby="quick-actions-heading">
        <div className="panel-heading">
          <h2 id="quick-actions-heading">Rychlé akce</h2>
        </div>
        <div className="action-links">
          <Link className="btn btn-primary" to="/experiment/day0/equipment">📋 Inventář vybavení</Link>
          <Link className="btn btn-ghost" to="/experiment/day0/physical-config">🔧 Fyzické nastavení</Link>
          <Link className="btn btn-ghost" to="/experiment/day0/pot-allocation">🌱 Alokace květináčů a výsev</Link>
          <Link className="btn btn-ghost" to="/experiment/day0/methodology-decisions">📝 Metodologická rozhodnutí</Link>
          <Link className="btn btn-ghost" to="/experiment/setup">Experiment Setup</Link>
          <Link className="btn btn-ghost" to="/experiment/daily-log">Daily Lab Log</Link>
        </div>
      </section>

      {equipment.length === 0 && !initialized && (
        <section className="panel" aria-labelledby="init-heading">
          <div className="panel-heading">
            <h2 id="init-heading">První spuštění</h2>
            <p>Žádná data Day 0 nejsou inicializována. Můžete načíst předvyplněné výchozí hodnoty: 27 květináčů, 81 semínek Aidagold (3 na květináč), 1 944 g substrátu a standardní metodologická rozhodnutí.</p>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={initializeDefaults} disabled={loading}>
              Inicializovat výchozí data Day 0
            </button>
          </div>
        </section>
      )}
    </section>
  );
}