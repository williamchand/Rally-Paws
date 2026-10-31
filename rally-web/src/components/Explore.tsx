import {
  Activity, Bike, Crown, Dumbbell, Flag, Flower2, Footprints, Gamepad2, Mountain,
  PersonStanding, Target, Trophy, Volleyball, WavesLadder, type LucideIcon,
} from 'lucide-react';
import { ArrowRight, MapPin, Search, Star } from 'lucide-react';
import { useState } from 'react';
import type { CatalogActivity } from '../api/types';
import { DEMO_VENUES } from '../lib/venues';
import { personalBests, type Store } from '../state/store';
import { VenueView } from './Venues';

const SPORT_STYLE: Record<string, { Icon: LucideIcon; fg: string; bg: string }> = {
  running: { Icon: Footprints, fg: '#1f6f5c', bg: '#d9ebe4' },
  walking: { Icon: PersonStanding, fg: '#3fa34d', bg: '#dff0e1' },
  cycling: { Icon: Bike, fg: '#ff7a45', bg: '#ffe6d8' },
  swimming: { Icon: WavesLadder, fg: '#2e9bc6', bg: '#ddf0f9' },
  strength: { Icon: Dumbbell, fg: '#e5484d', bg: '#fbdde0' },
  football: { Icon: Trophy, fg: '#b7791f', bg: '#f7ebcf' },
  tennis: { Icon: Target, fg: '#65a30d', bg: '#e9f5d3' },
  golf: { Icon: Flag, fg: '#2f9e44', bg: '#ddf0e2' },
  volleyball: { Icon: Volleyball, fg: '#0ea5a5', bg: '#d7f0f0' },
  yoga: { Icon: Flower2, fg: '#e5488f', bg: '#fbdce9' },
  hiking: { Icon: Mountain, fg: '#8b5e34', bg: '#efe3d3' },
  chess: { Icon: Crown, fg: '#14181f', bg: '#e4e1d8' },
  esports: { Icon: Gamepad2, fg: '#3b82c4', bg: '#dce9f7' },
  other: { Icon: Activity, fg: '#7c8591', bg: '#ece8de' },
};

const styleFor = (id: string) => SPORT_STYLE[id] || SPORT_STYLE.other;

export function Explore({ store, catalog, onQuickLog, venueId, onVenue }: {
  store: Store;
  catalog: CatalogActivity[];
  onQuickLog: (sportId: string) => void;
  venueId: string | null;
  onVenue: (id: string | null) => void;
}) {
  const [venueQuery, setVenueQuery] = useState('');
  const [venueSport, setVenueSport] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  if (venueId) {
    return <VenueView store={store} venueId={venueId} onBack={() => onVenue(null)} />;
  }

  const bests = personalBests(store.state.history);
  const badgeFor = (a: CatalogActivity): string | null => {
    const entries = store.state.history.filter((h) => h.sport === a.id);
    if (entries.length === 0) return 'NEW';
    if (bests.some((b) => b.sport === a.name)) return 'PB';
    const days = Math.floor((Date.now() - new Date(entries[0].startedAt).getTime()) / 86400000);
    return days <= 0 ? 'Today' : `${days}d`;
  };

  // Sports users can tap to filter venues — derived from demo venue tags.
  const venueSports = ['Padel', 'Tennis', 'Volleyball'];

  const q = venueQuery.trim().toLowerCase();
  const showVenues = searched || venueSport !== null;
  const results = !showVenues ? [] : DEMO_VENUES.filter((v) =>
    (!venueSport || v.tags.some((t) => t.toLowerCase() === venueSport.toLowerCase())) &&
    (!q || v.name.toLowerCase().includes(q) || v.city.toLowerCase().includes(q) ||
      v.tags.some((t) => t.toLowerCase().includes(q))));

  return (
    <div className="screen">
      <div className="explore-hero">
        <h2>Explore</h2>
      </div>

      <p className="dim">Tap a sport for an instant prefilled draft — one tap, one confirm.</p>
      {catalog.length === 0 && <p className="dim">Sports load from the server — check the connection.</p>}
      <section aria-label="Log a sport">
        <div className="sportgrid">
          {catalog.map((a) => {
            const style = styleFor(a.id);
            const badge = badgeFor(a);
            return (
              <button key={a.id} type="button" className="sporttile" onClick={() => onQuickLog(a.id)} aria-label={`Log ${a.name}`}>
                {badge && <span className="sportbadge">{badge}</span>}
                <span className="sportic" style={{ color: style.fg, background: style.bg }}>
                  <style.Icon size={22} aria-hidden="true" />
                </span>
                <span className="sportname">{a.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h3>Find a venue <span className="tag demo">Demo</span></h3>
        <div className="chips" aria-label="Filter venues by sport">
          <button
            type="button"
            className={`chip ${venueSport === null ? 'on' : ''}`}
            onClick={() => setVenueSport(null)}
          >
            All sports
          </button>
          {venueSports.map((s) => (
            <button
              key={s}
              type="button"
              className={`chip ${venueSport === s ? 'on' : ''}`}
              onClick={() => setVenueSport((cur) => (cur === s ? null : s))}
              aria-pressed={venueSport === s}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="row">
          <input
            value={venueQuery}
            onChange={(e) => setVenueQuery(e.target.value)}
            placeholder="Padel courts in Jakarta"
            aria-label="Venue search"
          />
          <button className="btn secondary" onClick={() => setSearched(true)}><Search size={16} aria-hidden="true" />Search</button>
        </div>
        <p className="dim">Tap a sport to filter, or search by name. Sample venue list — booking is simulated, no real availability.</p>
        {showVenues && results.length === 0 && <p className="dim">No demo venues match{venueSport ? ` ${venueSport}` : ''}{venueQuery.trim() ? ` "${venueQuery.trim()}"` : ''}.</p>}
        {results.map((v) => (
          <div className="quest" key={v.id}>
            <div className="grow">
              <p><strong>{v.name}</strong></p>
              <p className="meta-line dim"><MapPin size={13} aria-hidden="true" />{v.city} · {v.distanceKm} km · <Star size={13} aria-hidden="true" />{v.rating} ({v.reviews}) · {v.tags.join(' · ')}</p>
            </div>
            <button className="btn secondary" onClick={() => onVenue(v.id)}>View<ArrowRight size={16} aria-hidden="true" /></button>
          </div>
        ))}
      </section>
    </div>
  );
}
