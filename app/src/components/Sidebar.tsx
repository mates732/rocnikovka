import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";

type NavItem = { to: string; label: string; exact?: boolean };

type NavSection = { title: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    title: "Workspace",
    items: [{ to: "/", label: "Overview", exact: true }],
  },
  {
    title: "Collection",
    items: [{ to: "/plants", label: "Plants" }],
  },
  {
    title: "Day 0 Setup",
    items: [
      { to: "/experiment/day0", label: "Day 0 Overview" },
      { to: "/experiment/day0/equipment", label: "Equipment" },
      { to: "/experiment/day0/physical-config", label: "Physical Config" },
      { to: "/experiment/day0/pot-allocation", label: "Pots & Sowing" },
      { to: "/experiment/day0/methodology-decisions", label: "Methodology Decisions" },
    ],
  },
  {
    title: "Daily Records",
    items: [
      { to: "/images", label: "Images" },
      { to: "/measurements", label: "Measurements" },
      { to: "/experiment/water", label: "Water" },
      { to: "/experiment/positions", label: "Positions" },
    ],
  },
  {
    title: "Experiment",
    items: [
      { to: "/experiment/setup", label: "Setup" },
      { to: "/experiment/daily-log", label: "Daily Lab Log" },
      { to: "/experiment/verification", label: "Verification" },
      { to: "/experiment/quality", label: "Quality Control" },
      { to: "/experiment/protocol", label: "Protocol" },
    ],
  },
  {
    title: "System",
    items: [
      { to: "/analysis", label: "Analysis" },
      { to: "/validation", label: "Validation" },
      { to: "/settings", label: "Settings" },
    ],
  },
];

function BrandMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 24 24"
      width="26"
      height="26"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 21.2C12 12.6 15.2 6.2 21.5 2.5c-1.6 10.6-7.2 15.9-9.5 18.7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 21.2C12 12.6 8.8 6.2 2.5 2.5c1.6 10.6 7.2 15.9 9.5 18.7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 21.2V9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Primary navigation.
 *
 * Desktop (>1024px): persistent compact left sidebar with grouped sections.
 * Smaller screens: a compact top bar holding the brand and a "Menu" toggle;
 * activating it reveals the same grouped sections in a dropdown panel, so no
 * single horizontal row of every item ever appears.
 */
export function Sidebar() {
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !navRef.current?.contains(event.target)) {
        // Swallow the tap that dismisses the menu so it never also activates
        // whatever sits underneath the open panel.
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <nav
      ref={navRef}
      className={open ? "sidebar sidebar-open" : "sidebar"}
      aria-label="Primary navigation"
    >
      <div className="sidebar-brand">
        <BrandMark />
        <div className="sidebar-brand-copy">
          <p className="brand-name">Phytometer</p>
          <p className="brand-sub">plant growth measurement</p>
        </div>
        <button
          ref={toggleRef}
          type="button"
          className="sidebar-toggle"
          aria-expanded={open}
          aria-controls="sidebar-sections"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? (
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
              <path
                d="M3 3l10 10M13 3L3 13"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
              <path
                d="M2 4h12M2 8h12M2 12h12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          )}
          <span>{open ? "Close" : "Menu"}</span>
        </button>
      </div>

      <div id="sidebar-sections" className="sidebar-body">
        {navSections.map((section) => (
          <section key={section.title} className="sidebar-section" aria-label={section.title}>
            <h2>{section.title}</h2>
            <ul>
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.exact}
                    onClick={close}
                    className={({ isActive }) =>
                      isActive ? "nav-link nav-link-active" : "nav-link"
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="sidebar-foot">
        <p className="brand-sub">Protocol v1</p>
        <p className="brand-sub">Species · Phaseolus vulgaris</p>
      </div>
    </nav>
  );
}
