"use client";

import { useState, type ReactNode } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function WorkspaceSidebar({
  brand,
  children,
}: {
  brand: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const Toggle = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "group/sidebar border-b border-border bg-surface lg:min-h-dvh lg:border-r lg:border-b-0",
        collapsed ? "lg:w-[4.5rem]" : "lg:w-[15.5rem]",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-2 lg:px-4 lg:pt-5 lg:pb-4">
        <div
          className={cn(
            "hidden min-w-0 flex-1 lg:block",
            collapsed && "lg:sr-only",
          )}
        >
          {brand}
        </div>
        <button
          type="button"
          className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold hover:bg-background lg:hidden"
          aria-label="Dashboard navigation"
          aria-controls="workspace-links"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <Menu size={18} aria-hidden /> Dashboard menu
        </button>
        <button
          type="button"
          className="hidden size-10 shrink-0 items-center justify-center rounded-lg hover:bg-background lg:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-controls="workspace-links"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          <Toggle size={18} aria-hidden />
        </button>
      </div>
      <div
        id="workspace-links"
        className={cn("lg:block", mobileOpen ? "block" : "hidden")}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a"))
            setMobileOpen(false);
        }}
      >
        {children}
      </div>
    </aside>
  );
}
