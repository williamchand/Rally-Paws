import { ChevronLeft, ChevronRight, Heart, Moon, Trophy, Zap } from 'lucide-react';
import { useState } from 'react';
import { levelFor, petMeters, petMood, petRestNote, PET_NAME, type Store } from '../state/store';
import { ActivitySections } from './Activity';
import { Meter, Modal, ScrollTop } from './bits';
import { Pet } from './Pet';
import { Closet } from './Rewards';

/** Single page for pet + activity. Summaries inline, details in modals. */
export function PetView({ store, onBack, onRewards }: {
  store: Store;
  onBack: () => void;
  onRewards: () => void;
}) {
  const { state } = store;
  const [closetOpen, setClosetOpen] = useState(false);
  const lv = levelFor(state.xpTotal);
  const meters = petMeters(state.history);
  const restNote = petRestNote(meters);

  return (
    <div className="screen">
      <ScrollTop />
      <header className="topbar">
        <button className="btn ghost" onClick={onBack} aria-label="Back"><ChevronLeft size={16} aria-hidden="true" />Back</button>
      </header>

      <div className="card">
        <p className="dim">{state.xpTotal.toLocaleString()} XP</p>
        <h2 className="display">{PET_NAME}</h2>
        <p className="dim">Lv {lv.level} · {petMood(meters)}{restNote ? ` · ${restNote}` : ''}</p>
        <Pet xpTotal={state.xpTotal} size={160} equipped={state.pet.equipped} />
        <Meter label="Energy" value={meters.energy} icon={<Zap size={13} aria-hidden="true" />} />
        <Meter label="Joy" value={meters.joy} icon={<Heart size={13} aria-hidden="true" />} />
        <Meter label="Rest" value={meters.rest} icon={<Moon size={13} aria-hidden="true" />} />
        <p className="dim">Powered by your logged activity — no feeding needed. Train and Rally thrives; rest days keep it rested.</p>
      </div>

      <section>
        <h3 className="section-title">Activity</h3>
        <ActivitySections store={store} />
      </section>

      <section className="card menu">
        <button type="button" className="menu-row" onClick={() => setClosetOpen(true)}>
          <span className="grow"><strong>Pet closet</strong> <span className="dim">· {state.pet.equipped.length} worn</span></span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </section>

      <section className="card">
        <h3>Rest days are safe.</h3>
        <p className="dim">Rally never loses progress when you take a break.</p>
        <button className="btn primary block" onClick={onRewards}><Trophy size={16} aria-hidden="true" />See rewards & quests</button>
      </section>

      {closetOpen && (
        <Modal label="Pet closet" onClose={() => setClosetOpen(false)}>
          <h3>Pet closet</h3>
          <p className="dim">Tap an owned look — your pet wears it everywhere.</p>
          <Closet store={store} />
          <div className="row">
            <button className="btn secondary" onClick={() => setClosetOpen(false)}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
