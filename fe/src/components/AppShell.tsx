import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { Learner } from "@voca/contract";
import { Compass, Layers, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Settings, X } from "lucide-react";
import { session, tokenStore } from "../lib/appSession";
import { loadCurrentLearner } from "../lib/signIn";
import { Avatar } from "./Avatar";
import { cx } from "./cx";
import { Wordmark } from "./Wordmark";

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

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/decks", label: "Decks", icon: Layers, exact: false },
  { to: "/app/discover", label: "Discover", icon: Compass, exact: false },
  { to: "/app/settings", label: "Settings", icon: Settings, exact: false },
] as const;

function NavLinks({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-2 py-3">
      {NAV.map(({ to, label, icon: Icon, exact }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact }}
          title={collapsed ? label : undefined}
          aria-label={collapsed ? label : undefined}
          onClick={onNavigate}
          className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-lime"
        >
          {({ isActive }) => (
            <div
              className={cx(
                "relative flex items-center py-2.5 transition-colors duration-150",
                collapsed ? "justify-center px-2" : "gap-3 px-3",
                isActive ? "rounded-xl bg-lime/10 text-white" : "rounded-xl text-stone-400 hover:bg-stone-800 hover:text-stone-100",
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-lime" aria-hidden="true" />
              )}
              <Icon className={cx("size-5 shrink-0", isActive ? "text-lime" : "text-stone-500")} aria-hidden="true" />
              {!collapsed && (
                <span className={cx("truncate text-sm", isActive ? "font-semibold" : "font-medium")}>{label}</span>
              )}
            </div>
          )}
        </Link>
      ))}
    </nav>
  );
}

function UserMenu({
  learner,
  collapsed,
  onNavigate,
}: {
  learner: Learner;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (ref.current !== null && !ref.current.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("click", closeOnOutsideClick);
    return () => document.removeEventListener("click", closeOnOutsideClick);
  }, [open]);

  return (
    <div ref={ref} className="relative border-t border-stone-800 p-3">
      {open && (
        <div
          className={cx(
            "absolute z-20 rounded-lg border border-stone-700 bg-stone-800 py-1 shadow-xl",
            collapsed ? "bottom-0 left-full ml-2 w-40" : "bottom-full left-3 right-3 mb-1",
          )}
        >
          <Link
            to="/app/settings"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-stone-200 hover:bg-stone-700"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
          >
            <Settings className="size-4 shrink-0" aria-hidden="true" />
            Settings
          </Link>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-stone-200 hover:bg-stone-700 hover:text-red-300"
            onClick={() => {
              setOpen(false);
              void session.signOut();
            }}
          >
            <LogOut className="size-4 shrink-0" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
      <button
        type="button"
        className={cx(
          "flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-stone-800",
          collapsed && "justify-center",
        )}
        onClick={() => setOpen((value) => !value)}
        title={collapsed ? learner.name : undefined}
        aria-label={collapsed ? learner.name : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Avatar name={learner.name} src={learner.avatarUrl} size="md" tone="dark" />
        {!collapsed && (
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-200">{learner.name}</span>
        )}
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [learner, setLearner] = useState<Learner | null>(null);
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

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    writeCollapsed(next);
  };

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className="min-h-screen bg-neutral-100 md:flex">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-stone-900 px-4 md:hidden">
        <button
          type="button"
          aria-label="Open menu"
          className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full bg-stone-800 text-stone-300 hover:bg-stone-700"
          onClick={() => setDrawerOpen(true)}
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <Link to="/app" activeOptions={{ exact: true }} className="rounded outline-none focus-visible:ring-2 focus-visible:ring-lime">
          <Wordmark variant="dark" className="text-xl" />
        </Link>
        {learner !== null && <Avatar name={learner.name} src={learner.avatarUrl} size="sm" tone="dark" />}
      </header>

      {drawerOpen && <div className="fixed inset-0 z-40 bg-black/60 md:hidden" aria-hidden="true" onClick={closeDrawer} />}

      <aside
        aria-label="Sidebar"
        inert={!drawerOpen}
        className={cx(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-stone-900 transition-transform duration-300 ease-in-out md:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-stone-800 px-4">
          <Wordmark variant="dark" className="text-xl" />
          <button
            type="button"
            aria-label="Close menu"
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full bg-stone-800 text-stone-300 hover:bg-stone-700"
            onClick={closeDrawer}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <NavLinks collapsed={false} onNavigate={closeDrawer} />
        {learner !== null && <UserMenu learner={learner} collapsed={false} onNavigate={closeDrawer} />}
      </aside>

      <aside
        aria-label="Sidebar"
        className={cx(
          "sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-stone-800 bg-stone-900 transition-[width] duration-200 ease-in-out md:flex",
          collapsed ? "w-16" : "w-56",
        )}
      >
        <div
          className={cx(
            "flex h-14 items-center border-b border-stone-800",
            collapsed ? "justify-center" : "justify-between px-4",
          )}
        >
          {!collapsed && (
            <Link to="/app" activeOptions={{ exact: true }} className="shrink-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-lime">
              <Wordmark variant="dark" className="text-xl" />
            </Link>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-stone-500 hover:bg-stone-800 hover:text-stone-300"
          >
            {collapsed ? <PanelLeftOpen className="size-4" aria-hidden="true" /> : <PanelLeftClose className="size-4" aria-hidden="true" />}
          </button>
        </div>
        <NavLinks collapsed={collapsed} />
        {learner !== null && <UserMenu learner={learner} collapsed={collapsed} />}
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-6 lg:p-8">{children}</main>
    </div>
  );
}
