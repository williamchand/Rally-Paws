import { Award, Check, ChevronRight, Flame, Footprints, PawPrint, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { BillingStatus } from '../api/types';
import { currentStreak, personalBests, type Store } from '../state/store';
import { Modal } from './bits';
import { Pet } from './Pet';
import { PetView } from './PetView';
import { Closet, Rewards } from './Rewards';

export const INTERESTS = ['running', 'tennis', 'football', 'golf', 'volleyball', 'swimming', 'cycling', 'strength', 'yoga', 'chess', 'esports', 'walking'];

/** Profile single page: pet + stats inline, everything else in modals or one hop away. */
export function You({ store, billing, onPlus }: {
  store: Store;
  billing: BillingStatus | null;
  onPlus: () => void;
}) {
  const { state, clearLocal } = store;
  const [view, setView] = useState<'main' | 'pet' | 'rewards'>('main');
  const [sheet, setSheet] = useState<'none' | 'closet' | 'bests' | 'data'>('none');
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (view === 'pet') {
    return <PetView store={store} onBack={() => setView('main')} onRewards={() => setView('rewards')} />;
  }
  if (view === 'rewards') {
    return <Rewards store={store} onBack={() => setView('pet')} onPlusLocked={onPlus} />;
  }

  const bests = personalBests(state.history);
  const plusActive = state.plus.active;
  const close = () => { setSheet('none'); setConfirming(false); };

  return (
    <div className="screen">
      <header className="topbar">
        <h2>You</h2>
        {plusActive ? <span className="tag plus"><Check size={12} aria-hidden="true" />Plus</span> : <button className="link" onClick={onPlus}><Sparkles size={13} aria-hidden="true" />Plus</button>}
      </header>

      {!plusActive && (
        <section className="card hero">
          <h3>Rally Plus</h3>
          <p className="dim">Your AI coach and deeper progress.</p>
          <button className="btn accent" onClick={onPlus}><Sparkles size={16} aria-hidden="true" />See Plus</button>
        </section>
      )}
      {plusActive && billing && !billing.configured && state.plus.source === 'demo' && (
        <p className="dim"><span className="tag demo">Demo</span> Demo Plus on this device — real billing is planned.</p>
      )}

      <section className="card">
        <Pet xpTotal={state.xpTotal} equipped={state.pet.equipped} />
        <div className="statrow">
          <div className="stat"><strong><Flame size={16} aria-hidden="true" />{currentStreak(state.history)}</strong><span>Day streak</span></div>
          <div className="stat"><strong><Award size={16} aria-hidden="true" />{bests.length}</strong><span>Personal bests</span></div>
          <div className="stat"><strong><Footprints size={16} aria-hidden="true" />{state.history.length}</strong><span>Sessions</span></div>
        </div>
        <button className="btn secondary block" onClick={() => setView('pet')}><PawPrint size={16} aria-hidden="true" />Open pet & activity</button>
      </section>

      <section className="card menu">
        <button type="button" className="menu-row" onClick={() => setSheet('closet')}>
          <span className="grow"><strong>Pet closet</strong> <span className="dim">· {state.pet.equipped.length} worn</span></span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className="menu-row" onClick={() => setSheet('bests')}>
          <span className="grow"><strong>Personal bests</strong> <span className="dim">· {bests.length}</span></span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className="menu-row" onClick={() => setSheet('data')}>
          <span className="grow"><strong>Data & privacy</strong> <span className="dim">· {state.history.length} sessions on this device</span></span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </section>

      {sheet === 'closet' && (
        <Modal label="Pet closet" onClose={close}>
          <h3>Pet closet</h3>
          <Closet store={store} onPlusLocked={onPlus} />
          <div className="row">
            <button className="btn secondary" onClick={close}>Done</button>
          </div>
        </Modal>
      )}

      {sheet === 'bests' && (
        <Modal label="Personal bests" onClose={close}>
          <h3>Personal bests</h3>
          {bests.length === 0 ? (
            <p className="dim">Log a session to set baselines.</p>
          ) : (
            <ul className="plain">
              {bests.map((b, i) => (
                <li key={i}><strong>{b.sport}</strong> · {b.metric}: {b.value} {b.unit}</li>
              ))}
            </ul>
          )}
          <div className="row">
            <button className="btn secondary" onClick={close}>Close</button>
          </div>
        </Modal>
      )}

      {sheet === 'data' && (
        <Modal label="Data and privacy" onClose={close}>
          <h3>Data & privacy</h3>
          <p className="dim">Local: preferences, history, XP, pet, quests, matches, bookings ({state.history.length} sessions on this device). The server keeps no activity data.</p>
          {notice && <p role="status">{notice}</p>}
          <div className="row">
            <button className="btn secondary" onClick={() => { store.seedDemo(); setNotice('Demo data loaded.'); }}><Sparkles size={16} aria-hidden="true" />Load demo data</button>
          </div>
          {!confirming ? (
            <div className="row">
              <button className="btn danger" onClick={() => setConfirming(true)}><Trash2 size={16} aria-hidden="true" />Delete my local data</button>
            </div>
          ) : (
            <div className="row">
              <span>Erase everything on this device?</span>
              <button className="btn danger" onClick={() => { clearLocal(); setConfirming(false); setNotice('Local data deleted.'); }}><Trash2 size={16} aria-hidden="true" />Yes, erase</button>
              <button className="btn ghost" onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          )}
          <div className="row">
            <button className="btn secondary" onClick={close}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
