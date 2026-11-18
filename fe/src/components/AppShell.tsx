import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Result } from "effect";
import type { Learner } from "@voca/contract";
import { Compass, Flame, Layers, LayoutDashboard, Menu, PanelLeftClose, PanelLeftOpen, Settings, X, type LucideIcon } from "lucide-react";
import { session, tokenStore } from "../lib/appSession";
import { loadCurrentLearner } from "../lib/signIn";
import { Avatar } from "./Avatar";
import { cx } from "./cx";
import { IconButton } from "./IconButton";
import { Logo } from "./Logo";
import { navItems } from "./nav";

const COLLAPSED_KEY = "voca.sidebarCollapsed";

// Storage can be blocked (private windows, cleared site data). The sidebar then just starts expanded.
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // The choice lasts until the page reloads.
  }
}

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  decks: Layers,
  hard: Flame,
  discover: Compass,
  settings: Settings,
};

// The design's collapsed sidebar: 64px, icons only. The labels stay in the DOM for screen readers.
const COLLAPSED_NAV: CSSProperties = { justifyContent: "center", padding: 0 };
const BARE_BUTTON: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flex: 1,
  minWidth: 0,
  padding: 0,
  border: 0,
  background: "transparent",
  color: "inherit",
  textAlign: "left",
  cursor: "pointer",
};

function NavLinks({ collapsed, due, onNavigate }: { collapsed: boolean; due: number; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main">
      {navItems().map(({ to, key, label, exact }) => {
        const Icon = ICONS[key] ?? Layers;

        return (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact }}
          className="nav"
          activeProps={{ className: "on" }}
          style={collapsed ? COLLAPSED_NAV : undefined}
          title={collapsed ? label : undefined}
          onClick={onNavigate}
        >
          <Icon className="i i-lg" aria-hidden="true" />
          <span className={cx(collapsed && "sr")}>{label}</span>
          {key === "decks" && due > 0 && !collapsed && <span className="cnt">{due}</span>}
        </Link>
        );
      })}
    </nav>
  );
}

// Settings lives in the sidebar, so the account menu only holds sign-out.
function SideUser({ learner, collapsed }: { learner: Learner; collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onClick = (event: MouseEvent) => {
      if (root.current !== null && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      setOpen(false);
      trigger.current?.focus();
    };

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const popup: CSSProperties = collapsed
    ? { position: "absolute", left: "100%", bottom: 8, marginLeft: 8, zIndex: 60 }
    : { position: "absolute", left: 8, right: 8, bottom: "100%", marginBottom: 4, zIndex: 60 };

  return (
    <div ref={root} className="side-user" style={{ position: "relative", justifyContent: collapsed ? "center" : undefined }}>
      {open && (
        <div role="menu" aria-label="Account" className="menu" style={popup}>
          <button
            type="button"
            role="menuitem"
            className="bad"
            onClick={() => {
              setOpen(false);
              void session.signOut();
            }}
          >
            Sign out
          </button>
        </div>
      )}
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={collapsed ? learner.name : undefined}
        title={collapsed ? learner.name : undefined}
        style={collapsed ? { ...BARE_BUTTON, flex: "none" } : BARE_BUTTON}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar name={learner.name} src={learner.avatarUrl} tone="dark" />
        {!collapsed && (
          <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
            {learner.name}
            <small>{learner.email}</small>
          </div>
        )}
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [learner, setLearner] = useState<Learner | null>(null);
  const [due, setDue] = useState(0);
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    let active = true;

    loadCurrentLearner(session, tokenStore).then((found) => {
      if (active) setLearner(found);
    });

    return () => {
      active = false;
    };
  }, []);

  // The Decks badge is a hint: when the call fails it just stays hidden.
  useEffect(() => {
    let active = true;

    void session.call((client) => client.insight.notifications()).then((result) => {
      if (!active || !Result.isSuccess(result)) return;

      setDue(result.success.decks.reduce((sum, deck) => sum + deck.due, 0));
    });

    return () => {
      active = false;
    };
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    writeCollapsed(next);
  };

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className="app" style={{ gridTemplateColumns: collapsed ? "64px 1fr" : undefined }}>
      <aside className="side" aria-label="Sidebar">
        <div
          className="side-top"
          style={collapsed ? { flexDirection: "column", justifyContent: "center", gap: 4, height: "auto", padding: "8px 0" } : undefined}
        >
          <Link to="/app" activeOptions={{ exact: true }} aria-label="Voca home">
            <Logo tone="dark" withName={!collapsed} className="h-7" />
          </Link>
          <IconButton label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={toggleCollapsed}>
            {collapsed ? <PanelLeftOpen className="i" aria-hidden="true" /> : <PanelLeftClose className="i" aria-hidden="true" />}
          </IconButton>
        </div>
        <NavLinks collapsed={collapsed} due={due} />
        {learner !== null && <SideUser learner={learner} collapsed={collapsed} />}
      </aside>

      {drawerOpen && (
        <>
          <div
            aria-hidden="true"
            onClick={closeDrawer}
            style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(28,25,23,.5)" }}
          />
          <aside
            className="side"
            aria-label="Menu"
            style={{ display: "flex", position: "fixed", top: 0, bottom: 0, left: 0, width: 240, height: "auto", zIndex: 50 }}
          >
            <div className="side-top">
              <Logo tone="dark" className="h-7" />
              <IconButton label="Close menu" onClick={closeDrawer}>
                <X className="i" aria-hidden="true" />
              </IconButton>
            </div>
            <NavLinks collapsed={false} due={due} onNavigate={closeDrawer} />
            {learner !== null && <SideUser learner={learner} collapsed={false} />}
          </aside>
        </>
      )}

      <div style={{ minWidth: 0 }}>
        <div className="mobile-bar">
          <IconButton label="Open menu" onClick={() => setDrawerOpen(true)}>
            <Menu className="i i-lg" aria-hidden="true" />
          </IconButton>
          <Logo tone="dark" className="h-7" />
          {learner !== null ? <Avatar name={learner.name} src={learner.avatarUrl} size="sm" tone="dark" /> : <span />}
        </div>
        <main className="main">
          <div className="content">{children}</div>
        </main>
      </div>
    </div>
  );
}
