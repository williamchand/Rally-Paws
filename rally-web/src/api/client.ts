import { ApiError, type BillingStatus, type CardData, type CatalogActivity, type ChatResponse, type ConfirmReceipt, type DraftCardData, type Estimate, type ScheduleSession } from './types';

// Same-origin by default; Vite dev proxies /api and /health to the backend.
// Production builds may set VITE_COACH_API_BASE to an absolute backend URL.
const BASE = (import.meta.env.VITE_COACH_API_BASE as string | undefined) || '';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let resp: Response;
  try {
    resp = await fetch(BASE + path, { ...init, headers: { ...headers, ...(init.headers as object) } });
  } catch {
    throw new ApiError(0, 'network_error', 'Could not reach the Rally server. Is the backend running?');
  }
  const data = (await resp.json().catch(() => ({}))) as { code?: string; message?: string } & T;
  if (!resp.ok) {
    throw new ApiError(resp.status, data.code || 'request_failed', data.message || `Request failed (${resp.status})`);
  }
  return data;
}

export interface ChatContext {
  interests: string[];
  session_minutes?: number;
  low_impact: boolean;
  vegetarian: boolean;
  weight_kg?: number;
  timezone?: string;
  calendar_events: { title: string; start: string; end?: string; location?: string }[];
  image_data_url?: string;
}

export interface ChatStreamEvent {
  type: 'delta' | 'done' | 'error';
  text?: string;
  reply?: string;
  cards?: CardData[];
  tools_used?: string[];
  model_id?: string;
  latency_ms?: number;
  code?: string;
  message?: string;
}

export const api = {
  health: () => request<{ status: string; version: string; model_configured: boolean; frontend: string }>('/health'),
  chat: (message: string, history: { role: 'user' | 'assistant'; text: string }[], context: ChatContext) =>
    request<ChatResponse>('/api/chat', { method: 'POST', body: JSON.stringify({ message, history, context }) }),
  /** POST /api/chat/stream: same tool loop as chat, delivered as SSE deltas. */
  chatStream: (
    message: string,
    history: { role: 'user' | 'assistant'; text: string }[],
    context: ChatContext,
    onEvent: (e: ChatStreamEvent) => void,
  ): { done: Promise<void>; abort: () => void } => {
    const ctrl = new AbortController();
    const done = (async (): Promise<void> => {
      let resp: Response;
      try {
        resp = await fetch(BASE + '/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, history, context }),
          signal: ctrl.signal,
        });
      } catch {
        if (ctrl.signal.aborted) return;
        throw new ApiError(0, 'network_error', 'Could not reach the Rally server. Is the backend running?');
      }
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { code?: string; message?: string };
        throw new ApiError(resp.status, data.code || 'request_failed', data.message || `Request failed (${resp.status})`);
      }
      if (!resp.body) return;
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done: finished } = await reader.read();
        if (finished) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          let fired = false;
          for (const line of frame.split('\n')) {
            const t = line.trim();
            if (!t.startsWith('data:')) continue;
            const payload = t.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              onEvent(JSON.parse(payload) as ChatStreamEvent);
              fired = true;
            } catch {
              /* skip malformed frame */
            }
          }
          // Yield between frames so React paints each chunk: without this,
          // a whole reply buffered in one network read renders in one pass
          // and the stream looks instant.
          if (fired) await new Promise((r) => setTimeout(r, 0));
        }
      }
    })();
    return { done, abort: () => ctrl.abort() };
  },
  estimate: (body: { activity: string; duration_minutes: number; weight_kg?: number; intensity?: string }) =>
    request<Estimate>('/api/estimate', { method: 'POST', body: JSON.stringify(body) }),
  catalog: () => request<{ activities: CatalogActivity[]; estimate_source: string }>('/api/catalog'),
  draft: (body: { activity: string; duration_minutes: number; score_fields?: Record<string, unknown>; weight_kg?: number; intensity?: string; started_at?: string }) =>
    request<DraftCardData>('/api/activities/draft', { method: 'POST', body: JSON.stringify(body) }),
  confirm: (body: { draft: Record<string, unknown>; confirm_token: string; claimed_personal_best?: boolean; claimed_streak_days?: number; claimed_xp_today?: number }) =>
    request<ConfirmReceipt>('/api/activities/confirm', { method: 'POST', body: JSON.stringify(body) }),
  schedule: (body: { goal: string; activities: string[]; days_available: string[]; session_minutes: number; low_impact?: boolean }) =>
    request<{ goal: string; sessions: ScheduleSession[]; assumptions: string[] }>('/api/schedules/draft', { method: 'POST', body: JSON.stringify(body) }),
  billing: (appUserId: string) =>
    request<BillingStatus>(`/api/billing/status?app_user_id=${encodeURIComponent(appUserId)}`),
};

/** Stable anonymous app-user id for billing checks (RevenueCat anonymous-id pattern). */
export function appUserId(): string {
  let id = localStorage.getItem('rally.appUserId');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `anon-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    try {
      localStorage.setItem('rally.appUserId', id);
    } catch {
      /* private mode: id lasts the session */
    }
  }
  return id;
}

export type { CardData, CatalogActivity };
