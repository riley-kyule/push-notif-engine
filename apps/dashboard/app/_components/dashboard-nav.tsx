"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type DashboardNavIcon =
  | "overview"
  | "analytics"
  | "subscribers"
  | "sites"
  | "campaigns"
  | "create"
  | "workflow"
  | "rss"
  | "segments"
  | "automation"
  | "integration"
  | "reporting"
  | "platform"
  | "health"
  | "auth"
  | "logout"
  | "planned";

export interface DashboardNavItem {
  href?: string;
  label: string;
  description?: string;
  status?: "live" | "planned";
  icon: DashboardNavIcon;
}

export interface DashboardNavSection {
  label: string;
  items: DashboardNavItem[];
}

export function SidebarIcon({ name }: { name: DashboardNavIcon }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true,
  } as const;

  switch (name) {
    case "overview":
      return (
        <svg {...common}>
          <path d="M4 12.5 12 4l8 8.5V20H4v-7.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M9 20v-6h6v6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    case "analytics":
      return (
        <svg {...common}>
          <path d="M5 19.5V5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M5 19.5h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M8 15.5 11 11l3 2.5 4-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "subscribers":
      return (
        <svg {...common}>
          <circle cx="12" cy="8.5" r="3.2" stroke="currentColor" strokeWidth="1.7" />
          <path d="M6.5 19.5a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "sites":
      return (
        <svg {...common}>
          <path d="M4.5 8.5 12 4l7.5 4.5v11H4.5v-11Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M9 19.5v-6h6v6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    case "campaigns":
      return (
        <svg {...common}>
          <path d="M4.5 6.5h15v11h-15z" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8 10h8M8 13h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "create":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "workflow":
      return (
        <svg {...common}>
          <path d="M6 7.5h5a3 3 0 0 1 3 3v0a3 3 0 0 0 3 3h1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M6 16.5h5a3 3 0 0 0 3-3v0a3 3 0 0 1 3-3h1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="5" cy="7.5" r="1.2" fill="currentColor" />
          <circle cx="19" cy="15" r="1.2" fill="currentColor" />
        </svg>
      );
    case "rss":
      return (
        <svg {...common}>
          <path d="M5 6.5c9.1 0 12.5 3.4 12.5 12.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M5 12c5.5 0 7 1.5 7 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="5.5" cy="18.5" r="1.2" fill="currentColor" />
        </svg>
      );
    case "segments":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="17" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="12" cy="17" r="2.2" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8.8 8.5 10.8 14M15.2 8.5 13.2 14M9 7h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "automation":
      return (
        <svg {...common}>
          <path d="M6 12a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M12 6v5l3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="1.25" fill="currentColor" />
        </svg>
      );
    case "integration":
      return (
        <svg {...common}>
          <path d="M10 8.5 6.5 12 10 15.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 8.5 17.5 12 14 15.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 7.5 10.5 16.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "reporting":
      return (
        <svg {...common}>
          <path d="M5 5.5h14v13H5z" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8 15.5v-4M12 15.5V9.5M16 15.5v-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "platform":
      return (
        <svg {...common}>
          <path d="M12 3.8 19 7.8v8.4l-7 4-7-4V7.8l7-4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="m12 3.8 7 4-7 4-7-4 7-4Zm0 8v7.2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    case "health":
      return (
        <svg {...common}>
          <path
            d="M3 12.5h3.4l1.8-4 2.8 8 2.2-6 1.6 2h6.2"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "auth":
      return (
        <svg {...common}>
          <path d="M8.5 11V8.5a3.5 3.5 0 1 1 7 0V11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M7 11h10v8H7z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    case "logout":
      return (
        <svg {...common}>
          <path d="M15 4.5H7.5A1.5 1.5 0 0 0 6 6v12a1.5 1.5 0 0 0 1.5 1.5H15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.5 12H20.5M20.5 12 17.2 8.7M20.5 12 17.2 15.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "planned":
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 8.5v4l2.5 1.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export function DashboardNav({ sections, collapsed }: { sections: DashboardNavSection[]; collapsed: boolean }) {
  const pathname = usePathname();

  return <nav className={`nav ${collapsed ? "nav--collapsed" : ""}`} aria-label="Primary">
    {sections.map((section) => (
      <div key={section.label} className="nav-group">
        <p className="nav-heading">{section.label}</p>
        <div className="nav-items">
          {section.items.map((item) => {
            const itemPath = item.href?.split("#")[0];
            const isActive = itemPath ? pathname === itemPath || (itemPath !== "/" && pathname.startsWith(`${itemPath}/`)) : false;
            const status = item.status ?? (item.href ? "live" : "planned");

            const itemKey = `${section.label}-${item.href ?? "planned"}-${item.label}`;

            if (!item.href) {
              return (
                <div
                  key={itemKey}
                  className={`nav-item nav-item--${status}`}
                  aria-disabled="true"
                  title={item.description ? `${item.label} - ${item.description}` : item.label}
                >
                  <span className="nav-icon">
                    <SidebarIcon name={item.icon} />
                  </span>
                  <div className="nav-item-copy">
                    <span className="nav-item-label">{item.label}</span>
                    {item.description ? <span className="nav-item-description">{item.description}</span> : null}
                  </div>
                  {status === "planned" ? <span className="nav-pill nav-pill--planned">Coming soon</span> : null}
                </div>
              );
            }

            return (
              <Link
                key={itemKey}
                href={item.href}
                className={`nav-item nav-item--${status}`}
                aria-current={isActive ? "page" : undefined}
                title={item.description ? `${item.label} - ${item.description}` : item.label}
              >
                <span className="nav-icon">
                  <SidebarIcon name={item.icon} />
                </span>
                <div className="nav-item-copy">
                  <span className="nav-item-label">{item.label}</span>
                  {item.description ? <span className="nav-item-description">{item.description}</span> : null}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    ))}
  </nav>;
}
