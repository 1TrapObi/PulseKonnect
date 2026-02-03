"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LayoutDashboard, Settings, Users } from "lucide-react";

const secondaryNav = [
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLink({
  href,
  icon: Icon,
  children,
  collapsed,
}: {
  href: string;
  icon?: any;
  children: React.ReactNode;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  return (
    <Link
      href={href}
      className={
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-zinc-100 hover:text-zinc-900 " +
        (collapsed ? "justify-center px-2" : "") +
        " " +
        (active ? "bg-zinc-100 text-zinc-900" : "text-zinc-700")
      }
    >
      {Icon ? <Icon className="h-4 w-4 text-zinc-500" /> : null}
      {collapsed ? null : <span>{children}</span>}
    </Link>
  );
}

export function SidebarNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const defaultOpen = pathname.startsWith("/leads") || pathname.startsWith("/analytics");
  const [leadsOpen, setLeadsOpen] = React.useState(defaultOpen);

  const defaultCandidatesOpen = pathname.startsWith("/candidates");
  const [candidatesOpen, setCandidatesOpen] = React.useState(defaultCandidatesOpen);

  React.useEffect(() => {
    if (defaultOpen) setLeadsOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  React.useEffect(() => {
    if (defaultCandidatesOpen) setCandidatesOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <nav className="mt-6 space-y-1">
      <div>
        <button
          type="button"
          onClick={() => setLeadsOpen((v) => !v)}
          aria-expanded={leadsOpen}
          className={
            "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 " +
            (collapsed ? "justify-center px-2" : "")
          }
        >
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4 text-zinc-500" />
            {collapsed ? null : <span>Leads</span>}
          </div>
          <ChevronDown
            className={
              "h-4 w-4 text-zinc-500 transition-transform " +
              (collapsed ? "hidden " : "") +
              (leadsOpen ? "rotate-180" : "")
            }
          />
        </button>

        <div
          className={
            "overflow-hidden pl-3 transition-[max-height] duration-200 ease-out " +
            (leadsOpen ? "max-h-56" : "max-h-0")
          }
        >
          <div className="mt-1 space-y-1">
            <NavLink href="/leads" collapsed={collapsed}>
              All Leads
            </NavLink>
            <NavLink href="/analytics/leads" collapsed={collapsed}>
              Analytics
            </NavLink>
            <NavLink href="/leads/configuration" collapsed={collapsed}>
              Configuration
            </NavLink>
          </div>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setCandidatesOpen((v) => !v)}
          aria-expanded={candidatesOpen}
          className={
            "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 " +
            (collapsed ? "justify-center px-2" : "")
          }
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-zinc-500" />
            {collapsed ? null : <span>Recruitment</span>}
          </div>
          <ChevronDown
            className={
              "h-4 w-4 text-zinc-500 transition-transform " +
              (collapsed ? "hidden " : "") +
              (candidatesOpen ? "rotate-180" : "")
            }
          />
        </button>

        <div
          className={
            "overflow-hidden pl-3 transition-[max-height] duration-200 ease-out " +
            (candidatesOpen ? "max-h-40" : "max-h-0")
          }
        >
          <div className="mt-1 space-y-1">
            <NavLink href="/candidates" collapsed={collapsed}>
              Candidate Pipeline
            </NavLink>
            <NavLink href="/settings/positions" collapsed={collapsed}>
              Job Postings
            </NavLink>
            <NavLink href="/analytics/recruitment" collapsed={collapsed}>
              Recruitment Metrics
            </NavLink>
          </div>
        </div>
      </div>

      {secondaryNav.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          icon={(item as any).icon}
          collapsed={collapsed}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
