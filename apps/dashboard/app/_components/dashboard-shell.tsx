"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";

import { DashboardNav, type DashboardNavSection } from "./dashboard-nav";

export const dashboardNavigationSections: DashboardNavSection[] = [
  {
    label: "Core",
    items: [
      { href: "/", label: "Overview", description: "Operational summary", icon: "overview" },
      { href: "/analytics", label: "Analytics", description: "Reporting command center", icon: "analytics" },
      { href: "/subscribers", label: "Subscribers", description: "Audience registry", icon: "subscribers" },
    ],
  },
  {
    label: "Publishing",
    items: [
      { href: "/sites", label: "Sites", description: "Exotic website registry", icon: "sites" },
      { href: "/sites/new", label: "Add Site", description: "Onboard a new origin", icon: "create" },
      { href: "/campaigns", label: "Campaigns", description: "Lifecycle and delivery", icon: "campaigns" },
      { href: "/campaigns/new", label: "Create Campaign", description: "Build a push message", icon: "create" },
    ],
  },
  {
    label: "Automation",
    items: [
      { href: "/workflow", label: "Workflow & RSS", description: "Triggers, actions, and feed automation", icon: "workflow" },
      { label: "Segments", description: "Audience targeting", status: "planned", icon: "segments" },
      { label: "Automation Rules", description: "Event-driven journeys", status: "planned", icon: "automation" },
    ],
  },
  {
    label: "Integrations",
    items: [
      { label: "Browser Push", description: "Configured per site, under Sites", status: "live", icon: "integration" },
      { label: "WordPress Plugin", description: "Bundled SDK for WP sites", status: "live", icon: "integration" },
      { label: "Magento Module", description: "Commerce integration", status: "planned", icon: "integration" },
      { label: "Service Worker + Manifest", description: "Mobile web push support", status: "planned", icon: "integration" },
    ],
  },
  {
    label: "Reporting",
    items: [
      { href: "/analytics#country-performance", label: "Country Performance", description: "Regional delivery analysis", icon: "reporting" },
      { href: "/analytics#site-performance", label: "Site Performance", description: "Cross-site comparison", icon: "reporting" },
      { href: "/analytics#time-performance", label: "Time Performance", description: "UTC hourly delivery", icon: "reporting" },
      { href: "/analytics#content-performance", label: "Content Performance", description: "Taxonomy-driven reporting", icon: "reporting" },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/login", label: "Auth", description: "Session and credential entry", icon: "auth" },
      { label: "RBAC", description: "Role-based access control", status: "planned", icon: "platform" },
      { label: "Audit Logs", description: "Security history", status: "planned", icon: "platform" },
      { label: "Monitoring", description: "Metrics and alerting", status: "planned", icon: "platform" },
      { label: "Deployment", description: "cPanel VPS runtime", status: "planned", icon: "platform" },
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
  const [collapsed, setCollapsed] = useState(false);

  const shellStyle: CSSProperties & { [key: `--${string}`]: string } = {
    "--sidebar-width": collapsed ? "96px" : "284px",
  };

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
