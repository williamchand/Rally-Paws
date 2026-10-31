import { ArrowRight, Award, BookmarkPlus, Check, ChevronDown, Flame, Heart, MapPin, PartyPopper, Pencil, Share2, Star, Trophy } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { api } from '../api/client';
import { ApiError, type CardData, type CatalogActivity, type ConfirmReceipt, type DraftCardData, type Estimate, type ScheduleSession, type VenueHit } from '../api/types';
import { confirmStreak, currentStreak, levelFor, matchSummary, pbLabel, petMeters, petMood, xpToday, type Store } from '../state/store';
import { Modal, Prov } from './bits';

export interface CardCtx {
  store: Store;
  catalog: CatalogActivity[];
  onLogSport?: (sportId: string) => void;
  onViewVenue?: (venueId: string) => void;
}

function EstimateBlock({ estimate }: { estimate: Estimate | null }) {
  if (!estimate) return null;
  if (estimate.available === false) {
    return <p className="est-note">{String(estimate.reason || 'No exercise-calorie estimate for this activity.')}</p>;
  }
  return (
    <div className="est">
      <strong>{estimate.display}</strong> <Prov kind="estimated" />
      <p className="est-note">{estimate.uncertainty_note}</p>
      <p className="est-note dim">{estimate.method} · inputs: {JSON.stringify(estimate.inputs)}</p>
    </div>
  );
}

function ScoreFieldInput({ def, value, onChange }: {
  def: { name: string; label: string; kind: string; unit: string | null; options: string[] };
  value: string | number | undefined;
  onChange: (v: string) => void;
}) {
  const id = `sf-${def.name}`;
  if (def.kind === 'select') {
    return (
      <label className="field" htmlFor={id}>{def.label}
        <select id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {def.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
    );
  }
  return (
    <label className="field" htmlFor={id}>{def.label}{def.unit ? ` (${def.unit})` : ''}
      <input
        id={id}
        type={def.kind === 'number' ? 'number' : 'text'}
        inputMode={def.kind === 'number' ? 'decimal' : undefined}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/** Editable draft: any edit re-requests a fresh draft token; Confirm saves. */
export function DraftCard({ card, ctx }: { card: DraftCardData; ctx: CardCtx }) {
  const template = ctx.catalog.find((t) => t.id === card.activity_id);
  const [duration, setDuration] = useState(String(card.duration_minutes));
  const [fields, setFields] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(card.fields).map(([k, v]) => [k, String(v)])),
  );
  const [startedAt, setStartedAt] = useState(card.started_at ? card.started_at.slice(0, 16) : '');
  const [intensity, setIntensity] = useState('');
  const [current, setCurrent] = useState<DraftCardData>(card);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ConfirmReceipt | null>(null);

  const dirty =
    duration !== String(current.duration_minutes) ||
    startedAt !== (current.started_at ? current.started_at.slice(0, 16) : '') ||
    Object.entries(fields).some(([k, v]) => String(current.fields[k] ?? '') !== v) ||
    (intensity !== '' && intensity !== (current.draft.intensity as string || ''));

  const refresh = async () => {
    setWorking(true);
    setError(null);
    try {
      const scoreFields: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (v.trim() === '') continue;
        const num = Number(v);
        scoreFields[k] = template?.score_fields.find((f) => f.name === k)?.kind === 'number' && v.trim() !== '' && Number.isFinite(num) ? num : v;
      }
      const weight = ctx.store.state.prefs.weightKg;
      const next = await api.draft({
        activity: current.activity_id,
        duration_minutes: Number(duration),
        score_fields: scoreFields,
        ...(weight ? { weight_kg: weight } : {}),
        ...(intensity ? { intensity } : {}),
        ...(startedAt ? { started_at: new Date(startedAt).toISOString() } : {}),
      });
      setCurrent(next);
      setIntensity('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not refresh the draft.');
    } finally {
      setWorking(false);
    }
  };

  const confirmIt = async () => {
    setWorking(true);
    setError(null);
    try {
      // Personal-best hint from on-device history.
      let claimed = false;
      const f = current.fields;
      if (typeof f.distance_km === 'number' && f.distance_km > 0) {
        claimed = ctx.store.isLocalBest(current.activity_id, 'distance_km', f.distance_km, true);
      }
      const rec = await api.confirm({
        draft: current.draft,
        confirm_token: current.confirm_token,
        claimed_personal_best: claimed,
        claimed_streak_days: confirmStreak(ctx.store.state.history),
        claimed_xp_today: xpToday(ctx.store.state.history),
      });
      setReceipt(rec);
      ctx.store.applyReceipt(rec);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save the activity.');
    } finally {
      setWorking(false);
    }
  };

  if (receipt) {
    return <ReceiptCard receipt={receipt} ctx={ctx} onEdit={() => setReceipt(null)} />;
  }

  return (
    <div className="card draft">
      <p><strong>{current.activity_name}</strong></p>
      <div className="grid2">
        <label className="field" htmlFor={`dur-${current.confirm_token.slice(-6)}`}>Duration (min)
          <input id={`dur-${current.confirm_token.slice(-6)}`} type="number" inputMode="decimal" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </label>
        <label className="field">Started
          <input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
        </label>
        {card.started_at && <p className="dim">Prefilled for you — tap to change.</p>}
      </div>
      {template?.score_fields.map((def) => (
        <ScoreFieldInput key={def.name} def={def} value={fields[def.name]} onChange={(v) => setFields((s) => ({ ...s, [def.name]: v }))} />
      ))}
      {template && template.intensities.length > 0 && (
        <label className="field">Intensity
          <select value={intensity} onChange={(e) => setIntensity(e.target.value)}>
            <option value="">Default ({template.intensities[0].label})</option>
            {template.intensities.map((i) => <option key={i.code} value={i.code}>{i.label}</option>)}
          </select>
        </label>
      )}
      <EstimateBlock estimate={current.estimate} />
      {error && <p className="error">{error}</p>}
      <div className="row">
        {dirty && <button className="btn secondary" disabled={working} onClick={refresh}>Update draft</button>}
        <button className="btn primary" disabled={working || dirty} onClick={confirmIt}>
          {working ? 'Saving…' : dirty ? 'Update draft first' : <><Check size={16} aria-hidden="true" />Confirm and log</>}
        </button>
      </div>
      <p className="dim">{current.confirm_hint}</p>
    </div>
  );
}

