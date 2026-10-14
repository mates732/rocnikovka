import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { ErrorSummary } from "../components/ErrorSummary";
import { services } from "../data/adapters";
import type { Day0EquipmentService } from "../services/interfaces";
import type { Day0Equipment } from "../types/entities";

type Day0EquipmentPageDeps = {
  day0EquipmentService: Day0EquipmentService;
};

type Day0EquipmentPageProps = { services?: Day0EquipmentPageDeps };

const CATEGORIES = ["Základní vybavení", "Materiál", "Měřicí přístroje", "Fotografování", "Ostatní"];

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
}

export function Day0EquipmentPage({ services: deps = services }: Day0EquipmentPageProps = {}) {
  const [equipment, setEquipment] = useState<Day0Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Partial<Day0Equipment>>({
    name: "",
    category: "Základní vybavení",
    quantity: 1,
    unit: "ks",
    model: undefined,
    resolution: undefined,
    verified: false,
    notes: undefined,
    is_prepopulated: false,
  });
  const [formError, setFormError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    deps.day0EquipmentService
      .list()
      .then((data) => {
        if (!cancelled) setEquipment(data);
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
      name: "",
      category: "Základní vybavení",
      quantity: 1,
      unit: "ks",
      model: undefined,
      resolution: undefined,
      verified: false,
      notes: undefined,
      is_prepopulated: false,
    });
    setEditingId(null);
    setFormError(null);
    setFormOpen(false);
  }, []);

  const handleEdit = (item: Day0Equipment) => {
    setEditingId(item.equipment_id);
    setFormValues({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      model: item.model ?? "",
      resolution: item.resolution ?? "",
      verified: item.verified,
      notes: item.notes ?? "",
      is_prepopulated: item.is_prepopulated,
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

    const now = new Date().toISOString();
    const payload: Day0Equipment = {
      equipment_id: editingId ?? generateId("EQ"),
      name: formValues.name?.trim() ?? "",
      category: formValues.category ?? "Základní vybavení",
      quantity: Number(formValues.quantity) ?? 1,
      unit: formValues.unit ?? "ks",
      model: formValues.model?.trim() ?? undefined,
      resolution: formValues.resolution?.trim() ?? undefined,
      verified: Boolean(formValues.verified),
      verified_at: formValues.verified ? now : undefined,
      verified_by: formValues.verified ? "user" : undefined,
      notes: formValues.notes?.trim() ?? undefined,
      is_prepopulated: Boolean(formValues.is_prepopulated),
      created_at: now,
      updated_at: now,
    };

    try {
      if (editingId) {
        await deps.day0EquipmentService.update(editingId, payload);
      } else {
        await deps.day0EquipmentService.create(payload);
      }
      const updated = await deps.day0EquipmentService.list();
      setEquipment(updated);
      resetForm();
    } catch (err) {
      setFormError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Opravdu chcete tuto položku smazat?")) return;
    try {
      // Note: no delete endpoint, just filter locally for now
      // In a real app, we'd add a delete endpoint
      alert("Mazání není implementováno (append-only princip). Označte jako neverified nebo upravte poznámky.");
    } catch (err) {
      setError(err);
    }
  };

  if (loading) {
    return (
      <section className="page" aria-labelledby="equip-title">
        <PageHeader eyebrow="Day 0" title="Inventář vybavení" titleId="equip-title" />
        <div className="panel"><EmptyState title="Načítání" description="Načítám inventář vybavení..." /></div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page" aria-labelledby="equip-title">
        <PageHeader eyebrow="Day 0" title="Inventář vybavení" titleId="equip-title" />
        <div className="panel">
          <p className="empty-state-title">Nelze načíst data</p>
          <ErrorSummary error={error} fallbackMessage="Nepodařilo se načíst inventář vybavení" />
        </div>
      </section>
    );
  }

  const grouped = equipment.reduce((acc, item) => {
    const cat = item.category || "Ostatní";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, Day0Equipment[]>);

  return (
    <section className="page" aria-labelledby="equip-title">
      <PageHeader
        eyebrow="Day 0"
        title="Inventář vybavení"
        description="Evidujte veškeré vybavení a materiál potřebný pro experiment. Předvyplněné položky označené jako 'předvyplněné' nejsou automaticky ověřené — potvrďte jejich přítomnost a parametry."
        titleId="equip-title"
        actions={
          <button className="btn btn-primary" onClick={handleNew}>
            Přidat položku
          </button>
        }
      />

      {formOpen && (
        <section className="panel form-panel" aria-label={editingId ? "Upravit položku" : "Nová položka"}>
          <div className="panel-heading">
            <h2>{editingId ? "Upravit položku" : "Nová položka vybavení"}</h2>
            <button className="btn btn-ghost" onClick={resetForm} aria-label="Zavřít formulář">
              Zavřít
            </button>
          </div>
          <form className="record-form" onSubmit={handleSubmit} noValidate>
            <div className="form-grid">
              <label className="form-field" htmlFor="equip-name">
                <span className="form-label">Název <span className="form-required" aria-hidden="true">*</span></span>
                <input id="equip-name" type="text" value={formValues.name ?? ""} onChange={(e) => handleChange("name", e.target.value)} required disabled={submitting} />
              </label>

              <label className="form-field" htmlFor="equip-category">
                <span className="form-label">Kategorie <span className="form-required" aria-hidden="true">*</span></span>
                <select id="equip-category" value={formValues.category ?? "Základní vybavení"} onChange={(e) => handleChange("category", e.target.value)} disabled={submitting}>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </label>

              <label className="form-field" htmlFor="equip-quantity">
                <span className="form-label">Množství <span className="form-required" aria-hidden="true">*</span></span>
                <input id="equip-quantity" type="number" min="0" step="1" value={formValues.quantity ?? 1} onChange={(e) => handleChange("quantity", Number(e.target.value))} required disabled={submitting} />
              </label>

              <label className="form-field" htmlFor="equip-unit">
                <span className="form-label">Jednotka</span>
                <input id="equip-unit" type="text" value={formValues.unit ?? "ks"} onChange={(e) => handleChange("unit", e.target.value)} disabled={submitting} />
              </label>

              <label className="form-field" htmlFor="equip-model">
                <span className="form-label">Model / popis</span>
                <input id="equip-model" type="text" value={formValues.model ?? ""} onChange={(e) => handleChange("model", e.target.value)} disabled={submitting} placeholder="Např. Mettler Toledo XPR204" />
              </label>

              <label className="form-field" htmlFor="equip-resolution">
                <span className="form-label">Přesnost / rozlišení</span>
                <input id="equip-resolution" type="text" value={formValues.resolution ?? ""} onChange={(e) => handleChange("resolution", e.target.value)} disabled={submitting} placeholder="Např. 0,1 g, 0,01 mm" />
              </label>

              <label className="form-field checkbox-field" htmlFor="equip-verified">
                <input id="equip-verified" type="checkbox" checked={Boolean(formValues.verified)} onChange={(e) => handleChange("verified", e.target.checked)} disabled={submitting} />
                <span className="form-label">Fyzicky ověřeno</span>
              </label>

              <label className="form-field checkbox-field" htmlFor="equip-prepopulated">
                <input id="equip-prepopulated" type="checkbox" checked={Boolean(formValues.is_prepopulated)} onChange={(e) => handleChange("is_prepopulated", e.target.checked)} disabled={submitting} />
                <span className="form-label">Předvyplněná položka (ze šablony)</span>
              </label>

              <label className="form-field span-2" htmlFor="equip-notes">
                <span className="form-label">Poznámky</span>
                <textarea id="equip-notes" value={formValues.notes ?? ""} onChange={(e) => handleChange("notes", e.target.value)} disabled={submitting} />
              </label>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Ukládám…" : editingId ? "Uložit změny" : "Vytvořit položku"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={resetForm} disabled={submitting}>
                Zrušit
              </button>
            </div>
            <ErrorSummary error={formError} fallbackMessage="Položku se nepodařilo uložit." />
          </form>
        </section>
      )}

      {CATEGORIES.map((category) => {
        const items = grouped[category] ?? [];
        if (items.length === 0) return null;
        return (
          <section key={category} className="panel" aria-labelledby={`cat-${category}`}>
            <div className="panel-heading">
              <h2 id={`cat-${category}`}>{category} <span className="mono-cell">({items.length})</span></h2>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Název</th>
                    <th scope="col">Množství</th>
                    <th scope="col">Model</th>
                    <th scope="col">Přesnost</th>
                    <th scope="col">Ověřeno</th>
                    <th scope="col">Předvyplněno</th>
                    <th scope="col">Poznámky</th>
                    <th scope="col">Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.equipment_id} className={item.is_prepopulated ? "prepopulated-row" : undefined}>
                      <td className="cell-specimen">
                        <strong>{item.name}</strong>
                      </td>
                      <td className="mono-cell">{item.quantity} {item.unit}</td>
                      <td>{item.model || "—"}</td>
                      <td className="mono-cell">{item.resolution || "—"}</td>
                      <td>
                        <StatusBadge status={item.verified ? "PASS" : "NOT_RUN"} />
                      </td>
                      <td>
                        {item.is_prepopulated ? (
                          <StatusBadge status="WARN" />
                        ) : (
                          <span className="status-ok">Ne</span>
                        )}
                      </td>
                      <td>{item.notes || "—"}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(item)}>Upravit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {equipment.length === 0 && (
        <div className="panel">
          <EmptyState
            title="Žádné vybavení"
            description="Evidujte vybavení potřebné pro experiment. Můžete přidat položky ručně nebo inicializovat výchozí šablonu z hlavního Day 0 dashboardu."
          >
            <button className="btn btn-primary" onClick={handleNew}>Přidat první položku</button>
          </EmptyState>
        </div>
      )}
    </section>
  );
}