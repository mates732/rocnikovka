# UI Design System (Phase 3B.2)

## Design principles
- Scientific software first: utilitarian, clear, data-centric.
- Desktop analysis feel over marketing/dashboard aesthetics.
- Visual restraint: neutral surfaces, subtle borders, minimal effects.
- High information clarity before decoration.

## Typography
- Sans-serif UI stack optimized for readability.
- Clear hierarchy:
  - Page title (`h1`) for context.
  - Section title (`h2`) for functional grouping.
  - Metadata labels in uppercase micro-headings.
- Body text prioritizes legibility and contrast.

## Color system
- Neutral background and white surfaces.
- One primary accent color for interaction/focus emphasis.
- Status colors for PASS/WARN/FAIL with neutral NOT_RUN states.
- Status always includes text and symbol, not color only.

## Spacing and surfaces
- Consistent spacing tokens (`--space-*`).
- Compact radius and thin borders.
- Minimal shadows (or none for most panels).
- Dense but readable layout suitable for data work.

## Status system
Implemented statuses:
- PASS
- WARN
- FAIL
- NOT_RUN
- READY
- NOT_READY
- LOCKED

Each badge includes:
- explicit text label
- symbol marker (`OK`, `!`, `X`, `-`, `R`, `N`, `L`)

## Tables
`DataTable` behavior:
- semantic table with caption
- sticky-style readable header appearance
- hover row feedback
- horizontal overflow support
- keyboard focusable container
- explicit empty-row message

## Empty states
Empty states explain:
- that pilot data is not available yet
- that sections are not run yet
- what users can expect once data import/execution occurs

No fake rows, fake counts, fake charts, or generated records.

## Image workspace
Layout:
- Left: image viewer area
- Right: metadata/status detail panel

Metadata sections:
- Image
- Plant
- Timestamp
- Experiment day
- Quality
- Calibration
- Detection
- Measurement

If no image exists, viewer shows: "No image available."

## Accessibility
Implemented baseline checks:
- semantic `nav` and `main`
- heading hierarchy
- visible focus states
- link/button native semantics
- table captions and proper headers
- image `alt` support in image viewer
- status not represented by color alone

## Responsive behavior
- Sidebar collapses to top section on smaller widths.
- Grids convert to single-column layout for tablets/mobile.
- Data tables preserve readability via horizontal scroll.
