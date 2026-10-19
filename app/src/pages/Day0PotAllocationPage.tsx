import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { ErrorSummary } from "../components/ErrorSummary";
import { services } from "../data/adapters";
import { DAY0_PLAN, plannedPotIds, groupForPotNumber, detectPotConflicts, potIdFor, exemplarIdForPotNumber, treatmentPercentageForGroup } from "../data/day0Plan";
import type { Day0PotAllocationService } from "../services/interfaces";
import type { Day0PotAllocation, Group, SowingStatus, EmergenceStatus, MassBasis, ExemplarId, TreatmentPercentage } from "../types/entities";

type PotAllocationFormValues = {
  pot_id: string;
  plant_id: string;
  group_name: string;
  exemplar_id: string;
  treatment_percentage: string;
  substrate_mass_g: string;
  empty_pot_mass_g: string;
  saucer_mass_g: string;
  seed_count: string;
  seeds_sown: string;
  seedlings_emerged: string;
  plants_retained: string;
  seed_mass_g: string;
  initial_water_ml: string;
  initial_water_drained_ml: string;
  initial_assembled_mass_g: string;
  mass_basis: string;
  sowing_date: string;
  sowing_status: SowingStatus;
  emergence_status: EmergenceStatus;
  emergence_date: string;
  notes: string;
};

type Day0PotAllocationPageDeps = {
  day0PotAllocationService: Day0PotAllocationService;
  plantService: {
    listPlants(): Promise<Array<{ plant_id: string; pot_id: string }>>;
  };
};

type Day0PotAllocationPageProps = { services?: Day0PotAllocationPageDeps };

const GROUPS: Group[] = ["G1", "G2", "G3"];
const SOWING_STATUSES: SowingStatus[] = ["pending", "sown", "failed"];
const EMERGENCE_STATUSES: EmergenceStatus[] = ["not_sown", "sown", "awaiting", "emerged", "uncertain", "failed"];
const EXEMPLAR_IDS: ExemplarId[] = ["EX01", "EX02", "EX03", "EX04", "EX05", "EX06", "EX07", "EX08", "EX09"] as const;
const TREATMENT_PERCENTAGES: Record<Group, TreatmentPercentage> = { G1: 100, G2: 85, G3: 70 };

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
}

