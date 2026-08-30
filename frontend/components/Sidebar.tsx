"use client";

import { ChevronsRight, PanelLeft, Settings } from "lucide-react";
import Image from "next/image";
import { Logo, SparkleDuo } from "./Brand";

/**
 * The design's nav icons are a solid set that lucide has no equivalent for —
 * "My Classroom" is a teacher at a whiteboard, not a presentation easel. They
 * are exported as alpha masks and painted with `currentColor`, so the active
 * row still darkens the same way an inline SVG would.
 */
const NAV = [
  { label: "Home", icon: "home" },
  { label: "My Classroom", icon: "classroom" },
  { label: "Assignments", icon: "assignments" },
  { label: "Exams", icon: "exams" },
  { label: "My Library", icon: "library" }
];

function NavIcon({ name }: { name: string }) {
  const url = `url(/nav/${name}.png)`;
  return (
    <span
      aria-hidden="true"
      className="h-[19px] w-[19px] shrink-0 bg-current"
      style={{
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center"
      }}
    />
  );
}

const ACTIVE = "Exams";

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

/**
 * Desktop navigation. Collapses to an icon rail, which is the state the design
 * uses on the processing and mapping screens to give the documents more room.
 */
export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={`hidden shrink-0 flex-col rounded-panel bg-surface py-4 transition-[width] duration-200 md:flex ${
        collapsed ? "w-[68px] items-center px-2.5" : "w-[248px] px-3.5"
      }`}
    >
      <div className={`flex items-center px-1 ${collapsed ? "justify-center" : "justify-between"}`}>
        <span className="flex items-center gap-2.5">
          <Logo size={collapsed ? 30 : 34} />
          {!collapsed && <span className="text-[21px] font-extrabold tracking-tight">VedaAI</span>}
        </span>
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
            aria-label="Collapse sidebar"
          >
            <PanelLeft className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        )}
      </div>

      <button
        type="button"
        className={`mt-10 flex items-center justify-center gap-2.5 rounded-full bg-[linear-gradient(140deg,#454545_0%,#2C2C2C_65%,#343434_100%)] text-white ring-[3px] ring-[#E8734A] transition hover:brightness-110 ${
          collapsed ? "h-[38px] w-[38px] self-center" : "h-11 w-full px-4"
        }`}
        aria-label={collapsed ? "AI Teachers Toolkit" : undefined}
      >
        <SparkleDuo size={20} className="text-white" />
        {!collapsed && <span className="text-[14.5px] font-medium">AI Teacher&rsquo;s Toolkit</span>}
      </button>

      <nav className={`mt-10 flex flex-col gap-0.5 ${collapsed ? "items-center" : ""}`} aria-label="Main">
        {NAV.map(({ label, icon }) => {
          const isActive = label === ACTIVE;
          return (
            <a
              key={label}
              href="#"
              aria-current={isActive ? "page" : undefined}
              aria-label={collapsed ? label : undefined}
              title={collapsed ? label : undefined}
              className={`flex items-center rounded-[10px] transition ${
                collapsed ? "h-11 w-11 justify-center" : "h-11 gap-3 px-3"
              } ${
                isActive
                  ? "bg-surface-sunken font-medium text-ink"
                  : "text-ink-muted hover:bg-surface-sunken/60 hover:text-ink"
              }`}
            >
              <NavIcon name={icon} />
              {!collapsed && <span className="text-[14px]">{label}</span>}
            </a>
          );
        })}
      </nav>

      <div className={`mt-auto flex flex-col gap-3 ${collapsed ? "items-center" : ""}`}>
        {!collapsed && (
          <a
            href="#"
            className="flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] text-ink-muted transition hover:bg-surface-sunken/60 hover:text-ink"
          >
            <Settings className="h-[18px] w-[18px]" aria-hidden="true" />
            Settings
          </a>
        )}

        <div
          className={`flex items-center gap-2.5 rounded-xl bg-surface-sunken ${
            collapsed ? "h-10 w-10 justify-center" : "px-3 py-2.5"
          }`}
        >
          <Image src="/school-crest.png" alt="" width={225} height={225} className="h-9 w-9 shrink-0" />
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-semibold leading-tight">Delhi Public School</span>
              <span className="block truncate text-[11.5px] text-ink-muted">Bokaro Steel City</span>
            </span>
          )}
        </div>

        {collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
            aria-label="Expand sidebar"
          >
            <ChevronsRight className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        )}
      </div>
    </aside>
  );
}
