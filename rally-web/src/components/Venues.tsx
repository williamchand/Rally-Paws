import { CalendarCheck, Check, ChevronLeft, Clock, MapPin, Minus, Plus, Star, Users } from 'lucide-react';
import { useState } from 'react';
import { nextDays, slotBooked, venueById } from '../lib/venues';
import type { Store } from '../state/store';
import { ScrollTop } from './bits';

export function VenueView({ store, venueId, onBack }: {
  store: Store;
  venueId: string;
  onBack: () => void;
}) {
  const venue = venueById(venueId);
  const days = nextDays(6);
  const firstAvail = (dateISO: string) =>
    venue?.slots.find((s) => !slotBooked(venue.id, dateISO, s.time))?.time ?? null;
  const [day, setDay] = useState(days[0].dateISO);
  const [time, setTime] = useState<string | null>(() => firstAvail(days[0].dateISO));
  const [court, setCourt] = useState('');
  const [players, setPlayers] = useState(2);
  const [booked, setBooked] = useState(false);

  if (!venue) {
    return (
      <div className="screen">
        <ScrollTop />
        <div className="card"><p>Unknown venue.</p><button className="btn secondary" onClick={onBack}>Back</button></div>
      </div>
    );
  }

  const slot = venue.slots.find((s) => s.time === time) || null;
  const total = slot ? slot.price : 0;

  const book = () => {
    if (!slot) return;
    store.addBooking({
      id: `b-${Date.now()}`,
      venueId: venue.id,
      venueName: venue.name,
      dateISO: day,
      time: slot.time,
      court: court || venue.courts[0],
      players,
      pricePerPerson: total / players,
      createdAt: new Date().toISOString(),
    });
    setBooked(true);
  };

  if (booked && slot) {
    const dayLabel = days.find((d) => d.dateISO === day);
    return (
      <div className="screen">
        <ScrollTop />
        <div className="card receipt">
          <p className="kicker"><Check size={12} aria-hidden="true" /> Booked · demo</p>
          <h3>{venue.name}</h3>
          <p><strong>{dayLabel?.weekday} {dayLabel?.dayNum} · {slot.time}</strong> · {court || venue.courts[0]}</p>
          <p className="dim">${total.toFixed(2)} total · ${(total / players).toFixed(2)} each for {players} players · simulated booking, no charge.</p>
          <div className="row">
            <button className="btn primary" onClick={onBack}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <ScrollTop />
      <header className="topbar">
        <button className="btn ghost" onClick={onBack} aria-label="Back"><ChevronLeft size={16} aria-hidden="true" />Back</button>
        <span className="tag demo">Demo venues</span>
      </header>

      <div className="card">
        <h2 className="display">{venue.name}</h2>
        <p className="meta-line dim"><MapPin size={13} aria-hidden="true" />{venue.city} · {venue.distanceKm} km · <Clock size={13} aria-hidden="true" />Open until {venue.openUntil} · <Star size={13} aria-hidden="true" />{venue.rating} ({venue.reviews})</p>
        <div>{venue.tags.map((t) => <span className="tag" key={t}>{t}</span>)}</div>
      </div>

      <section className="card">
        <h3>Pick a date</h3>
        <div className="chips">
          {days.map((d) => (
            <button key={d.dateISO} type="button" className={`chip ${day === d.dateISO ? 'on' : ''}`} onClick={() => { setDay(d.dateISO); setTime(firstAvail(d.dateISO)); }}>
              {d.weekday} {d.dayNum}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Available times · 60 min</h3>
        <div className="slotrow">
          {venue.slots.map((s) => {
            const isBooked = slotBooked(venue.id, day, s.time);
            return (
              <button
                key={s.time}
                type="button"
                disabled={isBooked}
                className={`slot${time === s.time ? ' on' : ''}${isBooked ? ' booked' : ''}`}
                onClick={() => setTime(s.time)}
                aria-label={`${s.time}, $${s.price}${isBooked ? ', booked' : ''}`}
              >
                <strong>{s.time}</strong>
                <small>{isBooked ? 'Booked' : `$${s.price}`}</small>
              </button>
            );
          })}
        </div>
        <label className="field">Court
          <select value={court} onChange={(e) => setCourt(e.target.value)}>
            <option value="">Any court</option>
            {venue.courts.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </section>

      <section className="card">
        <h3>Players</h3>
        <div className="row">
          <button className="btn secondary" disabled={players <= 1} onClick={() => setPlayers((p) => p - 1)} aria-label="Fewer players"><Minus size={16} aria-hidden="true" /></button>
          <strong><Users size={15} aria-hidden="true" /> {players}</strong>
          <button className="btn secondary" disabled={players >= 8} onClick={() => setPlayers((p) => p + 1)} aria-label="More players"><Plus size={16} aria-hidden="true" /></button>
          <span className="dim">+Invite friends · split the cost</span>
        </div>
      </section>

      <section className="card">
        <div className="row">
          <div className="grow">
            <p className="display">${total.toFixed(2)}</p>
            <p className="dim">{slot ? `${days.find((d) => d.dateISO === day)?.weekday} ${days.find((d) => d.dateISO === day)?.dayNum} · ${slot.time}` : 'Pick a time'} · simulated · no charge</p>
          </div>
        </div>
        <button className="btn primary block" disabled={!slot} onClick={book}><CalendarCheck size={16} aria-hidden="true" />Book court</button>
      </section>
    </div>
  );
}
