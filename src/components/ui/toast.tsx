"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "danger";

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
};

export function Toast({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  return (
    <div
      className={cn(
        "w-[360px] rounded-xl border bg-white p-4 shadow-lg",
        item.variant === "danger" ? "border-red-200" : "border-zinc-200"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-900">{item.title}</div>
          {item.description ? (
            <div className="mt-1 text-sm text-zinc-600">{item.description}</div>
          ) : null}
        </div>
        <button
          onClick={onClose}
          className="text-xs text-zinc-500 hover:text-zinc-900"
          aria-label="Close"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export function ToastViewport({
  items,
  remove,
}: {
  items: ToastItem[];
  remove: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {items.map((item) => (
        <Toast key={item.id} item={item} onClose={() => remove(item.id)} />
      ))}
    </div>
  );
}

export function useToast() {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const push = React.useCallback((item: Omit<ToastItem, "id">) => {
    const id = `${Date.now()}-${Math.random()}`;
    const toast: ToastItem = { id, ...item };
    setItems((prev) => [toast, ...prev].slice(0, 3));

    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const remove = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { items, push, remove };
}