export function ReceiptCard({ receipt, ctx, onEdit }: {
  receipt: ConfirmReceipt;
  ctx: CardCtx;
  onEdit: () => void;
}) {
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const lv = levelFor(ctx.store.state.xpTotal);
  const streak = currentStreak(ctx.store.state.history);
  const outcome = matchSummary(receipt.fields);

  const share = async () => {
    const pb = pbLabel(receipt.personal_best);
    const text = `Rally: ${receipt.sport_name} · ${receipt.duration_minutes} min${outcome ? ` · ${outcome}` : ''}${pb ? ` · ★ ${pb}` : ''} (+${receipt.xp.total} XP)`;
    setNotice(null);
    const nav = navigator as Navigator & { share?: (d: { title: string; text: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: 'Rally activity', text });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setNotice('Copied to clipboard.');
    } catch {
      setNotice('Copy this text manually: ' + text);
    }
  };

  if (done) {
    return (
      <div className="card receipt">
        <p><Check size={14} aria-hidden="true" /> Logged <strong>{receipt.sport_name}</strong> · {receipt.duration_minutes} min · +{receipt.xp.total} XP</p>
      </div>
    );
  }

  return (
    <div className="card receipt">
      <p className="kicker"><PartyPopper size={12} aria-hidden="true" /> Session saved</p>
      <h4>{receipt.sport_name} · {receipt.duration_minutes} min</h4>
      {outcome && <p><Trophy size={14} aria-hidden="true" /> {outcome} <Prov kind="self-reported" /></p>}
      <p className="display">+{receipt.xp.total} XP</p>
      <p className="dim">Level {lv.level}{lv.nextAt !== null ? ` · ${ctx.store.state.xpTotal.toLocaleString()} / ${lv.nextAt.toLocaleString()}` : ' · max level'}</p>
      <p className="dim">{receipt.xp.parts.map((p) => `${p.reason} +${p.amount}`).join(' · ')}{receipt.xp.capped ? ' · daily cap reached' : ''}</p>
      <div className="row">
        <span className="tag"><Flame size={12} aria-hidden="true" />Streak · {streak}-day</span>
        <span className="tag"><Heart size={12} aria-hidden="true" />Pet · {petMood(petMeters(ctx.store.state.history))}</span>
      </div>
      {receipt.energy && 'display' in receipt.energy && (
        <div className="est">
          <strong>{String(receipt.energy.display)}</strong> <Prov kind="estimated" />
          <p className="est-note">No watch synced — calories are estimated unless a watch syncs.</p>
          <button className="link" onClick={onEdit}><Pencil size={13} aria-hidden="true" />Edit inputs</button>
        </div>
      )}
      {pbLabel(receipt.personal_best) && (
        <p className="pb"><Award size={14} aria-hidden="true" /> {pbLabel(receipt.personal_best)} <Prov kind="self-reported" /></p>
      )}
      {notice && <p className="dim">{notice}</p>}
      <div className="row">
        <button className="btn secondary" onClick={share}><Share2 size={16} aria-hidden="true" />Share result card</button>
        <button className="btn primary" onClick={() => setDone(true)}><Check size={16} aria-hidden="true" />Done</button>
      </div>
      <p className="dim">Saved on this device.</p>
    </div>
  );
}

