# ADR Phase 4 - Persistence Architecture

## Status
Accepted

## Date
2026-09-03

## Context
Current app is React + TypeScript + Vite with empty adapters and no persistence.
Phase 4 requires persistent experiment data that survives browser refresh and app restart, with traceability and no fake data.

Constraints:
- Protocol v1 is LOCKED and must remain unchanged.
- RAW data must remain immutable.
- No cloud backend, no auth, no deployment.
- localStorage is not acceptable as primary experiment database.

## Decision
Use a local application backend with SQLite storage.

Architecture:
UI (React)
-> application/service layer
-> local backend API (Node)
-> SQLite database

For image ingestion:
- store immutable raw files under dedicated local storage directory managed by backend,
- store file metadata and references in SQLite.

## Rationale
- SQLite provides durable, auditable local persistence.
- Backend-controlled file handling is safer than direct browser-only storage for raw images.
- Supports transaction-like CSV import behavior and strict validation.
- Better traceability and integrity guarantees than browser-only IndexedDB for this research workflow.

## Consequences
- Add minimal backend workspace in repository.
- Add API contracts between frontend and backend.
- Add schema/migration management and repositories.
- Keep AI/CV and calibration as explicit NOT_IMPLEMENTED service boundaries.

## Rejected alternatives
1. IndexedDB-only:
- feasible for browser-local app, but weaker control for raw file ingestion and audit path.
- selected only as fallback if backend execution is blocked.

2. localStorage:
- rejected for experiment dataset due to integrity and capacity limitations.

## Compliance
- Protocol v1 unchanged.
- No experiment data fabricated.
- No methodological changes introduced.
