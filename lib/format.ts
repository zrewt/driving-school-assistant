// Display helpers. All times are shown in Toronto time.

import type { LeadStatus } from "@/lib/types";

export const TIMEZONE = "America/Toronto";

/** "Sat, Nov 21, 2:15 p.m." in Toronto time. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** "2 min 22 sec" */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds && seconds !== 0) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} min ${s} sec` : `${s} sec`;
}

export function formatMoney(dollars: number): string {
  return dollars.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
}

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  called_back: "Called back",
  booked: "Booked",
  not_interested: "Not interested",
};

export const STATUS_STYLES: Record<LeadStatus, string> = {
  new: "bg-blue-100 text-blue-800 ring-blue-200",
  called_back: "bg-amber-100 text-amber-800 ring-amber-200",
  booked: "bg-green-100 text-green-800 ring-green-200",
  not_interested: "bg-slate-100 text-slate-600 ring-slate-200",
};

export const LICENCE_LABELS: Record<string, string> = {
  G1: "G1",
  G2: "G2",
  G: "Full G",
  none: "No licence",
  unknown: "Licence ?",
};
