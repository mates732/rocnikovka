import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { ErrorSummary } from "../components/ErrorSummary";
import { services } from "../data/adapters";
import { apiUrl } from "../data/apiBase";
import { DAY0_PLAN } from "../data/day0Plan";
import type { Day0PhysicalConfigService } from "../services/interfaces";
import type { Day0PhysicalConfig } from "../types/entities";

type Day0PhysicalConfigPageDeps = {
  day0PhysicalConfigService: Day0PhysicalConfigService;
};

type Day0PhysicalConfigPageProps = { services?: Day0PhysicalConfigPageDeps };

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
}

export function Day0PhysicalConfigPage({ services: deps = services }: Day0PhysicalConfigPageProps = {}) {
  const [config, setConfig] = useState<Day0PhysicalConfig | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [formValues, setFormValues] = useState<Partial<Day0PhysicalConfig>>({
    camera_device: "",
    camera_orientation: "",
    lighting_config: "",
    background: "",
    image_resolution: "",
    image_format: "",
    capture_procedure: "",
    calibration_ref_dimensions: "",
    calibration_ref_placement: "",
    pot_positioning: "",
    rotation_procedure: "",
    environmental_observations: "",
    additional_notes: "",
    pot_material: "",
  });
  const [distanceStr, setDistanceStr] = useState<string>("");
  const [angleStr, setAngleStr] = useState<string>("");
  const [potDiameterStr, setPotDiameterStr] = useState<string>("");
  const [potHeightStr, setPotHeightStr] = useState<string>("");
  const [potVolumeStr, setPotVolumeStr] = useState<string>("");
  const [plannedWater, setPlannedWater] = useState<{ G0: string; G1: string; G2: string }>({
    G0: "",
    G1: "",
    G2: "",
  });
  const [formError, setFormError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/day0/physical-config"), { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setConfig(data.data);
        } else {
          if (!cancelled) setConfig(undefined);
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

  const handleChange = (field: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const loadConfigIntoForm = (cfg: Day0PhysicalConfig) => {
    setFormValues({
      camera_device: cfg.camera_device ?? "",
      camera_orientation: cfg.camera_orientation ?? "",
      lighting_config: cfg.lighting_config ?? "",
      background: cfg.background ?? "",
      image_resolution: cfg.image_resolution ?? "",
      image_format: cfg.image_format ?? "",
      capture_procedure: cfg.capture_procedure ?? "",
      calibration_ref_dimensions: cfg.calibration_ref_dimensions ?? "",
      calibration_ref_placement: cfg.calibration_ref_placement ?? "",
      pot_positioning: cfg.pot_positioning ?? "",
      rotation_procedure: cfg.rotation_procedure ?? "",
      environmental_observations: cfg.environmental_observations ?? "",
      additional_notes: cfg.additional_notes ?? "",
      pot_material: cfg.pot_material ?? "",
    });
    setDistanceStr(cfg.camera_distance_cm != null ? String(cfg.camera_distance_cm) : "");
    setAngleStr(cfg.camera_angle_deg != null ? String(cfg.camera_angle_deg) : "");
    setPotDiameterStr(cfg.pot_diameter_cm != null ? String(cfg.pot_diameter_cm) : "");
    setPotHeightStr(cfg.pot_height_cm != null ? String(cfg.pot_height_cm) : "");
    setPotVolumeStr(cfg.pot_volume_l != null ? String(cfg.pot_volume_l) : "");
    setPlannedWater({
      G0: cfg.planned_water_ml_g0 != null ? String(cfg.planned_water_ml_g0) : "",
      G1: cfg.planned_water_ml_g1 != null ? String(cfg.planned_water_ml_g1) : "",
      G2: cfg.planned_water_ml_g2 != null ? String(cfg.planned_water_ml_g2) : "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);
    setSaved(false);

    const now = new Date().toISOString();
    const payload: Partial<Day0PhysicalConfig> = {
      camera_device: formValues.camera_device?.trim() || undefined,
      camera_orientation: formValues.camera_orientation?.trim() || undefined,
      camera_distance_cm: distanceStr.trim() === "" ? undefined : Number(distanceStr),
      camera_angle_deg: angleStr.trim() === "" ? undefined : Number(angleStr),
      // PLANNED volumes only — never an actual watering event, never a target mass.
      planned_water_ml_g0: plannedWater.G0.trim() === "" ? undefined : Number(plannedWater.G0),
      planned_water_ml_g1: plannedWater.G1.trim() === "" ? undefined : Number(plannedWater.G1),
      planned_water_ml_g2: plannedWater.G2.trim() === "" ? undefined : Number(plannedWater.G2),
      lighting_config: formValues.lighting_config?.trim() || undefined,
      background: formValues.background?.trim() || undefined,
      image_resolution: formValues.image_resolution?.trim() || undefined,
      image_format: formValues.image_format?.trim() || undefined,
      capture_procedure: formValues.capture_procedure?.trim() || undefined,
      calibration_ref_dimensions: formValues.calibration_ref_dimensions?.trim() || undefined,
      calibration_ref_placement: formValues.calibration_ref_placement?.trim() || undefined,
      pot_positioning: formValues.pot_positioning?.trim() || undefined,
      rotation_procedure: formValues.rotation_procedure?.trim() || undefined,
      environmental_observations: formValues.environmental_observations?.trim() || undefined,
      additional_notes: formValues.additional_notes?.trim() || undefined,
      pot_material: formValues.pot_material?.trim() || undefined,
      pot_diameter_cm: potDiameterStr.trim() === "" ? undefined : Number(potDiameterStr),
      pot_height_cm: potHeightStr.trim() === "" ? undefined : Number(potHeightStr),
      pot_volume_l: potVolumeStr.trim() === "" ? undefined : Number(potVolumeStr),
      pot_dimensions_basis: (formValues.pot_dimensions_basis || undefined) as Day0PhysicalConfig["pot_dimensions_basis"],
      updated_at: now,
    };

    try {
      if (config) {
        await deps.day0PhysicalConfigService.update(payload);
      } else {
        await deps.day0PhysicalConfigService.create({
          config_id: generateId("CFG"),
          ...payload,
          created_at: now,
        } as Day0PhysicalConfig);
      }
      // Refresh
      const res = await fetch(apiUrl("/api/day0/physical-config"), { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.data);
        loadConfigIntoForm(data.data);
        setSaved(true);
      }
    } catch (err) {
      setFormError(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="page" aria-labelledby="phys-title">
        <PageHeader eyebrow="Day 0" title="Fyzické nastavení experimentu" titleId="phys-title" />
        <div className="panel"><EmptyState title="Načítání" description="Načítám fyzické nastavení..." /></div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page" aria-labelledby="phys-title">
        <PageHeader eyebrow="Day 0" title="Fyzické nastavení experimentu" titleId="phys-title" />
        <div className="panel">
          <p className="empty-state-title">Nelze načíst data</p>
          <ErrorSummary error={error} fallbackMessage="Nepodařilo se načíst fyzické nastavení" />
        </div>
      </section>
    );
  }

  if (config && !saved) {
    loadConfigIntoForm(config);
  }

  const filledFields =
    Object.values(formValues).filter((v) => v !== "" && v !== undefined).length +
    (distanceStr.trim() !== "" ? 1 : 0) +
    (angleStr.trim() !== "" ? 1 : 0) +
    Object.values(plannedWater).filter((v) => v.trim() !== "").length;
  const totalFields = Object.keys(formValues).length + 2 + Object.keys(plannedWater).length;

  return (
    <section className="page" aria-labelledby="phys-title">
      <PageHeader
        eyebrow="Day 0"
        title="Fyzické nastavení experimentu"
        description="Dokumentujte přesnou konfiguraci kamery, osvětlení, kalibrace, pozic květináčů a rotace. Tato nastavení musí zůstat konzistentní po celou dobu experimentu."
        titleId="phys-title"
      />

      <section className="panel" aria-labelledby="progress-heading">
        <div className="panel-heading">
          <h2 id="progress-heading">Výplněnost: {filledFields} / {totalFields} polí</h2>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${Math.round((filledFields / totalFields) * 100)}%` }} />
        </div>
      </section>

      <form className="panel record-form" onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <label className="form-field" htmlFor="cfg-camera-device">
            <span className="form-label">Kamera / zařízení</span>
            <input id="cfg-camera-device" type="text" value={formValues.camera_device ?? ""} onChange={(e) => handleChange("camera_device", e.target.value)} placeholder="Např. iPhone 15 Pro, Canon EOS R5, Logitech C920" />
            <span className="form-hint">Přesné označení zařízení včetně modelu a firmware verze pokud je známo.</span>
          </label>

          <label className="form-field" htmlFor="cfg-camera-orientation">
            <span className="form-label">Orientace kamery</span>
            <input id="cfg-camera-orientation" type="text" value={formValues.camera_orientation ?? ""} onChange={(e) => handleChange("camera_orientation", e.target.value)} placeholder="Např. landscape, portrait, natočeno 90° CW" />
          </label>

          <label className="form-field" htmlFor="cfg-camera-distance">
            <span className="form-label">Vzdálenost kamery (cm)</span>
            <input id="cfg-camera-distance" type="number" min="0" step="0.1" value={distanceStr} onChange={(e) => setDistanceStr(e.target.value)} placeholder="Např. 50" />
            <span className="form-hint">Vzdálenost od senzoru kamery k přední rovině květináče.</span>
          </label>

          <label className="form-field" htmlFor="cfg-camera-angle">
            <span className="form-label">Úhel kamery (stupně)</span>
            <input id="cfg-camera-angle" type="number" min="0" max="360" step="0.1" value={angleStr} onChange={(e) => setAngleStr(e.target.value)} placeholder="Např. 0 (přímo z boku), -15 (šikmo shora)" />
            <span className="form-hint">Úhel natočení kamery vůči vertikále. 0 = přímo z boku.</span>
          </label>

          <label className="form-field span-2" htmlFor="cfg-lighting">
            <span className="form-label">Konfigurace osvětlení</span>
            <textarea id="cfg-lighting" value={formValues.lighting_config ?? ""} onChange={(e) => handleChange("lighting_config", e.target.value)} placeholder="Popis světelného zdroje, barvná teplota, intensita, difuzory, denní čas snímání..." rows={3} />
          </label>

          <label className="form-field" htmlFor="cfg-background">
            <span className="form-label">Pozadí</span>
            <input id="cfg-background" type="text" value={formValues.background ?? ""} onChange={(e) => handleChange("background", e.target.value)} placeholder="Např. neutrální šedá karta, bílá stěna, chromakey" />
          </label>

          <label className="form-field" htmlFor="cfg-image-resolution">
            <span className="form-label">Rozlišení obrazu</span>
            <input id="cfg-image-resolution" type="text" value={formValues.image_resolution ?? ""} onChange={(e) => handleChange("image_resolution", e.target.value)} placeholder="Např. 4032×3024, 1920×1080" />
          </label>

          <label className="form-field" htmlFor="cfg-image-format">
            <span className="form-label">Formát obrazu</span>
            <input id="cfg-image-format" type="text" value={formValues.image_format ?? ""} onChange={(e) => handleChange("image_format", e.target.value)} placeholder="Např. JPEG, HEIC, RAW DNG" />
          </label>

          <label className="form-field span-2" htmlFor="cfg-capture-procedure">
            <span className="form-label">Postup snímání</span>
            <textarea id="cfg-capture-procedure" value={formValues.capture_procedure ?? ""} onChange={(e) => handleChange("capture_procedure", e.target.value)} placeholder="Krok za krokem: 1. Zapnout osvětlení, 2. Nastavit bílou rovnováhu, 3. Umístit kalibrační kartu, 4. Nasměrovat kameru, 5. Pořídit snímek..." rows={4} />
          </label>

          <label className="form-field span-2" htmlFor="cfg-calibration-dimensions">
            <span className="form-label">Rozměry kalibrační reference</span>
            <textarea id="cfg-calibration-dimensions" value={formValues.calibration_ref_dimensions ?? ""} onChange={(e) => handleChange("calibration_ref_dimensions", e.target.value)} placeholder="Přesné rozměry měřítka na ArUco kartě (např. 100 mm mezi centry ArUco markerů, šířka čárek 2 mm)..." rows={2} />
            <span className="form-hint">PILOT DECISION — viz calibration_reference.md §95–99. Do pilotu nebude nastaveno.</span>
          </label>

          <label className="form-field span-2" htmlFor="cfg-calibration-placement">
            <span className="form-label">Umístění kalibrační reference</span>
            <textarea id="cfg-calibration-placement" value={formValues.calibration_ref_placement ?? ""} onChange={(e) => handleChange("calibration_ref_placement", e.target.value)} placeholder="Kde v ráme se kalibrační karta nachází (roh, u stonku, u vrcholu rostliny) a jak je orientována..." rows={2} />
          </label>

          <label className="form-field span-2" htmlFor="cfg-pot-positioning">
            <span className="form-label">Pozicování květináčů</span>
            <textarea id="cfg-pot-positioning" value={formValues.pot_positioning ?? ""} onChange={(e) => handleChange("pot_positioning", e.target.value)} placeholder="Jak jsou květináče uspořádány v poli kamery (mřížka, řady, odsazení, orientace štítků)..." rows={2} />
          </label>

          <label className="form-field span-2" htmlFor="cfg-rotation-procedure">
            <span className="form-label">Postup rotace</span>
            <textarea id="cfg-rotation-procedure" value={formValues.rotation_procedure ?? ""} onChange={(e) => handleChange("rotation_procedure", e.target.value)} placeholder="Popis rotace: frekvence (týdenně/14 dní), směr (po směru hodin), kdo provádí, jak se eviduje..." rows={2} />
            <span className="form-hint">PILOT DECISION — viz randomization_protocol.md §96–98.</span>
          </label>

          <label className="form-field span-2" htmlFor="cfg-environmental">
            <span className="form-label">Environmenální pozorování</span>
            <textarea id="cfg-environmental" value={formValues.environmental_observations ?? ""} onChange={(e) => handleChange("environmental_observations", e.target.value)} placeholder="Teplota, vlhkost, větrání, přirozené světlo, jiné vlivy..." rows={2} />
          </label>

          <div className="form-field-group span-2" role="group" aria-labelledby="planned-water-heading">
            <span className="form-label" id="planned-water-heading">Plánovaný objem zálivky na květináč (ml)</span>
            <div className="form-grid planned-water-grid">
              {(["G0", "G1", "G2"] as const).map((group) => (
                <label className="form-field" key={group} htmlFor={`cfg-planned-water-${group}`}>
                  <span className="form-label">
                    {group} <span className="form-required" aria-hidden="true">*</span>
                  </span>
                  <input
                    id={`cfg-planned-water-${group}`}
                    type="number"
                    min="0"
                    step="1"
                    value={plannedWater[group]}
                    onChange={(e) => {
                      setPlannedWater((prev) => ({ ...prev, [group]: e.target.value }));
                      setSaved(false);
                    }}
                    placeholder={String(DAY0_PLAN.plannedWaterMlPerPot[group])}
                    disabled={submitting}
                  />
                  <span className="form-hint">
                    Plán: {DAY0_PLAN.plannedWaterMlPerPot[group]} ml. Jen plán — nesmí se zapisovat jako skutečná zálivka.
                  </span>
                </label>
              ))}
            </div>
            <p className="form-hint">
              Tyto hodnoty jsou pouze PLÁN. Aplikace je nikdy nezapíše jako skutečnou zálivku, nikdy z nich
              nevypočte cílovou gravimetrickou hmotnost a nikdy je nevynásobí procenty skupin.
              Skutečnou zálivku zaznamenávejte strání Zálivka. Gravimetrický základ zůstává otevřeným
              metodologickým rozhodnutím do ověření proti uzamčenému protokolu.
            </p>
          </div>

          <div className="form-field-group span-2" role="group" aria-labelledby="pot-dims-heading">
            <span className="form-label" id="pot-dims-heading">Fyzické parametry květináče (řízené proměnné)</span>
            <div className="form-grid">
              <label className="form-field" htmlFor="cfg-pot-material">
                <span className="form-label">Materiál</span>
                <input
                  id="cfg-pot-material"
                  type="text"
                  value={formValues.pot_material ?? ""}
                  onChange={(e) => handleChange("pot_material", e.target.value)}
                  placeholder="plast"
                  disabled={submitting}
                />
              </label>

              <label className="form-field" htmlFor="cfg-pot-diameter">
                <span className="form-label">Průměr (cm)</span>
                <input
                  id="cfg-pot-diameter"
                  type="number"
                  min="0"
                  step="0.1"
                  value={potDiameterStr}
                  onChange={(e) => { setPotDiameterStr(e.target.value); setSaved(false); }}
                  disabled={submitting}
                />
              </label>

              <label className="form-field" htmlFor="cfg-pot-height">
                <span className="form-label">Výška (cm)</span>
                <input
                  id="cfg-pot-height"
                  type="number"
                  min="0"
                  step="0.1"
                  value={potHeightStr}
                  onChange={(e) => { setPotHeightStr(e.target.value); setSaved(false); }}
                  disabled={submitting}
                />
              </label>

              <label className="form-field" htmlFor="cfg-pot-volume">
                <span className="form-label">Objem (l)</span>
                <input
                  id="cfg-pot-volume"
                  type="number"
                  min="0"
                  step="0.01"
                  value={potVolumeStr}
                  onChange={(e) => { setPotVolumeStr(e.target.value); setSaved(false); }}
                  disabled={submitting}
                />
              </label>

              <label className="form-field span-2" htmlFor="cfg-pot-basis">
                <span className="form-label">Odak jsou tyto údaje?</span>
                <select
                  id="cfg-pot-basis"
                  value={formValues.pot_dimensions_basis ?? "unknown"}
                  onChange={(e) => { handleChange("pot_dimensions_basis", e.target.value); setSaved(false); }}
                  disabled={submitting}
                >
                  <option value="unknown">Nezadáno</option>
                  <option value="measured">Změřeno mnou</option>
                  <option value="manufacturer">Údaj výrobce / přibližný</option>
                </select>
                <span className="form-hint">
                  Rozdíl je důležitý: hodnota „Změřeno" je důkaz, „přibližný" jen orientační.
                  Pole nechte prázdná, pokud hodnotu neznáte — nedoplňuje se automaticky.
                </span>
              </label>
            </div>
          </div>

          <label className="form-field span-2" htmlFor="cfg-additional-notes">
            <span className="form-label">Další poznámky</span>
            <textarea id="cfg-additional-notes" value={formValues.additional_notes ?? ""} onChange={(e) => handleChange("additional_notes", e.target.value)} rows={2} />
          </label>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Ukládám…" : config ? "Uložit změny" : "Vytvořit nastavení"}
          </button>
          {saved && <span className="form-success">Uloženo ✓</span>}
        </div>
        <ErrorSummary error={formError} fallbackMessage="Nastavení se nepodařilo uložit." />
      </form>

      {!config && (
        <div className="panel">
          <EmptyState
            title="Fyzické nastavení ještě nebylo vytvořeno"
            description="Vyplňte formulář výše a uložte ho. Toto nastavení by mělo zůstat neměnné po celou dobu experimentu."
          />
        </div>
      )}
    </section>
  );
}