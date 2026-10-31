import { ArrowRight, PawPrint } from 'lucide-react';
import { useState } from 'react';
import type { Prefs, Store } from '../state/store';
import { INTERESTS } from './You';

export function Onboarding({ store }: { store: Store }) {
  const [prefs, setPrefs] = useState<Prefs>(store.state.prefs);

  const toggleInterest = (name: string) =>
    setPrefs((p) => ({
      ...p,
      interests: p.interests.includes(name) ? p.interests.filter((i) => i !== name) : [...p.interests, name],
    }));

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="onboard-title">
      <div className="sheet">
        <h3 id="onboard-title"><PawPrint size={18} aria-hidden="true" /> Welcome to Rally</h3>
        <p className="dim">Tell your coach a little about you — everything is optional and stays on this device.</p>
        <label className="field">Display name
          <input value={prefs.displayName} maxLength={40} onChange={(e) => setPrefs({ ...prefs, displayName: e.target.value })} placeholder="Alex" />
        </label>
        <div className="field"><span>Interests (for recommendations)</span>
          <div className="chips">
            {INTERESTS.map((i) => (
              <button key={i} type="button" className={`chip ${prefs.interests.includes(i) ? 'on' : ''}`} onClick={() => toggleInterest(i)}>{i}</button>
            ))}
          </div>
        </div>
        <label className="field">Usual minutes per session
          <input type="number" value={prefs.sessionMinutes} onChange={(e) => setPrefs({ ...prefs, sessionMinutes: Number(e.target.value) || 45 })} />
        </label>
        <div className="row">
          <button className="btn primary" onClick={() => store.saveOnboarding({ ...prefs, interests: prefs.interests.slice(0, 8) })}>Start coaching<ArrowRight size={16} aria-hidden="true" /></button>
          <button className="btn ghost" onClick={() => store.skipOnboarding()}>Skip</button>
        </div>
        <p className="dim">Just looking? <button className="link" onClick={() => { store.seedDemo(); store.skipOnboarding(); }}>Explore with demo data</button></p>
      </div>
    </div>
  );
}