export function ScheduleCard({ goal, sessions, assumptions, ctx }: {
  goal: string; sessions: ScheduleSession[]; assumptions: string[]; ctx: CardCtx;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="card">
      <ul className="sched">
        {sessions.map((s, i) => (
          <li key={i}><strong>{s.day}</strong> · {s.activity_id} · {s.minutes} min — {s.note}</li>
        ))}
      </ul>
      {assumptions.map((a, i) => <p key={i} className="est-note dim">{a}</p>)}
      {!saved ? (
        <button className="btn secondary" onClick={() => { ctx.store.saveSchedule(goal, sessions, assumptions); setSaved(true); }}>
          <BookmarkPlus size={16} aria-hidden="true" />Save plan to this device
        </button>
      ) : <p className="dim"><Check size={13} aria-hidden="true" /> Saved. Find it in your Pet view.</p>}
    </div>
  );
}

function CardModal({ label, title, kicker, summary, children }: {
  label: string;
  title: string;
  kicker: string;
  summary: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="modal-wrap" onClick={() => setOpen(true)} aria-expanded={open}>
        <button type="button" className="card card-trigger">
          <span className="t">
            <span className="kicker">{kicker}</span>
            <strong>{summary}</strong>
          </span>
          <ChevronDown size={18} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <Modal label={label} onClose={() => setOpen(false)}>
          <h3>{title}</h3>
          {children}
          <div className="row">
            <button className="btn secondary" onClick={() => setOpen(false)}>Close</button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function cardTitle(card: CardData): string {
  if (card.type === 'activity_draft') return 'Review activity';
  if (card.type === 'estimate') return `Estimate · ${String((card as { activity_id: unknown }).activity_id)}`;
  if (card.type === 'schedule') return `Draft plan: ${String((card as { goal: unknown }).goal)}`;
  if (card.type === 'venues') return 'Venues';
  return 'Details';
}

/** Full card body without trigger chrome, for programmatic presentation. */
export function CardContent({ card, ctx }: { card: CardData; ctx: CardCtx }) {
  if (card.type === 'activity_draft') return <DraftCard card={card as DraftCardData} ctx={ctx} />;
  if (card.type === 'estimate') {
    return (
      <div className="card">
        <EstimateBlock estimate={card as unknown as Estimate} />
      </div>
    );
  }
  if (card.type === 'schedule') {
    const s = card as unknown as { goal: string; sessions: ScheduleSession[]; assumptions: string[] };
    return <ScheduleCard goal={s.goal} sessions={s.sessions} assumptions={s.assumptions} ctx={ctx} />;
  }
  if (card.type === 'venues') {
    const v = card as unknown as { venues: VenueHit[]; note: string };
    return <VenueResultsCard venues={v.venues || []} note={String(v.note || '')} ctx={ctx} />;
  }
  return null;
}

export function RenderCard({ card, ctx }: { card: CardData; ctx: CardCtx }) {
  if (card.type === 'activity_draft') {
    const d = card as DraftCardData;
    return (
      <CardModal label="Review activity" title="Review activity" kicker="Activity draft" summary={`${d.activity_name} · ${d.duration_minutes} min`}>
        <CardContent card={card} ctx={ctx} />
      </CardModal>
    );
  }
  if (card.type === 'estimate') {
    return (
      <CardModal label="Estimate" title={`Estimate · ${String(card.activity_id)}`} kicker="Estimate" summary={String(card.activity_id)}>
        <CardContent card={card} ctx={ctx} />
      </CardModal>
    );
  }
  if (card.type === 'schedule') {
    const s = card as unknown as { goal: string; sessions: ScheduleSession[]; assumptions: string[] };
    return (
      <CardModal label="Draft plan" title={`Draft plan: ${s.goal}`} kicker="Weekly plan" summary={`${s.goal} · ${s.sessions.length} sessions`}>
        <CardContent card={card} ctx={ctx} />
      </CardModal>
    );
  }
  if (card.type === 'venues') {
    const v = card as unknown as { venues: VenueHit[]; note: string };
    const venues = v.venues || [];
    return (
      <CardModal label="Venues" title="Venues" kicker="Nearby courts" summary={`${venues.length} venue${venues.length === 1 ? '' : 's'} found`}>
        <CardContent card={card} ctx={ctx} />
      </CardModal>
    );
  }
  return null;
}

function VenueResultsCard({ venues, note, ctx }: { venues: VenueHit[]; note: string; ctx: CardCtx }) {
  return (
    <div className="card">
      <p><span className="tag demo">Demo data</span></p>
      {venues.map((v) => (
        <div className="quest" key={v.venue_id}>
          <div className="grow">
            <p><strong>{v.name}</strong></p>
            <p className="meta-line dim">
              <MapPin size={13} aria-hidden="true" />{v.city} · {v.distance_km} km · <Star size={13} aria-hidden="true" />{v.rating} ({v.reviews})
            </p>
          </div>
          {ctx.onViewVenue && (
            <button className="btn secondary" onClick={() => ctx.onViewVenue!(v.venue_id)}>
              View<ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
      <p className="dim">{note}</p>
    </div>
  );
}