export function Day0PotAllocationPage({ services: deps = services }: Day0PotAllocationPageProps = {}) {
  const [allocations, setAllocations] = useState<Day0PotAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<PotAllocationFormValues>({
    pot_id: "",
    plant_id: "",
    group_name: "",
    exemplar_id: "",
    treatment_percentage: "",
    substrate_mass_g: "72",
    empty_pot_mass_g: "",
    saucer_mass_g: "",
    seed_count: "3",
    seeds_sown: "",
    seedlings_emerged: "",
    plants_retained: "",
    seed_mass_g: "",
    initial_water_ml: "",
    initial_water_drained_ml: "",
    initial_assembled_mass_g: "",
    mass_basis: "unknown",
    sowing_date: "",
    sowing_status: "pending",
    emergence_status: "not_sown",
    emergence_date: "",
    notes: "",
  });
  const [formError, setFormError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await deps.day0PotAllocationService.list();
      setAllocations(data);
    } catch (err) {
      setError(err);
    }
  }, [deps]);

  useEffect(() => {
    let cancelled = false;
    deps.day0PotAllocationService
      .list()
      .then((data) => {
        if (!cancelled) setAllocations(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deps]);

  const resetForm = useCallback(() => {
    setFormValues({
      pot_id: "",
      plant_id: "",
      group_name: "",
      exemplar_id: "",
      treatment_percentage: "",
      substrate_mass_g: "72",
      empty_pot_mass_g: "",
      saucer_mass_g: "",
      seed_count: "3",
      seeds_sown: "",
      seedlings_emerged: "",
      plants_retained: "",
      seed_mass_g: "",
      initial_water_ml: "",
      initial_water_drained_ml: "",
      initial_assembled_mass_g: "",
      mass_basis: "unknown",
      sowing_date: "",
      sowing_status: "pending",
      emergence_status: "not_sown",
      emergence_date: "",
      notes: "",
    });
    setEditingId(null);
    setFormError(null);
    setFormOpen(false);
  }, []);

  const handleEdit = (item: Day0PotAllocation) => {
    setEditingId(item.allocation_id);
    setFormValues({
      pot_id: item.pot_id,
      plant_id: item.plant_id ?? "",
      group_name: item.group_name ?? "",
      exemplar_id: item.exemplar_id ?? "",
      treatment_percentage: item.treatment_percentage != null ? String(item.treatment_percentage) : "",
      substrate_mass_g: String(item.substrate_mass_g),
      empty_pot_mass_g: item.empty_pot_mass_g != null ? String(item.empty_pot_mass_g) : "",
      saucer_mass_g: item.saucer_mass_g != null ? String(item.saucer_mass_g) : "",
      seed_count: String(item.seed_count),
      seeds_sown: item.seeds_sown != null ? String(item.seeds_sown) : "",
      seedlings_emerged: item.seedlings_emerged != null ? String(item.seedlings_emerged) : "",
      plants_retained: item.plants_retained != null ? String(item.plants_retained) : "",
      seed_mass_g: item.seed_mass_g != null ? String(item.seed_mass_g) : "",
      initial_water_ml: item.initial_water_ml != null ? String(item.initial_water_ml) : "",
      initial_water_drained_ml: item.initial_water_drained_ml != null ? String(item.initial_water_drained_ml) : "",
      initial_assembled_mass_g: item.initial_assembled_mass_g != null ? String(item.initial_assembled_mass_g) : "",
      mass_basis: item.mass_basis ?? "unknown",
      sowing_date: item.sowing_date ?? "",
      sowing_status: item.sowing_status,
      emergence_status: item.emergence_status,
      emergence_date: item.emergence_date ?? "",
      notes: item.notes ?? "",
    });
    setFormOpen(true);
    setFormError(null);
  };

  const handleNew = () => {
    setEditingId(null);
    resetForm();
    setFormOpen(true);
  };

  const handleChange = (field: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);

    const now = new Date().toISOString().replace(/\.\d{3}Z$/, "");
    const payload: Day0PotAllocation = {
      allocation_id: editingId ?? generateId("ALLOC"),
      pot_id: formValues.pot_id?.trim() ?? "",
      plant_id: formValues.plant_id?.trim() ?? undefined,
      group_name: (formValues.group_name as Group) || undefined,
      exemplar_id: (formValues.exemplar_id as ExemplarId) || undefined,
      treatment_percentage: formValues.treatment_percentage === "" ? undefined : Number(formValues.treatment_percentage) as TreatmentPercentage,
      substrate_mass_g: Number(formValues.substrate_mass_g) || 72,
      empty_pot_mass_g: formValues.empty_pot_mass_g.trim() === "" ? undefined : Number(formValues.empty_pot_mass_g),
      saucer_mass_g: formValues.saucer_mass_g.trim() === "" ? undefined : Number(formValues.saucer_mass_g),
      seed_count: Number(formValues.seed_count) || 3,
      seeds_sown: formValues.seeds_sown.trim() === "" ? undefined : Number(formValues.seeds_sown),
      seedlings_emerged: formValues.seedlings_emerged.trim() === "" ? undefined : Number(formValues.seedlings_emerged),
      plants_retained: formValues.plants_retained.trim() === "" ? undefined : Number(formValues.plants_retained),
      seed_mass_g: formValues.seed_mass_g.trim() === "" ? undefined : Number(formValues.seed_mass_g),
      initial_water_ml: formValues.initial_water_ml.trim() === "" ? undefined : Number(formValues.initial_water_ml),
      initial_water_drained_ml: formValues.initial_water_drained_ml.trim() === "" ? undefined : Number(formValues.initial_water_drained_ml),
      initial_assembled_mass_g: formValues.initial_assembled_mass_g.trim() === "" ? undefined : Number(formValues.initial_assembled_mass_g),
      mass_basis: (formValues.mass_basis || "unknown") as MassBasis,
      sowing_date: formValues.sowing_date?.trim() ?? undefined,
      sowing_status: (formValues.sowing_status ?? "pending") as SowingStatus,
      emergence_status: (formValues.emergence_status ?? "not_sown") as EmergenceStatus,
      emergence_date: formValues.emergence_date?.trim() ?? undefined,
      notes: formValues.notes?.trim() ?? undefined,
      created_at: now,
      updated_at: now,
    };

    try {
      if (editingId) {
        await deps.day0PotAllocationService.update(editingId, payload);
      } else {
        await deps.day0PotAllocationService.create(payload);
      }
      await refresh();
      resetForm();
    } catch (err) {
      setFormError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const bulkAllocate = async () => {
    const planText =
      `Vytvořit ${DAY0_PLAN.pots} květináčů?\n\n` +
      `G0: ${DAY0_PLAN.groups.G0} květináčů (${potIdFor(1)} až ${potIdFor(DAY0_PLAN.groups.G0)})\n` +
      `G1: ${DAY0_PLAN.groups.G1} květináčů (${potIdFor(DAY0_PLAN.groups.G0 + 1)} až ${potIdFor(DAY0_PLAN.groups.G0 + DAY0_PLAN.groups.G1)})\n` +
      `G2: ${DAY0_PLAN.groups.G2} květináčů (${potIdFor(DAY0_PLAN.groups.G0 + DAY0_PLAN.groups.G1 + 1)} až ${potIdFor(DAY0_PLAN.pots)})\n\n` +
      `Substrát: ${DAY0_PLAN.substratePerPotG} g na květináč (${DAY0_PLAN.totalSubstrateG.toLocaleString("cs-CZ")} g celkem) — pouze substrát, ne celková hmotnost\n` +
      `Plánovaných semen: ${DAY0_PLAN.seedsPerPot} na květináč (${DAY0_PLAN.plannedSeeds} celkem)\n\n` +
      `Květináč zůstává experimentální jednotkou. Vytvoří se jako „pending / not_sown" — ` +
      `datum výsevu, datum vzejití a skutečně vysetá semena se zapíšou ručně až budou známy.`;
    if (!window.confirm(planText)) return;

    // Detect existing
    try {
      const [existing, existingPlants] = await Promise.all([
        deps.day0PotAllocationService.list(),
        deps.plantService.listPlants().catch(() => []),
      ]);

      if (existing.length > 0) {
        alert(
          `Existuje ${existing.length} existujících alokací.\n\n` +
          `Abyste předešli duplicitám, ručně opravte konflikty v tabulce níže.\n` +
          `Automatická hromadná registrace není povolena při existujících záznamech.`
        );
        return;
      }

      // The planned range is POT-001..POT-027. Any pot already used by an
      // existing plant record (e.g. PLT-001 owns POT-001) is a conflict: the
      // user must resolve it manually instead of silently re-assigning.
      const potIds = plannedPotIds();
      const plantPotConflicts = detectPotConflicts(
        potIds,
        existingPlants.map((plant) => plant.pot_id)
      );
      if (plantPotConflicts.length > 0) {
        // Offer a safe, explicit resolution: keep the planned groups but move the
        // new range past the highest conflicting pot. The user must confirm the
        // new range in the confirmation dialog, and existing records are never
        // touched or re-assigned.
        const highestConflict = Math.max(
          ...existingPlants
            .filter((plant) => plantPotConflicts.includes(plant.pot_id))
            .map((plant) => Number(plant.pot_id.replace(/\D/g, "")))
        );
        const offset = highestConflict;
        const shifted = Array.from({ length: DAY0_PLAN.pots }, (_, i) => potIdFor(offset + i + 1));
        const shiftedOk = await window.confirm(
          `Konflikt s existujícími rostlinami.\n\n` +
            `Tyto květináče už patří záznamům rostlin: ${plantPotConflicts.join(", ")}.\n` +
            `Nebudou přepsány ani přeřazeny.\n\n` +
            `Bezpečné řešení: ponechat plán skupin a vytvořit 27 květináčů od ${shifted[0]} do ${shifted[shifted.length - 1]}.\n\n` +
            `• OK = vytvořit posunutý rozsah\n` +
            `• Zrušit = Nic nezapisovat a vyřešit ručně`
        );
        if (!shiftedOk) return;
        await createAllocations(shifted);
        return;
      }

      await createAllocations(potIds);
    } catch (err) {
      setError(err);
    }
  };

  /** Creates the given pot ids as pending/not_sown allocations, 72 g substrate, 3 planned seeds. */
  const createAllocations = async (potIds: string[]) => {
    try {
      const now = new Date().toISOString().replace(/\.\d{3}Z$/, "");

      const newAllocations: Day0PotAllocation[] = potIds.map((potId, i) => ({
        allocation_id: generateId("ALLOC"),
        pot_id: potId,
        group_name: groupForPotNumber(i + 1),
        exemplar_id: exemplarIdForPotNumber(i + 1),
        treatment_percentage: treatmentPercentageForGroup(groupForPotNumber(i + 1)),
        substrate_mass_g: DAY0_PLAN.substratePerPotG,
        seed_count: DAY0_PLAN.seedsPerPot,
        sowing_status: "pending",
        emergence_status: "not_sown",
        mass_basis: "unknown",
        created_at: now,
        updated_at: now,
      }));

      let created = 0;
      for (const alloc of newAllocations) {
        try {
          await deps.day0PotAllocationService.create(alloc);
          created += 1;
        } catch (err) {
          // Stop on first failure so a retry cannot silently duplicate records.
          await refresh();
          alert(
            `Hromadné vytvoření se zastavilo po ${created} květináčích kvůli chybě.\n\n` +
              `Vytvořené záznamy zůstávají. Zkuste to znovu — duplicity jsou odhalovány VALIDací.`
          );
          return;
        }
      }
      await refresh();
    } catch (err) {
      setError(err);
    }
  };

  if (loading) {
    return (
      <section className="page" aria-labelledby="pot-title">
        <PageHeader eyebrow="Day 0" title="Alokace květináčů a výsev" titleId="pot-title" />
        <div className="panel"><EmptyState title="Načítání" description="Načítám alokaci květináčů..." /></div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page" aria-labelledby="pot-title">
        <PageHeader eyebrow="Day 0" title="Alokace květináčů a výsev" titleId="pot-title" />
        <div className="panel">
          <p className="empty-state-title">Nelze načíst data</p>
          <ErrorSummary error={error} fallbackMessage="Nepodařilo se načíst alokaci květináčů" />
        </div>
      </section>
    );
  }

  const g1Count = allocations.filter((a) => a.group_name === "G1").length;
  const g2Count = allocations.filter((a) => a.group_name === "G2").length;
  const g3Count = allocations.filter((a) => a.group_name === "G3").length;
  const totalSubstrate = allocations.reduce((sum, a) => sum + (a.substrate_mass_g ?? 0), 0);
  const totalPlannedSeeds = allocations.reduce((sum, a) => sum + (a.seed_count ?? 0), 0);
  const recordedSown = allocations.filter((a) => a.seeds_sown != null);
  const totalSown = recordedSown.reduce((sum, a) => sum + (a.seeds_sown ?? 0), 0);
  const recordedEmerged = allocations.filter((a) => a.seedlings_emerged != null);
  const totalEmerged = recordedEmerged.reduce((sum, a) => sum + (a.seedlings_emerged ?? 0), 0);

  return (
    <section className="page" aria-labelledby="pot-title">
      <PageHeader
        eyebrow="Day 0"
        title="Alokace květináčů a výsev"
        description="Přehled a konfigurace všech 27 květináčů. U každého evidujte substrát, semeno, datum výsevu a stav emergence. PLT-001 a existující záznamy nejsou měněny."
        titleId="pot-title"
        actions={
          <>
            <button className="btn btn-ghost" onClick={bulkAllocate} disabled={allocations.length > 0}>
              Hromadně vytvořit 27 květináčů
            </button>
            <button className="btn btn-primary" onClick={handleNew}>
              Přidat květináč
            </button>
          </>
        }
      />

      <section className="panel" aria-labelledby="confirmation-summary">
        <div className="panel-heading">
          <h2 id="confirmation-summary">Potvrzovací souhrn</h2>
        </div>
        <dl className="metadata-grid">
          <div><dt>G1 (100%)</dt><dd>{g1Count} květináčů</dd></div>
          <div><dt>G2 (85%)</dt><dd>{g2Count} květináčů</dd></div>
          <div><dt>G3 (70%)</dt><dd>{g3Count} květináčů</dd></div>
          <div><dt>Celkem květináčů</dt><dd>{allocations.length} z {DAY0_PLAN.pots}</dd></div>
          <div><dt>Substrát na květináč</dt><dd>{DAY0_PLAN.substratePerPotG} g (pouze substrát)</dd></div>
          <div><dt>Celkový substrát</dt><dd>{totalSubstrate.toLocaleString("cs-CZ")} g (plán: {DAY0_PLAN.totalSubstrateG.toLocaleString("cs-CZ")} g)</dd></div>
          <div><dt>Plánovaných semen</dt><dd>{totalPlannedSeeds} (plán: {DAY0_PLAN.plannedSeeds}, {DAY0_PLAN.seedsPerPot} na květináč)</dd></div>
          <div><dt>Skutečně vysetá semena</dt><dd>{recordedSown.length > 0 ? totalSown : "nezadáno"}</dd></div>
          <div><dt>Vzešlé semenáčky</dt><dd>{recordedEmerged.length > 0 ? totalEmerged : "nezadáno"}</dd></div>
        </dl>
        {allocations.length === 27 && g1Count === 9 && g2Count === 9 && g3Count === 9 ? (
          <div className="day0-success">
            <StatusBadge status="PASS" />
            <strong>Alokace odpovídá plánu:</strong> 27 květináčů, 9 na skupinu.
          </div>
        ) : (
          <div className="day0-warning-block warn">
            <StatusBadge status="WARN" />
            <strong>Alokace neodpovídá plánu:</strong> potřebný stav je G1=9, G2=9, G3=9, celkem 27.
          </div>
        )}
      </section>

      {formOpen && (
        <section className="panel form-panel" aria-label={editingId ? "Upravit květináč" : "Nový květináč"}>
          <div className="panel-heading">
            <h2>{editingId ? "Upravit květináč" : "Nový květináč"}</h2>
            <button className="btn btn-ghost" onClick={resetForm} aria-label="Zavřít formulář">Zavřít</button>
          </div>
          <form className="record-form" onSubmit={handleSubmit} noValidate>
            <div className="form-grid">
              <label className="form-field" htmlFor="pot-id">
                <span className="form-label">Pot ID <span className="form-required" aria-hidden="true">*</span></span>
                <input id="pot-id" type="text" value={formValues.pot_id ?? ""} onChange={(e) => handleChange("pot_id", e.target.value)} placeholder="POT-028" required disabled={submitting} />
                <span className="form-hint">Formát POT-XXX. Každý květináč smí mít jen jednu alokaci.</span>
              </label>

              <label className="form-field" htmlFor="pot-plant-id">
                <span className="form-label">Plant ID</span>
                <input id="pot-plant-id" type="text" value={formValues.plant_id ?? ""} onChange={(e) => handleChange("plant_id", e.target.value)} placeholder="PLT-028" disabled={submitting} />
                <span className="form-hint">Formát PLT-XXX. Přidružte existující rostlinu, pokud již existuje.</span>
              </label>

              <label className="form-field" htmlFor="pot-group">
                <span className="form-label">Skupina <span className="form-required" aria-hidden="true">*</span></span>
                <select id="pot-group" value={formValues.group_name ?? ""} onChange={(e) => handleChange("group_name", e.target.value)} disabled={submitting}>
                  <option value="">Vyberte skupinu</option>
                  {GROUPS.map((g) => (
                    <option key={g} value={g}>{g} ({TREATMENT_PERCENTAGES[g]} %)</option>
                  ))}
                </select>
              </label>

              <label className="form-field" htmlFor="pot-exemplar">
                <span className="form-label">Exemplar ID</span>
                <select id="pot-exemplar" value={formValues.exemplar_id ?? ""} onChange={(e) => handleChange("exemplar_id", e.target.value)} disabled={submitting}>
                  <option value="">Vyberte exemplar</option>
                  {EXEMPLAR_IDS.map((ex) => (
                    <option key={ex} value={ex}>{ex}</option>
                  ))}
                </select>
                <span className="form-hint">EX01–EX09 within the group. Assigned automatically in bulk creation.</span>
              </label>

              <label className="form-field" htmlFor="pot-treatment">
                <span className="form-label">Treatment %</span>
                <input id="pot-treatment" type="number" min="0" max="100" step="1" value={formValues.treatment_percentage ?? ""} onChange={(e) => handleChange("treatment_percentage", e.target.value)} disabled={submitting} />
                <span className="form-hint">Treatment percentage (100, 85, 70). Stored independently from group label.</span>
              </label>

              <label className="form-field" htmlFor="pot-substrate">
                <span className="form-label">Hmotnost substrátu (g) <span className="form-required" aria-hidden="true">*</span></span>
                <input id="pot-substrate" type="number" min="0" step="1" value={formValues.substrate_mass_g ?? 72} onChange={(e) => handleChange("substrate_mass_g", e.target.value)} required disabled={submitting} />
                <span className="form-hint">POUZE suchý substrát (72 g). Není to hmotnost prázdného květináče ani celková hmotnost sestavy.</span>
              </label>

              <label className="form-field" htmlFor="pot-empty-mass">
                <span className="form-label">Hmotnost prázdného květináče (g)</span>
                <input id="pot-empty-mass" type="number" min="0" step="1" value={formValues.empty_pot_mass_g ?? ""} onChange={(e) => handleChange("empty_pot_mass_g", e.target.value)} disabled={submitting} />
                <span className="form-hint">Jen pokud byl skutečně změřen. Nevyplňuje se automaticky průměrem.</span>
              </label>

              <label className="form-field" htmlFor="pot-saucer-mass">
                <span className="form-label">Hmotnost prázdné podmisky (g)</span>
                <input id="pot-saucer-mass" type="number" min="0" step="1" value={formValues.saucer_mass_g ?? ""} onChange={(e) => handleChange("saucer_mass_g", e.target.value)} disabled={submitting} />
              </label>

              <label className="form-field" htmlFor="pot-seed-count">
                <span className="form-label">Plánovaný počet semen <span className="form-required" aria-hidden="true">*</span></span>
                <input id="pot-seed-count" type="number" min="0" step="1" value={formValues.seed_count ?? 3} onChange={(e) => handleChange("seed_count", e.target.value)} required disabled={submitting} />
                <span className="form-hint">Plán: 3 semena na květináč (81 celkem). Květináč = jedna experimentální jednotka.</span>
              </label>

              <label className="form-field" htmlFor="pot-seeds-sown">
                <span className="form-label">Skutečně vysetá semena</span>
                <input id="pot-seeds-sown" type="number" min="0" step="1" value={formValues.seeds_sown ?? ""} onChange={(e) => handleChange("seeds_sown", e.target.value)} disabled={submitting} />
                <span className="form-hint">Zadejte až po výsevu. Neplní se automaticky.</span>
              </label>

              <label className="form-field" htmlFor="pot-seedlings-emerged">
                <span className="form-label">Vzešlé semenáčky</span>
                <input id="pot-seedlings-emerged" type="number" min="0" step="1" value={formValues.seedlings_emerged ?? ""} onChange={(e) => handleChange("seedlings_emerged", e.target.value)} disabled={submitting} />
                <span className="form-hint">Zadejte až po vzejití. Nejedná se o 3 nezávislé replikace.</span>
              </label>

              <label className="form-field" htmlFor="pot-plants-retained">
                <span className="form-label">Ponechané rostliny</span>
                <input id="pot-plants-retained" type="number" min="0" step="1" value={formValues.plants_retained ?? ""} onChange={(e) => handleChange("plants_retained", e.target.value)} disabled={submitting} />
                <span className="form-hint">Po případném probírkování. Aplikace neprobírá automaticky.</span>
              </label>

              <label className="form-field" htmlFor="pot-seed-mass">
                <span className="form-label">Hmotnost semínka (g)</span>
                <input id="pot-seed-mass" type="number" min="0" step="0.001" value={formValues.seed_mass_g ?? ""} onChange={(e) => handleChange("seed_mass_g", e.target.value)} disabled={submitting} />
                <span className="form-hint">Jen pokud bylo váženo. Váha má rozlišení 1 g.</span>
              </label>

              <label className="form-field" htmlFor="pot-initial-water">
                <span className="form-label">Počáteční voda — pozorování (ml)</span>
                <input id="pot-initial-water" type="number" min="0" step="1" value={formValues.initial_water_ml ?? ""} onChange={(e) => handleChange("initial_water_ml", e.target.value)} disabled={submitting} />
                <span className="form-hint">Jen pozorování navlhčení pro klíčení. NENÍ to cílová zálivková hmotnost G0.</span>
              </label>

              <label className="form-field" htmlFor="pot-initial-water-drained">
                <span className="form-label">Vyteklá voda — pozorování (ml)</span>
                <input id="pot-initial-water-drained" type="number" min="0" step="1" value={formValues.initial_water_drained_ml ?? ""} onChange={(e) => handleChange("initial_water_drained_ml", e.target.value)} disabled={submitting} />
                <span className="form-hint">Přibližné množství, které vytéklo spodkem. Označte jako přibližné.</span>
              </label>

              <label className="form-field" htmlFor="pot-initial-assembled">
                <span className="form-label">Celková hmotnost sestavy (g)</span>
                <input id="pot-initial-assembled" type="number" min="0" step="1" value={formValues.initial_assembled_mass_g ?? ""} onChange={(e) => handleChange("initial_assembled_mass_g", e.target.value)} disabled={submitting} />
                <span className="form-hint">Květináč + substrát + voda + semena, pokud bylo změřeno. Odděleně od 72 g substrátu.</span>
              </label>

              <label className="form-field" htmlFor="pot-mass-basis">
                <span className="form-label">Typ zadaných hmotností</span>
                <select id="pot-mass-basis" value={formValues.mass_basis ?? "unknown"} onChange={(e) => handleChange("mass_basis", e.target.value)} disabled={submitting}>
                  <option value="unknown">Nezadáno</option>
                  <option value="measured">Změřeno</option>
                  <option value="approximate">Přibližně</option>
                </select>
                <span className="form-hint">Přibližné hodnoty (např. ~18 g květináč, ~5 ml odtok) označte jako „Přibližně".</span>
              </label>

              <label className="form-field" htmlFor="pot-sowing-date">
                <span className="form-label">Datum výsevu</span>
                <input id="pot-sowing-date" type="date" value={formValues.sowing_date ?? ""} onChange={(e) => handleChange("sowing_date", e.target.value)} disabled={submitting} />
                <span className="form-hint">Samostatné pole — nikdy se nezapisuje do datum vzejití.</span>
              </label>

              <label className="form-field" htmlFor="pot-sowing-status">
                <span className="form-label">Stav výsevu</span>
                <select id="pot-sowing-status" value={formValues.sowing_status ?? "pending"} onChange={(e) => handleChange("sowing_status", e.target.value)} disabled={submitting}>
                  {SOWING_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>

              <label className="form-field" htmlFor="pot-emergence-status">
                <span className="form-label">Stav emergence</span>
                <select id="pot-emergence-status" value={formValues.emergence_status ?? "not_sown"} onChange={(e) => handleChange("emergence_status", e.target.value)} disabled={submitting}>
                  {EMERGENCE_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>

              <label className="form-field" htmlFor="pot-emergence-date">
                <span className="form-label">Datum vzejití</span>
                <input id="pot-emergence-date" type="date" value={formValues.emergence_date ?? ""} onChange={(e) => handleChange("emergence_date", e.target.value)} disabled={submitting} />
                <span className="form-hint">Skutečné datum vzejití. Nikdy neodvozujte z data výsevu.</span>
              </label>

              <label className="form-field span-2" htmlFor="pot-notes">
                <span className="form-label">Poznámky</span>
                <textarea id="pot-notes" value={formValues.notes ?? ""} onChange={(e) => handleChange("notes", e.target.value)} disabled={submitting} />
              </label>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Ukládám…" : editingId ? "Uložit změny" : "Vytvořit alokaci"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={resetForm} disabled={submitting}>Zrušit</button>
            </div>
            <ErrorSummary error={formError} fallbackMessage="Alokaci se nepodařilo uložit." />
          </form>
        </section>
      )}

      <section className="panel" aria-labelledby="pot-table-heading">
        <div className="panel-heading">
          <h2 id="pot-table-heading">Tabulka květináčů ({allocations.length})</h2>
        </div>
        {allocations.length === 0 ? (
          <EmptyState
            title="Žádné alokace květináčů"
            description="Přidejte květináče ručně nebo použijte hromadné vytvoření 27 květináčů."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Pot ID</th>
                  <th scope="col">Plant ID</th>
                  <th scope="col">Skupina</th>
                  <th scope="col">Exemplar</th>
                  <th scope="col">Treatment %</th>
                  <th scope="col">Substrát (g)</th>
                  <th scope="col">Váhy (g)</th>
                  <th scope="col">Plán / vyseto</th>
                  <th scope="col">Vzešlo</th>
                  <th scope="col">Ponecháno</th>
                  <th scope="col">Datum výsevu</th>
                  <th scope="col">Stav výsevu</th>
                  <th scope="col">Emergence</th>
                  <th scope="col">Akce</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a) => {
                  const weights = [
                    a.empty_pot_mass_g != null ? `květ ${a.empty_pot_mass_g}` : null,
                    a.saucer_mass_g != null ? `pod ${a.saucer_mass_g}` : null,
                    a.seed_mass_g != null ? `sem ${a.seed_mass_g}` : null,
                    a.initial_water_ml != null ? `voda ${a.initial_water_ml}ml` : null,
                    a.initial_water_drained_ml != null ? `odtok ${a.initial_water_drained_ml}ml` : null,
                    a.initial_assembled_mass_g != null ? `sestava ${a.initial_assembled_mass_g}` : null,
                  ].filter(Boolean);
                  return (
                    <tr key={a.allocation_id}>
                      <td className="mono-cell">{a.pot_id}</td>
                      <td className="mono-cell">{a.plant_id ?? "—"}</td>
                      <td>
                        {a.group_name ? (
                          <span className={`chip chip-group chip-group-${a.group_name}`}>{a.group_name}</span>
                        ) : "—"}
                      </td>
                      <td className="mono-cell">{a.exemplar_id ?? "—"}</td>
                      <td className="mono-cell">{a.treatment_percentage ?? "—"}</td>
                      <td className="mono-cell">{a.substrate_mass_g}</td>
                      <td className="mono-cell">
                        {weights.length > 0 ? weights.join(", ") : "—"}
                        {a.mass_basis === "approximate" && <span className="approx-mark"> (přibl.)</span>}
                      </td>
                      <td className="mono-cell">
                        {a.seed_count}
                        {a.seeds_sown != null ? ` / ${a.seeds_sown}` : ""}
                      </td>
                      <td className="mono-cell">{a.seedlings_emerged ?? "—"}</td>
                      <td className="mono-cell">{a.plants_retained ?? "—"}</td>
                      <td>{a.sowing_date ?? "—"}</td>
                      <td>
                        <StatusBadge status={a.sowing_status === "pending" ? "NOT_RUN" : a.sowing_status === "failed" ? "FAIL" : "PASS"} />
                      </td>
                      <td>
                        <StatusBadge status={a.emergence_status === "emerged" ? "PASS" : a.emergence_status === "failed" ? "FAIL" : a.emergence_status === "not_sown" ? "NOT_RUN" : "WARN"} />
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(a)}>Upravit</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="action-links" style={{ marginTop: "1rem" }}>
        <Link className="btn btn-ghost" to="/experiment/day0">Zpět na Day 0 přehled</Link>
        <Link className="btn btn-ghost" to="/plants">Zaregistrovat rostlinu</Link>
      </div>
    </section>
  );
}