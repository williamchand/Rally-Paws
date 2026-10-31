import { Compass, House, Salad, User as UserIcon, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { api, appUserId } from './api/client';
import type { BillingStatus, CatalogActivity } from './api/types';
import { Explore } from './components/Explore';
import { Food } from './components/Food';
import { Friends } from './components/Friends';
import { SharedMatchView } from './components/Matchup';
import { Onboarding } from './components/Onboarding';
import { Paywall, PlusWelcome } from './components/Paywall';
import { Today } from './components/Today';
import { You } from './components/You';
import { useStore, type Matchup } from './state/store';

type Tab = 'today' | 'explore' | 'food' | 'friends' | 'you';

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'today', label: 'Today', Icon: House },
  { id: 'explore', label: 'Explore', Icon: Compass },
  { id: 'food', label: 'Food', Icon: Salad },
  { id: 'friends', label: 'Friends', Icon: Users },
  { id: 'you', label: 'You', Icon: UserIcon },
];

export function App() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>('today');
  const [venueId, setVenueId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogActivity[]>([]);
  const [backendDown, setBackendDown] = useState(false);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [plusView, setPlusView] = useState<'paywall' | 'welcome' | null>(null);
  const [quickSport, setQuickSport] = useState<string | null>(null);
  const [quickNonce, setQuickNonce] = useState(0);
  const [shareHash, setShareHash] = useState<string | null>(
    () => (location.hash.startsWith('#m=') ? location.hash : null));

  useEffect(() => {
    const onHash = () => setShareHash(location.hash.startsWith('#m=') ? location.hash : null);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const refreshBilling = useCallback(async (): Promise<boolean> => {
    try {
      const status = await api.billing(appUserId());
      setBilling(status);
      return status.active;
    } catch {
      return false;
    }
  }, []);

  const boot = () => {
    // Cold starts (free-tier sleep) need patience: retry before crying wolf.
    const delays = [0, 2000, 5000, 10000, 15000, 20000];
    void (async () => {
      for (let i = 0; i < delays.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, delays[i]));
        try {
          await api.health();
          const c = await api.catalog();
          setCatalog(c.activities);
          setBackendDown(false);
          return;
        } catch {
          /* keep retrying */
        }
      }
      setBackendDown(true);
    })();
    void refreshBilling();
  };

  useEffect(() => {
    if (new URLSearchParams(location.search).get('demo') === 'seed') {
      store.seedDemo();
    }
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goQuickLog = (sportId: string) => {
    setQuickSport(sportId);
    setQuickNonce((n) => n + 1);
    setTab('today');
    window.scrollTo({ top: 0 });
  };

  const goTab = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  const viewVenue = (id: string) => {
    setVenueId(id);
    goTab('explore');
  };

  const openPlus = () => setPlusView(store.state.plus.active ? 'welcome' : 'paywall');

  const clearShareHash = () => {
    history.replaceState(null, '', location.pathname + location.search);
    setShareHash(null);
  };

  const saveSharedMatch = (m: Matchup) => {
    if (!store.state.matches.some((x) => x.token === m.token)) {
      store.addMatchup(m);
    }
    clearShareHash();
    goTab('friends');
  };

  return (
    <div className="app">
      {backendDown && (
        <div className="banner">
          {location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? (
            <span>Backend unreachable — start it with <code>uvicorn main:app --port 8000</code> in <code>backend/</code>.</span>
          ) : (
            <span>Couldn't reach the server — it may be waking up. Saved data on this device is fine.</span>
          )}
          <button className="btn ghost" onClick={boot}>Retry</button>
        </div>
      )}
      {!store.state.onboarded && <Onboarding store={store} />}
      {plusView === 'paywall' && (
        <Paywall store={store} billing={billing} onRefreshBilling={refreshBilling}
          onClose={() => setPlusView(null)} onWelcome={() => setPlusView('welcome')} />
      )}
      {plusView === 'welcome' && (
        <PlusWelcome store={store} billing={billing}
          onClose={() => setPlusView(null)} onMeetCoach={() => { setPlusView(null); goTab('today'); }} />
      )}
      <main>
        {shareHash ? (
          <SharedMatchView hash={shareHash} revoked={store.state.revoked} onSave={saveSharedMatch} onDismiss={clearShareHash} />
        ) : (
          <>
            {tab === 'today' && <Today store={store} catalog={catalog} quickSport={quickSport} quickSportNonce={quickNonce} goTab={goTab} onViewVenue={viewVenue} />}
            {tab === 'explore' && <Explore store={store} catalog={catalog} onQuickLog={goQuickLog} venueId={venueId} onVenue={setVenueId} />}
            {tab === 'food' && <Food store={store} />}
            {tab === 'friends' && <Friends store={store} />}
            {tab === 'you' && <You store={store} billing={billing} onPlus={openPlus} />}
          </>
        )}
      </main>
      <nav className="tabbar" aria-label="Primary">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id && !shareHash ? 'on' : ''} onClick={() => { clearShareHash(); goTab(t.id); }} aria-label={t.label} aria-current={tab === t.id && !shareHash ? 'page' : undefined}>
            <t.Icon size={23} aria-hidden="true" />
          </button>
        ))}
      </nav>
    </div>
  );
}
