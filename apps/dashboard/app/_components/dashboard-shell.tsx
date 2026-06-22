"use client";

import { useState, useTransition, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { DashboardNav, SidebarIcon, type DashboardNavSection } from "./dashboard-nav";

export const dashboardNavigationSections: DashboardNavSection[] = [
  {
    label: "Dashboard",
    items: [
      { href: "/", label: "Overview", description: "Your at-a-glance summary", icon: "overview" },
      { href: "/analytics", label: "Analytics", description: "See how your campaigns and sites are performing", icon: "analytics" },
      { href: "/subscribers", label: "Subscribers", description: "Everyone who can receive your notifications", icon: "subscribers" },
    ],
  },
  {
    label: "Sites & Campaigns",
    items: [
      { href: "/sites", label: "Sites", description: "The websites connected to Exotic Push Engine", icon: "sites" },
      { href: "/campaigns", label: "Campaigns", description: "Create and send push notifications", icon: "campaigns" },
      { href: "/campaign-taxonomies", label: "Categories", description: "Organize campaigns by topic for reporting", icon: "campaigns" },
    ],
  },
  {
    label: "Automation",
    items: [
      { href: "/segments", label: "Audience Groups", description: "Target specific groups of subscribers", icon: "segments" },
      { href: "/automations", label: "Automations", description: "Send notifications automatically based on activity", icon: "automation" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/audit-logs", label: "Activity Log", description: "See who did what, and when", icon: "platform" },
      { href: "/platform-health", label: "System Health", description: "Check that everything is running smoothly", icon: "health" },
      { href: "/platform/backup-config", label: "Backups", description: "Manage automatic backups of your data", icon: "platform" },
    ],
  },
];

export function DashboardShell({
  title,
  eyebrow,
  description,
  actions,
  children,
}: {
  title: string;
  eyebrow: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [isLoggingOut, startLogout] = useTransition();

  const shellStyle: CSSProperties & { [key: `--${string}`]: string } = {
    "--sidebar-width": collapsed ? "96px" : "284px",
  };

  function handleLogout() {
    startLogout(() => {
      void fetch("/api/dashboard/auth/logout", { method: "POST" })
        .catch(() => undefined)
        .finally(() => {
          router.push("/login");
          router.refresh();
        });
    });
  }

  return (
    <div className={`dashboard-shell ${collapsed ? "is-collapsed" : ""}`} style={shellStyle}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <img className="brand-mark" src="/logo-icon.svg" alt="Exotic Push Engine" />
            <div className="brand-copy">
              <strong>Exotic</strong>
              <span>Push Engine</span>
            </div>
          </div>
          <button
            className="sidebar-toggle"
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            onClick={() => setCollapsed((value) => !value)}
          >
            <span className="sidebar-toggle-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" role="img" aria-hidden="true">
                <path
                  d={collapsed ? "M10 6 16 12l-6 6" : "M14 6 8 12l6 6"}
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            {!collapsed ? <span className="sidebar-toggle-label">Collapse</span> : null}
          </button>
        </div>

        <DashboardNav sections={dashboardNavigationSections} collapsed={collapsed} />

        <div className="sidebar-footer">
          <button className="nav-item nav-item--logout" type="button" onClick={handleLogout} disabled={isLoggingOut} title="Log out">
            <span className="nav-icon">
              <SidebarIcon name="logout" />
            </span>
            <div className="nav-item-copy">
              <span className="nav-item-label">{isLoggingOut ? "Logging out..." : "Log out"}</span>
            </div>
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <h1 className="page-title">{title}</h1>
            <p className="page-copy">{description}</p>
          </div>
          {actions ? <div className="actions">{actions}</div> : null}
        </div>

        {children}
      </main>
    </div>
  );
}
