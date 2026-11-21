// Shapes of our database rows, written by hand to match
// supabase/migrations/20261121000000_initial_schema.sql

export const LEAD_STATUSES = ["new", "called_back", "booked", "not_interested"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LICENCE_LEVELS = ["G1", "G2", "G", "none", "unknown"] as const;
export type LicenceLevel = (typeof LICENCE_LEVELS)[number];

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export interface DayHours {
  closed: boolean;
  open: string; // "09:00"
  close: string; // "18:00"
}
export type BusinessHours = Partial<Record<DayKey, DayHours>>;

export interface Package {
  name: string;
  price: number; // dollars, before HST
  details: string;
}

export interface Faq {
  question: string;
  answer: string;
}

export interface School {
  id: string;
  name: string;
  ai_phone_number: string | null;
  admin_phone: string | null;
  owner_phone: string | null;
  timezone: string;
  business_hours: BusinessHours;
  created_at: string;
  updated_at: string;
}

export interface SchoolInfo {
  id: string;
  school_id: string;
  packages: Package[];
  faqs: Faq[];
  extra_notes: string | null;
}

export interface Call {
  id: string;
  school_id: string;
  retell_call_id: string;
  from_number: string | null;
  to_number: string | null;
  started_at: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  recording_url: string | null;
  summary: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  school_id: string;
  call_id: string | null;
  name: string | null;
  phone: string | null;
  licence_level: LicenceLevel;
  package_interest: string | null;
  preferred_times: string | null;
  pickup_area: string | null;
  questions_asked: string | null;
  needs_owner: boolean;
  status: LeadStatus;
  admin_notified_at: string | null;
  caller_notified_at: string | null;
  created_at: string;
  updated_at: string;
}
