export interface ApiErrorShape {
  code: string;
  message: string;
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface ScoreFieldDef {
  name: string;
  label: string;
  kind: 'number' | 'text' | 'select' | 'duration';
  unit: string | null;
  options: string[];
  required: boolean;
}

export interface CatalogActivity {
  id: string;
  name: string;
  category: string;
  aliases: string[];
  score_fields: ScoreFieldDef[];
  intensities: { code: string; label: string; met: number }[];
  record_metrics: string[];
  flexible: boolean;
}

export interface Estimate {
  display?: string;
  available?: boolean;
  reason?: string;
  active_kcal_low?: number | null;
  active_kcal_high?: number | null;
  gross_kcal?: number | null;
  method?: string;
  inputs?: Record<string, unknown>;
  uncertainty_note?: string;
  met_code?: string;
}

export interface DraftCardData {
  type: 'activity_draft';
  activity_id: string;
  activity_name: string;
  duration_minutes: number;
  fields: Record<string, string | number>;
  started_at: string | null;
  estimate: Estimate | null;
  draft: Record<string, unknown>;
  confirm_token: string;
  confirm_hint: string;
}

export interface VenueHit {
  venue_id: string;
  name: string;
  city: string;
  distance_km: number;
  rating: number;
  reviews: number;
  tags: string[];
}

export type CardData =
  | DraftCardData
  | { type: 'estimate'; activity_id: string; [k: string]: unknown }
  | { type: 'schedule'; goal: string; sessions: ScheduleSession[]; assumptions: string[] }
  | { type: 'venues'; venues: VenueHit[]; note: string }
  | { type: string; [k: string]: unknown };

export interface ScheduleSession {
  day: string;
  activity_id: string;
  minutes: number;
  note: string;
}

export interface ConfirmReceipt {
  activity_id: string;
  sport: string;
  sport_name: string;
  duration_minutes: number;
  started_at: string;
  fields: Record<string, string | number>;
  energy: Estimate | null;
  xp: { total: number; parts: { reason: string; amount: number }[]; capped: boolean };
  personal_best: string | null;
}

export interface ChatResponse {
  reply: string;
  cards: CardData[];
  tools_used: string[];
  model_id: string;
  latency_ms: number;
}

export interface BillingStatus {
  configured: boolean;
  entitlement: string;
  active: boolean;
  source: 'none' | 'revenuecat';
  expires_date: string | null;
  product_identifier: string | null;
}


