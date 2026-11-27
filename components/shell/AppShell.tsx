"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  BellIcon,
  CollapseIcon,
  LogoMark,
  LogoutIcon,
  MoreIcon,
  NetworkIcon,
  OverviewIcon,
  SettingsIcon,
  SwipeIcon,
  TagIcon,
  ThermometerIcon,
  VideoIcon,
} from "@/components/icons";

// The frame around every console page: a sidebar on wide screens and a bottom
// bar on phones. Pages draw their own header (DashboardNav) inside it.

const LINKS = [
  { href: "/dashboard", label: "Overview", Icon: OverviewIcon },
  { href: "/dashboard/live", label: "Live feed", Icon: VideoIcon },
  { href: "/dashboard/alerts", label: "Alerts", Icon: BellIcon },
  { href: "/dashboard/label", label: "Label", Icon: TagIcon },
  { href: "/dashboard/swipe", label: "Swipe", Icon: SwipeIcon },
  { href: "/dashboard/federated", label: "Federated", Icon: NetworkIcon },
  { href: "/dashboard/thermal", label: "Thermal", Icon: ThermometerIcon },
  { href: "/dashboard/settings", label: "Settings", Icon: SettingsIcon },
] as const;

/** The links with their own button on a phone; the rest sit under More. */
const PHONE_TABS = ["/dashboard", "/dashboard/alerts", "/dashboard/label"];

// The swipe page is a full-screen phone game with its own way back.
const BARE_PAGES = new Set(["/dashboard/swipe"]);

const BadgeContext = createContext<(count: number) => void>(() => {});

/** Lets a page put its unconfirmed alert count on the Alerts link. */
export function useAlertBadge(count: number | undefined) {
  const set = useContext(BadgeContext);
  useEffect(() => {
    set(count ?? 0);
  }, [count, set]);
}

const COLLAPSE_KEY = "argus:sidebar-collapsed";
const COLLAPSE_EVENT = "argus:sidebar";

function subscribeCollapsed(listener: () => void) {
  window.addEventListener(COLLAPSE_EVENT, listener);
  return () => window.removeEventListener(COLLAPSE_EVENT, listener);
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function toggleCollapsed() {
  try {
    localStorage.setItem(COLLAPSE_KEY, readCollapsed() ? "0" : "1");
  } catch {
    // Private window: the sidebar simply stays as it is.
  }
  window.dispatchEvent(new Event(COLLAPSE_EVENT));
}

function Badge({ count }: { count: number }) {
  return (
    <span className="min-w-5 rounded-full bg-danger px-1.5 py-0.5 text-center text-[10px] leading-none font-semibold text-white">
      {count}
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [alerts, setAlerts] = useState(0);
  // The page "More" was opened on; navigating away closes the sheet.
  const [moreOn, setMoreOn] = useState<string | null>(null);
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const moreOpen = moreOn === pathname;

  const signOut = () => logout().then(() => router.replace("/login"));

  if (BARE_PAGES.has(pathname)) {
    return <BadgeContext.Provider value={setAlerts}>{children}</BadgeContext.Provider>;
  }

  return (
    <BadgeContext.Provider value={setAlerts}>
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-background/70 py-5 backdrop-blur-xl transition-[width] duration-200 lg:flex ${
          collapsed ? "w-20" : "w-60"
        }`}
      >
        <Link
          href="/dashboard"
          className={`mb-8 flex items-center gap-3 px-6 ${collapsed ? "justify-center px-0" : ""}`}
        >
          <LogoMark width={28} height={28} className="shrink-0 text-accent" />
          {!collapsed && (
            <span className="font-mono text-lg tracking-widest text-foreground">ARGUS</span>
          )}
        </Link>

        <nav aria-label="Console" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {LINKS.map(({ href, label, Icon }) => {
            const active = pathname === href;
            const badge = href === "/dashboard/alerts" && alerts > 0;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? label : undefined}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  collapsed ? "justify-center" : ""
                } ${
                  active
                    ? "bg-surface-raised text-foreground"
                    : "text-muted hover:bg-surface-raised/60 hover:text-foreground"
                }`}
              >
                {active && (
                  <span className="absolute top-2 bottom-2 -left-3 w-0.5 rounded-full bg-accent" />
                )}
                <Icon />
                <span className={collapsed ? "sr-only" : "flex-1"}>{label}</span>
                {badge && (
                  <span className={collapsed ? "absolute top-0.5 right-1" : ""}>
                    <Badge count={alerts} />
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-3 flex flex-col gap-1 px-3">
          <button
            type="button"
            onClick={signOut}
            title={collapsed ? "Log out" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition-colors hover:bg-surface-raised/60 hover:text-foreground ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <LogoutIcon />
            <span className={collapsed ? "sr-only" : ""}>Log out</span>
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition-colors hover:bg-surface-raised/60 hover:text-foreground ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <CollapseIcon className={`transition-transform ${collapsed ? "rotate-180" : ""}`} />
            <span className={collapsed ? "sr-only" : ""}>
              {collapsed ? "Expand menu" : "Collapse"}
            </span>
          </button>
        </div>
      </aside>

      <div
        className={`flex min-w-0 flex-1 flex-col pb-24 transition-[padding] duration-200 lg:pb-0 ${
          collapsed ? "lg:pl-20" : "lg:pl-60"
        }`}
      >
        {children}
      </div>

      {/* Phone: the sheet behind "More" */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMoreOn(null)}
            className="absolute inset-0 bg-black/60"
          />
          <div className="card sheet-in absolute inset-x-3 bottom-24 flex max-h-[70dvh] flex-col gap-1 overflow-y-auto p-3">
            {LINKS.filter((link) => !PHONE_TABS.includes(link.href)).map(
              ({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOn(null)}
                  className={`flex min-h-12 items-center gap-4 rounded-xl px-4 text-base ${
                    pathname === href ? "bg-surface-raised text-foreground" : "text-muted"
                  }`}
                >
                  <Icon />
                  {label}
                </Link>
              ),
            )}
            <div className="mt-2 flex items-center justify-end border-t border-border pt-3">
              <button
                type="button"
                onClick={signOut}
                className="flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm text-muted"
              >
                <LogoutIcon />
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phone: bottom bar */}
      <nav
        aria-label="Console"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        {LINKS.filter((link) => PHONE_TABS.includes(link.href)).map(({ href, label, Icon }) => {
          const active = pathname === href && !moreOpen;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMoreOn(null)}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${
                active ? "text-foreground" : "text-muted"
              }`}
            >
              {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />}
              <Icon width={22} height={22} />
              {label}
              {href === "/dashboard/alerts" && alerts > 0 && (
                <span className="absolute top-2 left-1/2 ml-2">
                  <Badge count={alerts} />
                </span>
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOn(moreOpen ? null : pathname)}
          aria-expanded={moreOpen}
          className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${
            moreOpen || !PHONE_TABS.includes(pathname) ? "text-foreground" : "text-muted"
          }`}
        >
          <MoreIcon width={22} height={22} />
          More
        </button>
      </nav>
    </BadgeContext.Provider>
  );
}
