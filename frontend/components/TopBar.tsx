"use client";

import { ArrowLeft, Bell, ChevronDown, ClipboardList, HelpCircle, Menu } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { Logo, Sparkle } from "./Brand";

const USER = "Madhur Rastogi";

/** Desktop header: breadcrumb on the left, account tools on the right. */
export function TopBar() {
  return (
    <header className="hidden h-[58px] shrink-0 items-center justify-between rounded-panel bg-surface px-4 md:mr-3 md:flex">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-full bg-white text-ink transition hover:bg-surface-sunken"
          aria-label="Go back"
        >
          <ArrowLeft className="h-[19px] w-[19px]" strokeWidth={2.4} aria-hidden="true" />
        </button>
        <span className="flex items-center gap-2 text-[14px] text-ink-muted">
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          Exams
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <IconButton label="Help">
          <HelpCircle className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
        </IconButton>
        <IconButton label="Notifications">
          <span className="relative">
            <Bell className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
            <span className="absolute -right-0.5 -top-0.5 h-[9px] w-[9px] rounded-full bg-brand" />
          </span>
        </IconButton>
        {/* The design gives this one no disc — it sits straight on the bar. */}
        <IconButton label="AI assistant" plain>
          <Sparkle size={22} className="text-ink" />
        </IconButton>
        <button
          type="button"
          className="ml-1 flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-surface-sunken"
        >
          <Image src="/avatar.png" alt="" width={128} height={128} className="h-8 w-8 rounded-full" />
          <span className="text-[14px] font-medium">{USER}</span>
          <ChevronDown className="h-4 w-4 text-ink-muted" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

/** Mobile header: wordmark plus the same account tools, condensed. */
export function MobileTopBar() {
  return (
    <header className="mr-3 flex h-[56px] shrink-0 items-center justify-between rounded-panel bg-surface px-3.5 md:hidden">
      <span className="flex items-center gap-2.5">
        <Logo size={28} />
        <span className="text-[17px] font-bold tracking-tight">VedaAI</span>
      </span>
      <div className="flex items-center gap-2">
        <span className="relative grid h-9 w-9 place-items-center rounded-full bg-surface-sunken">
          <Bell className="h-[17px] w-[17px]" aria-hidden="true" />
          <span className="absolute right-2 top-2 h-[7px] w-[7px] rounded-full bg-brand" />
        </span>
        <Image src="/avatar.png" alt="" width={128} height={128} className="h-9 w-9 rounded-full" />
        <button type="button" className="grid h-9 w-9 place-items-center rounded-lg" aria-label="Open menu">
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

function IconButton({
  label,
  plain = false,
  children
}: {
  label: string;
  plain?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`grid h-9 w-9 place-items-center rounded-full text-ink transition hover:bg-surface-sunken ${
        plain ? "" : "bg-surface-list"
      }`}
    >
      {children}
    </button>
  );
}
