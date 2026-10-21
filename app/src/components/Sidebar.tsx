import { useEffect, useRef, useState } from "react";
import { Link, useLocation, NavLink } from "react-router-dom";
import logoWordmark from "/logo-wordmark.svg";
import logoIcon from "/logo-icon.svg";

type NavItem = { to: string; label: string; exact?: boolean };
type NavSection = { title: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    title: "Přehled",
    items: [{ to: "/", label: "Dashboard", exact: true }],
  },
  {
    title: "Focení",
    items: [{ to: "/capture", label: "Rychlé focení" }],
  },
  {
    title: "Deník",
    items: [{ to: "/diary", label: "Experiment Diary" }],
  },
  {
    title: "Rostliny",
    items: [
      { to: "/plants", label: "Specimen Register" },
      { to: "/plants/g1", label: "G1 (100%)" },
      { to: "/plants/g2", label: "G2 (85%)" },
      { to: "/plants/g3", label: "G3 (70%)" },
    ],
  },
];

function BrandMark({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      className={`brand-mark ${className}`}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M32 58 C32 46 20 34 20 22 C20 10 30 2 32 2 C34 2 44 10 44 22 C44 34 32 46 32 58 Z"
        fill="currentColor"
      />
      <path
        d="M32 18 C30 14 28 10 30 6 C32 2 34 6 32 10 C30 14 32 18 32 18 Z"
        fill="#7A8F6B"
      />
      <path
        d="M32 10 L32 4"
        stroke="#26401F"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M32 8 Q36 6 38 10 Q36 14 32 12 Z"
        fill="#7A8F6B"
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`brand-wordmark ${className}`}
      viewBox="0 0 320 64"
      width="170"
      height="34"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="wordmark-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1E2E22" />
          <stop offset="100%" stopColor="#26401F" />
        </linearGradient>
      </defs>
      <text
        x="160"
        y="46"
        fontFamily="Space Grotesk, Avenir Next, Helvetica Neue, Arial, sans-serif"
        fontSize="52"
        fontWeight="600"
        letterSpacing="0.02em"
        textAnchor="middle"
        fill="url(#wordmark-gradient)"
      >
        PHYTOMETER
      </text>
      <g transform="translate(112, 10)">
        <path
          d="M0 0 Q8 -8 16 0 Q8 8 0 0 Z"
          fill="#365C3A"
          transform="scale(0.6) translate(2, 4)"
        />
        <path
          d="M8 0 L8 12"
          stroke="#365C3A"
          strokeWidth="1.5"
          strokeLinecap="round"
          transform="scale(0.6) translate(2, 4)"
        />
      </g>
    </svg>
  );
}

/**
 * Primary navigation.
 *
 * Desktop (>1024px): persistent compact left sidebar with 4 sections.
 * Mobile: top bar with brand + hamburger; opens dropdown with same 4 sections.
 */
export function Sidebar() {
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const location = useLocation();

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

  // Close mobile menu on navigation
  useEffect(() => {
    if (open) close();
  }, [location.pathname]);

  return (
    <nav
      ref={navRef}
      className={open ? "sidebar sidebar-open" : "sidebar"}
      aria-label="Primary navigation"
    >
      <div className="sidebar-brand">
        <Link to="/" className="brand-link" aria-label="PHYTOMETER — Home" onClick={close}>
          <BrandMark size={28} />
          <div className="sidebar-brand-copy">
            <Wordmark className="brand-wordmark-sidebar" />
            <p className="brand-sub">plant growth measurement</p>
          </div>
        </Link>
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
              <path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
              <path d="M2 4h12M2 8h12M2 12h12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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