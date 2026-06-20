import type { ReactNode } from "react";
import Link from "next/link";

import { DashboardNav } from "./dashboard-nav";

const navigation = [
  { href: "/", label: "Overview" },
  { href: "/sites", label: "Sites" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/campaigns/new", label: "Create Campaign" },
  { href: "/subscribers", label: "Subscribers" },
  { href: "/workflow", label: "Workflow" },
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
  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-mark" src="/logo-dark.svg" alt="Exotic Push Engine" />
          <div className="brand-copy">
            <strong>Exotic</strong>
            <span>Push Engine</span>
          </div>
        </div>

        <DashboardNav items={navigation} />
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
