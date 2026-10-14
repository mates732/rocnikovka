# App Architecture (Phase 3B.2)

## Scope
This document describes the frontend architecture implemented in Phase 3B.2.

## Layered structure
The frontend follows this boundary:

UI
-> service layer
-> data adapters
-> future data/AI integrations

### 1. UI layer (`src/pages`, `src/components`, `src/layouts`)
- Renders screens and reusable UI primitives.
- Contains no direct filesystem/data folder write logic.
- Uses semantic empty states when data is unavailable.
- Current detail routes are implemented with not-found/empty handling.

### 2. Service layer (`src/services/interfaces.ts`)
- Defines contracts for plants, images, measurements, validation, calibration, AI config, and water events.
- Isolated from concrete data source implementation.
- Protects UI from source-specific details.

### 3. Data adapters (`src/data/adapters.ts`)
- Current adapters are intentionally empty.
- Return empty arrays/null/not_available values.
- This is intentional because pilot data is not available yet.

### 4. Future AI/CV layer (planned)
- Future AI/CV processing must be integrated behind services.
- UI should never call inference/calibration engines directly.
- Any model metadata should be surfaced through `AIService`.

## Data boundaries
The project data zones are conceptually separated as:

- raw: immutable acquisition source (photos, original logs)
- processed: derived/transformed datasets
- annotations: labeling/quality metadata
- measurements: manual and AI/CV measurement records

Frontend constraints:
- Frontend must not write to `data/raw/`.
- Frontend contains no experiment fixtures or fabricated measurements.
- All records shown in UI must come through service + adapter path.

## Routing model
Implemented route groups:
- Main: `/`, `/plants`, `/images`, `/measurements`, `/analysis`, `/validation`, `/settings`
- Detail: `/plants/:plantId`, `/images/:imageId`, `/measurements/:measurementId`
- Experiment: `/experiment`, `/experiment/protocol`, `/experiment/water`, `/experiment/positions`, `/experiment/quality`

Unknown routes redirect to `/`.

## Empty-state behavior policy
Until real pilot data exists:
- no synthetic charts
- no synthetic plants/images/measurements
- no synthetic validation outputs
- explicit NOT_RUN/Not available messaging
