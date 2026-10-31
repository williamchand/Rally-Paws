import { CalendarDays, Camera, Flag, LocateFixed, Pause, Pencil, Play, Plus, Send, Sparkles, Swords, Timer, Watch } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type ChatContext } from '../api/client';
import { ApiError, type CardData, type CatalogActivity, type VenueHit } from '../api/types';
import { currentStreak, draftScoreFields, petMeters, petMood, type Store } from '../state/store';
import { Modal } from './bits';
import { CardContent, cardTitle, RenderCard, type CardCtx } from './cards';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  cards?: CardData[];
}

let msgId = 0;
const nextId = () => `m-${Date.now()}-${msgId++}`;

function daypart(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

export function coachContext(store: Store): ChatContext {
  const { prefs } = store.state;
  return {
    interests: prefs.interests,
    ...(prefs.sessionMinutes ? { session_minutes: prefs.sessionMinutes } : {}),
    low_impact: prefs.lowImpact,
    vegetarian: prefs.vegetarian,
    ...(prefs.weightKg ? { weight_kg: prefs.weightKg } : {}),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    calendar_events: [],
  };
}

function recentSummary(store: Store): string {
  const items = store.state.history.slice(0, 5).map(
    (h) => `${h.sportName} ${h.durationMin}min on ${h.startedAt.slice(0, 10)}`,
  );
  return items.length ? items.join('; ') : 'none yet';
}

/** Stream a JSON prefill from the coach on mount; falls back to defaults when AI is unavailable. */
function useAiPrefill(prompt: string, store: Store, apply: (raw: unknown) => boolean): 'waiting' | 'done' | 'skipped' {
  const [status, setStatus] = useState<'waiting' | 'done' | 'skipped'>('waiting');
  useEffect(() => {
    let live = true;
    let acc = '';
    const stream = api.chatStream(prompt, [], coachContext(store), (e) => {
      if (e.type === 'delta' && e.text) acc += e.text;
      else if (e.type === 'done' && e.reply !== undefined) acc = e.reply;
    });
    stream.done.then(() => {
      if (!live) return;
      let ok = false;
      const m = acc.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          ok = apply(JSON.parse(m[0]) as unknown);
        } catch {
          ok = false;
        }
      }
      setStatus(ok ? 'done' : 'skipped');
    }).catch(() => {
      if (live) setStatus('skipped');
    });
    return () => { live = false; stream.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return status;
}

function AiNote({ status }: { status: 'waiting' | 'done' | 'skipped' }) {
  if (status === 'done') return <p className="dim"><Sparkles size={13} aria-hidden="true" /> Prefilled with AI — adjust anything.</p>;
  return null;
}

export function Today({ store, catalog, quickSport, quickSportNonce, goTab, onViewVenue }: {
  store: Store;
  catalog: CatalogActivity[];
  quickSport: string | null;
  quickSportNonce: number;
  goTab: (t: 'explore' | 'friends') => void;
  onViewVenue: (venueId: string) => void;
}) {
  const { state } = store;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [panel, setPanel] = useState<'none' | 'log' | 'timer' | 'plan' | 'watch'>('none');
  const [logActivity, setLogActivity] = useState('tennis');
  const [logDuration, setLogDuration] = useState(() => String(state.prefs.sessionMinutes || 45));
  const [lockActivity, setLockActivity] = useState(false);
  const [autoCard, setAutoCard] = useState<CardData | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const ctx: CardCtx = useMemo(() => ({ store, catalog, onViewVenue }), [store, catalog, onViewVenue]);

  useEffect(() => {
    if (quickSport) void quickDraft(quickSport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickSportNonce]);

  /** One-tap tile log: draft immediately with history-backed details and open Review. */
  const quickDraft = async (activityId: string) => {
    const name = catalog.find((a) => a.id === activityId)?.name || activityId;
    try {
      const prefill = draftScoreFields(catalog, state.history, activityId);
      const card = await api.draft({
        activity: activityId,
        duration_minutes: state.prefs.sessionMinutes || 45,
        ...(state.prefs.weightKg ? { weight_kg: state.prefs.weightKg } : {}),
        ...(Object.keys(prefill).length ? { score_fields: prefill } : {}),
      });
      pushAssistant(`Quick draft for ${name} — details prefilled from your last session. Review and tap Confirm to save.`, [card]);
      setAutoCard(card);
    } catch (e) {
      pushAssistant(e instanceof ApiError ? `Could not draft ${name}: ${e.message}` : `Could not draft ${name}. Check your connection and try again.`);
    }
  };

  const lastCards = msgs.length > 0 ? (msgs[msgs.length - 1].cards?.length ?? 0) : 0;
  const lastTextLen = msgs.length > 0 ? msgs[msgs.length - 1].text.length : 0;
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    bottomRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'end' });
  }, [msgs.length, lastCards, lastTextLen, sending]);

  const pushAssistant = (text: string, cards?: CardData[]) =>
    setMsgs((m) => [...m, { id: nextId(), role: 'assistant', text, cards }]);

  /** Tool cards redirect: venues open Explore prefilled, drafts open a modal. Returns true when handled. */
  const presentCards = (cards: CardData[]): boolean => {
    const venues = cards.find((c) => c.type === 'venues') as { venues?: VenueHit[] } | undefined;
    const firstId = venues?.venues?.[0]?.venue_id;
    if (firstId) {
      onViewVenue(firstId);
      return true;
    }
    const modal = cards.find((c) => c.type === 'activity_draft' || c.type === 'estimate' || c.type === 'schedule');
    if (modal) {
      setAutoCard(modal);
      return true;
    }
    return false;
  };

  const send = async (text: string, opts?: { present?: boolean; fallback?: () => void }) => {
    const message = text.trim();
    if (!message || sending) return;
    const coachId = nextId();
    setMsgs((m) => [...m, { id: nextId(), role: 'user', text: message }, { id: coachId, role: 'assistant', text: '' }]);
    setInput('');
    setSending(true);
    const setCoach = (patch: (m: Msg) => Msg) =>
      setMsgs((m) => m.map((x) => (x.id === coachId ? patch(x) : x)));
    // Paced reveal: network chunks arrive faster than the browser paints, so
    // buffer delta text and reveal it on a timer — otherwise the reply looks
    // instant even though it streamed.
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let target = '';
    let shown = 0;
    let streamDone = false;
    const timer = setInterval(() => {
      if (shown < target.length) {
        const remaining = target.length - shown;
        const step = reduceMotion
          ? remaining
          : streamDone ? Math.max(10, Math.ceil(remaining / 8)) : 5;
        shown = Math.min(target.length, shown + step);
        const slice = target.slice(0, shown);
        setCoach((x) => ({ ...x, text: slice }));
      } else if (streamDone) {
        clearInterval(timer);
      }
    }, 40);
    const stopTicker = () => clearInterval(timer);
    const failCoach = (text: string) => {
      stopTicker();
      setCoach((x) => ({ ...x, text }));
    };
    try {
      const history = msgs.filter((m) => m.text).slice(-10).map((m) => ({ role: m.role, text: m.text }));
      const { done } = api.chatStream(message, history, {
        interests: state.prefs.interests,
        ...(state.prefs.sessionMinutes ? { session_minutes: state.prefs.sessionMinutes } : {}),
        low_impact: state.prefs.lowImpact,
        vegetarian: state.prefs.vegetarian,
        ...(state.prefs.weightKg ? { weight_kg: state.prefs.weightKg } : {}),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        calendar_events: [],
        ...(photo ? { image_data_url: photo } : {}),
      }, (e) => {
        if (e.type === 'delta' && e.text) {
          target += e.text;
        } else if (e.type === 'done') {
          streamDone = true;
          target = e.reply ?? target;
          setPhoto(null);
          setCoach((x) => ({ ...x, cards: e.cards }));
          if (opts?.present && !(e.cards && e.cards.length && presentCards(e.cards))) {
            opts.fallback?.();
          }
        } else if (e.type === 'error') {
          failCoach(e.code === 'model_not_configured'
            ? 'The coach is not connected: the server has no MODEL_API_KEY. Drafts, estimates, and schedules below still work without it — ask your host to set the key to enable chat.'
            : `That didn't go through: ${e.message || 'unknown error'}`);
          opts?.fallback?.();
        }
      });
      await done;
      if (!streamDone) streamDone = true; // ended without a done event: drain and stop
    } catch (e) {
      if (e instanceof ApiError && e.code === 'model_not_configured') {
        failCoach('The coach is not connected: the server has no MODEL_API_KEY. Drafts, estimates, and schedules below still work without it — ask your host to set the key to enable chat.');
      } else if (e instanceof ApiError) {
        failCoach(`That didn't go through: ${e.message}`);
      } else {
        failCoach('That didn\'t go through. Check your connection and try again.');
      }
      opts?.fallback?.();
    } finally {
      setSending(false);
    }
  };

  const invite = state.matches.find((m) => m.status === 'invite' && new Date(m.expiresAt).getTime() > Date.now());

  // Every removed home card stays reachable here: interest draft, PB log,
  // recovery, week plan, nearby courts, and friend invites — then generic examples.
  const SUGGESTIONS: { label: string; run: () => void }[] = (() => {
    const out: { label: string; run: () => void }[] = [];
    const interest = state.prefs.interests[0];
    if (interest) {
      out.push({
        label: `Draft a ${state.prefs.sessionMinutes}-minute ${interest} session`,
        run: () => void send(`I want to log ${interest} for ${state.prefs.sessionMinutes} minutes`, { present: true }),
      });
    }
    const counts = new Map<string, number>();
    for (const h of state.history) counts.set(h.sport, (counts.get(h.sport) || 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) {
      const name = state.history.find((h) => h.sport === top[0])?.sportName || top[0];
      out.push({
        label: `Log a ${name} session`,
        run: () => void send(`I want to log ${name} for ${state.prefs.sessionMinutes} minutes`, {
          present: true,
          fallback: () => { setLogActivity(top[0]); setLockActivity(true); setPanel('log'); },
        }),
      });
    }
    const last = state.history[0];
    if (last && Date.now() - new Date(last.startedAt).getTime() < 24 * 3600 * 1000 && last.durationMin >= 45) {
      out.push({
        label: 'Suggest a short recovery session',
        run: () => void send('Suggest a short recovery session for today', { present: true }),
      });
    }
    if (state.schedules.length === 0) {
      out.push({
        label: 'Plan my week',
        run: () => void send('Plan my week of workouts', { present: true, fallback: () => setPanel('plan') }),
      });
    }
    out.push({
      label: 'Book a court',
      run: () => void send('Find courts near me to book', { present: true, fallback: () => goTab('explore') }),
    });
    out.push({
      label: invite ? 'View friend invite' : 'Challenge a friend',
      run: () => void send('I want to challenge a friend to a game', { present: true, fallback: () => goTab('friends') }),
    });
    out.push(
      { label: 'Check padel venues in Jakarta', run: () => void send('Check padel venues in Jakarta', { present: true }) },
      { label: 'Played tennis an hour yesterday evening', run: () => void send('I played tennis for an hour yesterday evening', { present: true }) },
      { label: 'Calories in a 45-minute swim?', run: () => void send('How many calories does a 45-minute swim burn?', { present: true }) },
    );
    return out.slice(0, 6);
  })();

  const onPhoto = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      if (url.length > 6_000_000) {
        pushAssistant('That photo is too large to send. Try a smaller one.');
        return;
      }
      setPhoto(url);
    };
    reader.readAsDataURL(file);
  };

  const name = state.prefs.displayName ? `, ${state.prefs.displayName}` : '';
  const streak = currentStreak(state.history);
  const todayCount = state.history.filter((h) => h.startedAt.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;

  return (
    <div className="screen">
      <header className="topbar">
        <div>
          <h2>Good {daypart()}{name}</h2>
          <p className="dim">
            {streak > 0 ? `${streak}-day streak · ` : 'Rest days are safe · '}
            Pet is {petMood(petMeters(state.history)).toLowerCase()}
            {todayCount > 0 ? ` · ${todayCount} logged today` : ''}
          </p>
        </div>
      </header>

      {invite && (
        <div className="card rec">
          <p className="kicker">Friend's game</p>
          <h4>{invite.sportName} vs {invite.players.filter((p) => p.toLowerCase() !== 'you')[0] || 'friend'}</h4>
          <p>{invite.whenISO ? new Date(invite.whenISO).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : 'Time to be set'}{invite.venueName && invite.showVenue ? ` · ${invite.venueName}` : ''}</p>
          <div className="row">
            <button className="btn secondary" onClick={() => goTab('friends')}><Swords size={16} aria-hidden="true" />View invite</button>
          </div>
        </div>
      )}

      <div className="chat">
        <div className="bubble coach"><p>What did you play today? Describe it and I'll draft the session — nothing saves until you confirm.</p></div>

        {msgs.map((m) => (m.role === 'assistant' && !m.text && !m.cards?.length ? null : (
          <div key={m.id}>
            {m.text && <div className={`bubble ${m.role === 'user' ? 'user' : 'coach'}`}><p>{m.text}</p></div>}
            {m.cards?.map((c, i) => <RenderCard key={i} card={c} ctx={ctx} />)}
          </div>
        )))}
        <div ref={bottomRef} />
      </div>

      {panel === 'log' && <Modal label="Log activity" onClose={() => setPanel('none')}><LogForm catalog={catalog} activity={logActivity} setActivity={setLogActivity} duration={logDuration} setDuration={setLogDuration} weight={state.prefs.weightKg} store={store} lockActivity={lockActivity} onClose={() => setPanel('none')} onDraft={(c, pre) => { pushAssistant(pre ? 'Here\'s your draft — details prefilled from your last session. Review and tap Confirm to save.' : 'Here\'s your draft. Review it and tap Confirm to save — nothing is saved yet.', [c]); setPanel('none'); }} /></Modal>}
      {panel === 'timer' && <Modal label="Workout timer" onClose={() => setPanel('none')}><TimerForm catalog={catalog} weight={state.prefs.weightKg} store={store} onClose={() => setPanel('none')} onDraft={(c, mins, pre) => { pushAssistant(pre ? `Workout finished: ${mins} minutes — details prefilled. Review the draft to save it.` : `Workout finished: ${mins} minutes. Review the draft to save it.`, [c]); setPanel('none'); }} /></Modal>}
      {panel === 'plan' && <Modal label="Plan my week" onClose={() => setPanel('none')}><PlanForm catalog={catalog} prefsLowImpact={state.prefs.lowImpact} sessionMinutes={state.prefs.sessionMinutes} store={store} onClose={() => setPanel('none')} onPlan={(goal, sessions, assumptions) => { pushAssistant('Here\'s a draft week. Tell me what to change, or save it.', [{ type: 'schedule', goal, sessions, assumptions }]); setPanel('none'); }} /></Modal>}
      {panel === 'watch' && (
        <Modal label="Sync watch" onClose={() => setPanel('none')}>
          <h3>Sync watch</h3>
          <p>Watch sync uses Android Health Connect in the native app — it isn't available in this web version, and no watch was contacted.</p>
          <p className="dim">What you can do here: log sessions manually and keep estimates labeled as estimates.</p>
          <button className="btn secondary" onClick={() => setPanel('none')}>Close</button>
        </Modal>
      )}
      {autoCard && (
        <Modal label={cardTitle(autoCard)} onClose={() => setAutoCard(null)}>
          <h3>{cardTitle(autoCard)}</h3>
          <CardContent card={autoCard} ctx={ctx} />
          <div className="row">
            <button className="btn secondary" onClick={() => setAutoCard(null)}>Close</button>
          </div>
        </Modal>
      )}

      <div className="today-foot">
        <div className="quick" aria-label="Quick actions">
          {msgs.length === 0 && SUGGESTIONS.map((s) => (
            <button key={s.label} type="button" className="chip" onClick={() => s.run()}>
              {s.label}
            </button>
          ))}
          <button className="chip" onClick={() => void send('I want to log an activity', { present: true, fallback: () => { setLockActivity(false); setPanel('log'); } })}><Plus size={16} aria-hidden="true" />Log activity</button>
          <button className="chip" onClick={() => void send('Start a workout for me', { present: true, fallback: () => setPanel('timer') })}><Timer size={16} aria-hidden="true" />Start workout</button>
          <button className="chip" onClick={() => void send('Sync my watch', { present: true, fallback: () => setPanel('watch') })}><Watch size={16} aria-hidden="true" />Sync watch</button>
          <button className="chip" onClick={() => void send('Plan my week of workouts', { present: true, fallback: () => setPanel('plan') })}><CalendarDays size={16} aria-hidden="true" />Plan my week</button>
        </div>

        {photo && <p className="dim"><Camera size={13} aria-hidden="true" /> Photo attached — it will be sent with your next message. <button className="link" onClick={() => setPhoto(null)}>Remove</button></p>}

        <form className="composer" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
          <div className="composer-attach">
            <label className="iconbtn" title="Attach a photo" aria-label="Attach a photo"><Camera size={18} aria-hidden="true" />
              <input type="file" accept="image/*" hidden aria-hidden="true" tabIndex={-1} onChange={(e) => onPhoto(e.target.files?.[0])} />
            </label>
          </div>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask your coach anything…" aria-label="Message your coach" />
          <button className="btn primary" type="submit" disabled={sending || !input.trim()}><Send size={16} aria-hidden="true" />Send</button>
        </form>
      </div>
    </div>
  );
}

