import { ArrowRight, Check, Crown, RotateCcw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { BillingStatus } from '../api/types';
import type { Store } from '../state/store';

const FEATURES = [
  'AI coach & adaptive weekly plans',
  'Deeper trends & goal tracking',
  'Challenge & team tools',
  'More pet looks & seasonal quests',
];

export function Paywall({ store, billing, onRefreshBilling, onClose, onWelcome }: {
  store: Store;
  billing: BillingStatus | null;
  onRefreshBilling: () => Promise<boolean>;
  onClose: () => void;
  onWelcome: () => void;
}) {
  const [pkg, setPkg] = useState<'annual' | 'monthly'>('annual');
  const [confirming, setConfirming] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const demoPurchase = () => {
    store.setPlus({ source: 'demo', active: true, checkedAt: new Date().toISOString() });
    onWelcome();
  };

  const restore = async () => {
    setRestoring(true);
    setNotice(null);
    try {
      const active = await onRefreshBilling();
      if (active) {
        store.setPlus({ source: 'revenuecat', active: true, checkedAt: new Date().toISOString() });
        onWelcome();
      } else if (billing && !billing.configured) {
        setNotice('No purchases to restore: billing is in demo mode (no RevenueCat key on the server).');
      } else {
        setNotice('No active Plus entitlement found for this device.');
      }
    } catch {
      setNotice('Could not reach the server. Try again.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="plus-title">
      <div className="sheet">
        <h2 className="display" id="plus-title"><Crown size={26} aria-hidden="true" /> Rally Plus</h2>
        <p className="dim">Your AI coach and deeper progress.</p>
        {FEATURES.map((f) => (
          <div className="check-line" key={f}><span className="tick" aria-hidden="true"><Check size={13} aria-hidden="true" /></span><span>{f}</span></div>
        ))}

        <button type="button" className={`pkg${pkg === 'annual' ? ' on' : ''}`} onClick={() => setPkg('annual')} aria-pressed={pkg === 'annual'}>
          <span className="best"><span className="tag plus">Best value</span></span>
          <strong>Annual</strong>
          <p className="dim">Default offering · $rc_annual</p>
        </button>
        <button type="button" className={`pkg${pkg === 'monthly' ? ' on' : ''}`} onClick={() => setPkg('monthly')} aria-pressed={pkg === 'monthly'}>
          <strong>Monthly</strong>
          <p className="dim">Default offering · $rc_monthly</p>
        </button>

        {!confirming ? (
          <div className="row">
            <button className="btn primary grow" onClick={() => setConfirming(true)}>Continue<ArrowRight size={16} aria-hidden="true" /></button>
            <button className="btn ghost" onClick={onClose}>Not now</button>
          </div>
        ) : (
          <div className="card">
            <p><strong>Demo purchase — no charge will be made.</strong></p>
            <p className="dim">Real billing via RevenueCat is planned and labelled as such. Continuing unlocks Plus on this device only.</p>
            <div className="row">
              <button className="btn primary" onClick={demoPurchase}><Check size={16} aria-hidden="true" />Confirm demo</button>
              <button className="btn ghost" onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          </div>
        )}

        {notice && <p role="status">{notice}</p>}
        <div className="row">
          <button className="link" onClick={restore} disabled={restoring}><RotateCcw size={13} aria-hidden="true" />{restoring ? 'Restoring…' : 'Restore purchases'}</button>
        </div>
        <p className="dim">Payments via RevenueCat · Renews until cancelled · History and items stay if you cancel.</p>
        <p className="dim">Billing powered by RevenueCat.</p>
      </div>
    </div>
  );
}

export function PlusWelcome({ store, billing, onClose, onMeetCoach }: {
  store: Store;
  billing: BillingStatus | null;
  onClose: () => void;
  onMeetCoach: () => void;
}) {
  const verified = billing?.active === true && billing.source === 'revenuecat';
  const cancelDemo = () => {
    store.setPlus({ source: 'none', active: false, checkedAt: null });
    onClose();
  };

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="sheet">
        <h2 className="display" id="welcome-title"><Sparkles size={26} aria-hidden="true" /> Welcome to Plus</h2>
        <p>Entitlement “plus” is active. Your AI coach is ready.</p>
        {verified ? (
          <p className="dim">Verified by RevenueCat.</p>
        ) : (
          <p className="dim"><span className="tag demo">Demo</span> Demo entitlement on this device — real billing is planned.</p>
        )}
        <p className="dim">Manage or cancel anytime. Your history and earned items always stay.</p>
        <div className="row">
          <button className="btn primary grow" onClick={onMeetCoach}>Meet my coach</button>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>
        {store.state.plus.source === 'demo' && (
          <div className="row">
            <button className="link" onClick={cancelDemo}>Cancel demo Plus</button>
          </div>
        )}
      </div>
    </div>
  );
}
