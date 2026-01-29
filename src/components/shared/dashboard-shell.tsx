"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { SidebarNav } from "@/components/shared/sidebar-nav";

export function DashboardShell({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("pk_sidebar_collapsed");
      if (raw === "1") setSidebarCollapsed(true);
    } catch {
      return;
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((v) => {
      const next = !v;
      try {
        window.localStorage.setItem("pk_sidebar_collapsed", next ? "1" : "0");
      } catch {
        return next;
      }
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="flex">
        <aside
          className={
            "hidden min-h-screen border-r bg-white p-4 transition-[width] duration-200 md:block " +
            (sidebarCollapsed ? "w-16" : "w-72")
          }
        >
          <div className={sidebarCollapsed ? "px-0 py-3" : "px-2 py-3"}>
            <div className={"flex items-center gap-3 " + (sidebarCollapsed ? "justify-center" : "")}
            >
              <Image
                src="/icon.svg"
                alt="Pulse Konnect"
                width={32}
                height={32}
                className="h-8 w-8"
                priority
              />
              {sidebarCollapsed ? null : (
                <div className="text-sm font-semibold tracking-tight text-zinc-900">
                  Pulse Konnect
                </div>
              )}
            </div>
            {sidebarCollapsed ? null : (
              <div className="text-xs text-zinc-500">Carolina Community Support Service</div>
            )}
          </div>

          <SidebarNav collapsed={sidebarCollapsed} />
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b bg-white px-4 md:px-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSidebar}
                className="hidden h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 md:flex"
                aria-label="Toggle sidebar"
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
              <div className="text-sm font-semibold text-zinc-900">{title}</div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationCenter />
              <form action={signOut}>
                <button className="rounded-md border px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  Sign out
                </button>
              </form>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