function LogForm({ catalog, activity, setActivity, duration, setDuration, weight, store, lockActivity, onClose, onDraft }: {
  catalog: CatalogActivity[];
  activity: string;
  setActivity: (v: string) => void;
  duration: string;
  setDuration: (v: string) => void;
  weight: number | null;
  store: Store;
  lockActivity: boolean;
  onClose: () => void;
  onDraft: (c: CardData, prefilled: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const aiStatus = useAiPrefill(
    `You are prefilling a "Log activity" form. Reply with ONLY a JSON object, no other text. `
    + `Available activities (id - name): ${catalog.map((a) => `${a.id} - ${a.name}`).join(', ')}. `
    + `User interests: ${store.state.prefs.interests.join(', ') || 'none'}. Usual session: ${store.state.prefs.sessionMinutes} min. `
    + `Recent sessions: ${recentSummary(store)}. Local time: ${new Date().toString()}. `
    + `Pick the most likely activity id and a duration in minutes. Format: {"activity": "<id>", "duration_minutes": <number>}`,
    store,
    (raw) => {
      if (!raw || typeof raw !== 'object') return false;
      const r = raw as Record<string, unknown>;
      let touched = false;
      if (!lockActivity && typeof r.activity === 'string' && catalog.some((a) => a.id === r.activity)) {
        setActivity(r.activity);
        touched = true;
      }
      const mins = Number(r.duration_minutes);
      if (Number.isFinite(mins) && mins > 0) {
        setDuration(String(Math.max(1, Math.min(600, Math.round(mins)))));
        touched = true;
      }
      return touched;
    },
  );
  const submit = async () => {
    setWorking(true);
    setError(null);
    try {
      const prefill = draftScoreFields(catalog, store.state.history, activity);
      const card = await api.draft({
        activity,
        duration_minutes: Number(duration),
        ...(weight ? { weight_kg: weight } : {}),
        ...(Object.keys(prefill).length ? { score_fields: prefill } : {}),
      });
      onDraft(card, Object.keys(prefill).length > 0);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not prepare the draft.');
    } finally {
      setWorking(false);
    }
  };
  return (
    <>
      <h3>Log activity</h3>
      <AiNote status={aiStatus} />
      <label className="field">Activity
        <select value={activity} onChange={(e) => setActivity(e.target.value)}>
          {catalog.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <label className="field">Duration (min)
        <input type="number" inputMode="decimal" value={duration} onChange={(e) => setDuration(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={working} onClick={submit}><Pencil size={16} aria-hidden="true" />{working ? 'Preparing…' : 'Prepare draft'}</button>
      </div>
    </>
  );
}

function TimerForm({ catalog, weight, store, onClose, onDraft }: {
  catalog: CatalogActivity[];
  weight: number | null;
  store: Store;
  onClose: () => void;
  onDraft: (c: CardData, mins: number, prefilled: boolean) => void;
}) {
  const [activity, setActivity] = useState('running');
  const aiStatus = useAiPrefill(
    `You are prefilling a "Workout timer" form. Reply with ONLY a JSON object, no other text. `
    + `Available activities (id - name): ${catalog.map((a) => `${a.id} - ${a.name}`).join(', ')}. `
    + `User interests: ${store.state.prefs.interests.join(', ') || 'none'}. Recent sessions: ${recentSummary(store)}. `
    + `Local time: ${new Date().toString()}. `
    + `Pick the most likely activity id for a workout starting now. Format: {"activity": "<id>"}`,
    store,
    (raw) => {
      if (!raw || typeof raw !== 'object') return false;
      const r = raw as Record<string, unknown>;
      if (typeof r.activity === 'string' && catalog.some((a) => a.id === r.activity)) {
        setActivity(r.activity);
        return true;
      }
      return false;
    },
  );
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gps, setGps] = useState<{ on: boolean; distanceM: number; note: string | null }>({ on: false, distanceM: 0, note: null });
  const startedAt = useRef<string>('');
  const watchId = useRef<number | null>(null);
  const lastPos = useRef<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => () => {
    if (watchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current);
  }, []);

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  const toggleGps = () => {
    if (gps.on) {
      if (watchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      setGps((g) => ({ ...g, on: false }));
      return;
    }
    if (!navigator.geolocation) {
      setGps((g) => ({ ...g, note: 'This browser has no location API — timer only.' }));
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        const prev = lastPos.current;
        lastPos.current = { lat, lon };
        if (prev) {
          const R = 6371000;
          const dLat = (lat - prev.lat) * Math.PI / 180;
          const dLon = (lon - prev.lon) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(prev.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
          const step = 2 * R * Math.asin(Math.sqrt(a));
          if (step > 2 && step < 500) setGps((g) => ({ ...g, distanceM: g.distanceM + step }));
        }
        setGps((g) => ({ ...g, on: true, note: null }));
      },
      () => setGps((g) => ({ ...g, on: false, note: 'Location unavailable — timer continues without GPS.' })),
      { enableHighAccuracy: true },
    );
    watchId.current = id;
  };

  const finish = async () => {
    setRunning(false);
    if (watchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    const mins = Math.max(1, Math.round(elapsed / 60));
    setError(null);
    try {
      const distKm = gps.distanceM / 1000;
      const gpsSports = ['running', 'walking', 'cycling', 'hiking'];
      const prefill = draftScoreFields(catalog, store.state.history, activity);
      if (gpsSports.includes(activity) && distKm >= 0.05) {
        prefill.distance_km = Math.round(distKm * 100) / 100;
      }
      const card = await api.draft({
        activity,
        duration_minutes: mins,
        ...(weight ? { weight_kg: weight } : {}),
        ...(startedAt.current ? { started_at: startedAt.current } : {}),
        ...(Object.keys(prefill).length ? { score_fields: prefill } : {}),
      });
      onDraft(card, mins, Object.keys(prefill).length > 0);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not prepare the draft.');
    }
  };

  const pace = gps.distanceM >= 50 && elapsed > 0
    ? `${Math.floor(elapsed / 60 / (gps.distanceM / 1000))}:${String(Math.floor((elapsed / (gps.distanceM / 1000)) % 60)).padStart(2, '0')} /km`
    : '—';

  return (
    <>
      <h3>Workout timer {running && <span className="tag">{gps.on ? 'Active · GPS on' : 'Active'}</span>}</h3>
      <p className="dim">On-screen timer{!gps.on && ' — no GPS unless you enable it'}. Route points never leave this device.</p>
      <AiNote status={aiStatus} />
      <label className="field">Activity
        <select value={activity} onChange={(e) => setActivity(e.target.value)} disabled={running}>
          {catalog.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <p className="timer">{mmss}</p>
      <p className="timer-sub dim">{(gps.distanceM / 1000).toFixed(2)} km · {pace} · GPS {gps.on ? 'on' : 'off'}</p>
      {gps.note && <p className="dim">{gps.note}</p>}
      {error && <p className="error">{error}</p>}
      <div className="row">
        {!running && elapsed === 0 && <button className="btn primary" onClick={() => { startedAt.current = new Date().toISOString(); setRunning(true); }}><Play size={16} aria-hidden="true" />Start</button>}
        {running && <button className="btn secondary" onClick={() => setRunning(false)}><Pause size={16} aria-hidden="true" />Pause</button>}
        {!running && elapsed > 0 && <button className="btn primary" onClick={() => setRunning(true)}><Play size={16} aria-hidden="true" />Resume</button>}
        {elapsed > 0 && <button className="btn primary" onClick={finish}><Flag size={16} aria-hidden="true" />Finish & draft</button>}
        <button className="btn ghost" onClick={toggleGps}><LocateFixed size={16} aria-hidden="true" />{gps.on ? 'GPS off' : 'Enable GPS'}</button>
        <button className="btn ghost" onClick={onClose}>Close</button>
      </div>
    </>
  );
}

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function PlanForm({ catalog, prefsLowImpact, sessionMinutes, store, onClose, onPlan }: {
  catalog: CatalogActivity[];
  prefsLowImpact: boolean;
  sessionMinutes: number;
  store: Store;
  onClose: () => void;
  onPlan: (goal: string, sessions: { day: string; activity_id: string; minutes: number; note: string }[], assumptions: string[]) => void;
}) {
  const [goal, setGoal] = useState('Move three times this week');
  const [picked, setPicked] = useState<string[]>(['running']);
  const [days, setDays] = useState<string[]>(() => {
    const codes = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const today = new Date().getDay();
    return [0, 1, 2].map((i) => codes[(today + i) % 7]);
  });
  const [minutes, setMinutes] = useState(String(sessionMinutes));
  const [lowImpact, setLowImpact] = useState(prefsLowImpact);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const aiStatus = useAiPrefill(
    `You are prefilling a "Plan my week" form. Reply with ONLY a JSON object, no other text. `
    + `Available activities (id - name): ${catalog.map((a) => `${a.id} - ${a.name}`).join(', ')}. `
    + `User interests: ${store.state.prefs.interests.join(', ') || 'none'}. Usual session: ${sessionMinutes} min. `
    + `Prefers low-impact: ${prefsLowImpact ? 'yes' : 'no'}. Recent sessions: ${recentSummary(store)}. Local time: ${new Date().toString()}. `
    + `Pick a short goal (max 60 chars), 1-4 activity ids, 1-5 weekday codes from mon,tue,wed,thu,fri,sat,sun, and minutes per session. `
    + `Format: {"goal": "...", "activities": ["<id>"], "days": ["mon"], "session_minutes": <number>, "low_impact": <bool>}`,
    store,
    (raw) => {
      if (!raw || typeof raw !== 'object') return false;
      const r = raw as Record<string, unknown>;
      let touched = false;
      if (typeof r.goal === 'string' && r.goal.trim()) {
        setGoal(r.goal.trim().slice(0, 120));
        touched = true;
      }
      if (Array.isArray(r.activities)) {
        const ids = r.activities.filter((a): a is string => typeof a === 'string' && catalog.some((c) => c.id === a)).slice(0, 4);
        if (ids.length) {
          setPicked(ids);
          touched = true;
        }
      }
      if (Array.isArray(r.days)) {
        const ds = r.days.filter((d): d is string => typeof d === 'string' && WEEKDAYS.includes(d)).slice(0, 5);
        if (ds.length) {
          setDays(ds);
          touched = true;
        }
      }
      const mins = Number(r.session_minutes);
      if (Number.isFinite(mins) && mins > 0) {
        setMinutes(String(Math.max(5, Math.min(300, Math.round(mins)))));
        touched = true;
      }
      if (typeof r.low_impact === 'boolean') {
        setLowImpact(r.low_impact);
        touched = true;
      }
      return touched;
    },
  );

  const toggle = (list: string[], v: string, set: (l: string[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const submit = async () => {
    setWorking(true);
    setError(null);
    try {
      const res = await api.schedule({ goal, activities: picked, days_available: days, session_minutes: Number(minutes), low_impact: lowImpact });
      onPlan(res.goal, res.sessions, res.assumptions);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not draft the plan.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <h3>Plan my week</h3>
      <AiNote status={aiStatus} />
      <label className="field">Goal
        <input value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={300} />
      </label>
      <div className="field"><span>Activities</span>
        <div className="chips">
          {catalog.map((a) => (
            <button key={a.id} type="button" className={`chip ${picked.includes(a.id) ? 'on' : ''}`} onClick={() => toggle(picked, a.id, setPicked)}>{a.name}</button>
          ))}
        </div>
      </div>
      <div className="field"><span>Days</span>
        <div className="chips">
          {WEEKDAYS.map((d) => (
            <button key={d} type="button" className={`chip ${days.includes(d) ? 'on' : ''}`} onClick={() => toggle(days, d, setDays)}>{d}</button>
          ))}
        </div>
      </div>
      <label className="field">Minutes per session
        <input type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
      </label>
      <label className="check"><input type="checkbox" checked={lowImpact} onChange={(e) => setLowImpact(e.target.checked)} /> Prefer low-impact</label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={working || picked.length === 0 || days.length === 0} onClick={submit}>
          <CalendarDays size={16} aria-hidden="true" />{working ? 'Drafting…' : 'Draft plan'}
        </button>
      </div>
    </>
  );
}
