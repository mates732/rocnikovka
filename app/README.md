# Frontend Workspace (Phase 3B.2)

## Purpose
This workspace contains the initial UI scaffold for a scientific/laboratory tool used in the project:
"Automatizovane mereni rustu rostlin pomoci umele inteligence a pocitacoveho videni".

Current goal is functional UI/UX foundation with explicit empty-state behavior until real pilot data is available.

## Stack
- React
- TypeScript
- Vite
- React Router

## Development setup
```bash
cd app
npm install
npm run dev
```

Build:
```bash
npm run build
```

Typecheck:
```bash
npm run typecheck
```

## Folder structure
- `src/main.tsx`: application entry point.
- `src/App.tsx`: route registration.
- `src/layouts/`: app shell (`Sidebar`, `TopBar`, `Main content`).
- `src/components/`: reusable UI primitives (status, tables, detail panel, image viewer).
- `src/pages/`: implemented route pages with empty/not-run states.
- `src/styles/`: design tokens and global styles.
- `src/types/`: schema-aligned TypeScript interfaces.
- `src/services/`: service interfaces and `NOT IMPLEMENTED` adapters.
- `src/data/`: current empty adapters preserving service boundary.

Additional docs:
- `architecture.md`: layered architecture and data boundaries.
- `ui_design.md`: visual system and accessibility baseline.

## Routes
- `/` Overview
- `/plants`
- `/plants/:plantId`
- `/images`
- `/images/:imageId`
- `/measurements`
- `/measurements/:measurementId`
- `/analysis`
- `/validation`
- `/experiment`
- `/experiment/protocol`
- `/experiment/water`
- `/experiment/positions`
- `/experiment/quality`
- `/settings`

Main routes and detail routes are implemented as functional shells.
When entities are missing, pages render explicit not-found/empty states.

## Design philosophy
- Scientific research software feel.
- Calm, utilitarian, data-oriented UI.
- No gradients, no glassmorphism, no decorative AI visuals.
- Minimal status-driven visual language.

## Data boundary
- Frontend does not modify `data/raw/`.
- Services are interface-first and currently `NOT IMPLEMENTED`.
- No fake API responses and no fake experiment data.

## Current implementation status
- Functional route structure complete.
- Reusable scientific UI component set complete.
- Empty adapters active (no fake data).
- Types and service contracts aligned with schemas.
- Build/typecheck verified in workspace.
