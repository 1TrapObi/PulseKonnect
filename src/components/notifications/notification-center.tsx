"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function NotificationCenter() {
  const [open, setOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [items, setItems] = React.useState<Notification[]>([]);

  const fetchData = React.useCallback(async () => {
    const res = await fetch("/api/notifications?page=1");
    const json = await res.json().catch(() => ({}));
    if (json?.ok) {
      setUnreadCount(Number(json.unreadCount ?? 0));
      setItems((json.notifications ?? []).slice(0, 10));
    }
  }, []);

  React.useEffect(() => {
    fetchData();
    const t = window.setInterval(fetchData, 30000);
    return () => window.clearInterval(t);
  }, [fetchData]);

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-notification-center]") == null) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    await fetchData();
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "PATCH" });
    await fetchData();
  }

  return (
    <div className="relative z-50" data-notification-center>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#EF4444] px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <Card className="absolute right-0 z-50 mt-2 w-[360px] border bg-white p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1">
            <div className="text-sm font-semibold text-zinc-900">Notifications</div>
            <Button type="button" variant="ghost" size="sm" onClick={markAllRead}>
              Mark all as read
            </Button>
          </div>
          <div className="max-h-[360px] overflow-auto">
            {items.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-zinc-600">No notifications</div>
            ) : (
              <div className="space-y-1">
                {items.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-md px-2 py-2 text-sm hover:bg-zinc-50 ${
                      n.is_read ? "" : "bg-zinc-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-zinc-900 truncate">{n.title}</div>
                        <div className="mt-0.5 text-zinc-600 line-clamp-2">{n.message}</div>
                        <div className="mt-1 text-xs text-zinc-500">{timeAgo(n.created_at)}</div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        {n.link ? (
                          <Button asChild variant="outline" size="sm">
                            <Link href={n.link}>Open</Link>
                          </Button>
                        ) : null}
                        {!n.is_read ? (
                          <Button type="button" variant="ghost" size="sm" onClick={() => markRead(n.id)}>
                            Mark read
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="px-2 py-2">
            <Button asChild variant="outline" className="w-full">
              <Link href="/settings/notifications">Notification settings</Link>
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
