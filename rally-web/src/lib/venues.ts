/** Demo venue data for booking. Sample data only — booking is simulated. */

export interface Venue {
  id: string;
  name: string;
  city: string;
  distanceKm: number;
  openUntil: string;
  rating: number;
  reviews: number;
  tags: string[];
  courts: string[];
  slots: { time: string; price: number }[];
}

export const DEMO_VENUES: Venue[] = [
  {
    id: 'riverside-padel',
    name: 'Riverside Padel Club',
    city: 'Jakarta',
    distanceKm: 0.8,
    openUntil: '11 pm',
    rating: 4.8,
    reviews: 212,
    tags: ['Indoor', 'Padel', 'Rental racket'],
    courts: ['Court 1', 'Court 2', 'Court 3', 'Court 4'],
    slots: [
      { time: '6:00', price: 18 }, { time: '7:00', price: 18 }, { time: '8:00', price: 22 },
      { time: '17:00', price: 26 }, { time: '18:00', price: 28 }, { time: '19:00', price: 28 },
    ],
  },
  {
    id: 'greenfield-tennis',
    name: 'Greenfield Tennis Courts',
    city: 'Jakarta',
    distanceKm: 1.4,
    openUntil: '9 pm',
    rating: 4.6,
    reviews: 98,
    tags: ['Outdoor', 'Tennis', 'Clay'],
    courts: ['Court A', 'Court B', 'Court C'],
    slots: [
      { time: '7:00', price: 12 }, { time: '9:00', price: 14 }, { time: '12:00', price: 14 },
      { time: '16:00', price: 16 }, { time: '18:00', price: 20 },
    ],
  },
  {
    id: 'city-sports-hall',
    name: 'City Sports Hall',
    city: 'Jakarta',
    distanceKm: 2.1,
    openUntil: '10 pm',
    rating: 4.4,
    reviews: 301,
    tags: ['Indoor', 'Multi-sport', 'Volleyball'],
    courts: ['Hall 1', 'Hall 2'],
    slots: [
      { time: '8:00', price: 20 }, { time: '10:00', price: 20 }, { time: '14:00', price: 24 },
      { time: '18:00', price: 30 }, { time: '20:00', price: 30 },
    ],
  },
  {
    id: 'senayan-padel',
    name: 'Senayan Padel Club',
    city: 'Jakarta',
    distanceKm: 3.2,
    openUntil: '10 pm',
    rating: 4.7,
    reviews: 156,
    tags: ['Outdoor', 'Padel', 'Coaching'],
    courts: ['Court 1', 'Court 2'],
    slots: [
      { time: '7:00', price: 20 }, { time: '9:00', price: 20 }, { time: '16:00', price: 24 },
      { time: '18:00', price: 30 }, { time: '20:00', price: 30 },
    ],
  },
  {
    id: 'kemang-tennis',
    name: 'Kemang Tennis Center',
    city: 'Jakarta',
    distanceKm: 4.5,
    openUntil: '9 pm',
    rating: 4.5,
    reviews: 89,
    tags: ['Outdoor', 'Tennis', 'Clay'],
    courts: ['Court 1', 'Court 2', 'Court 3'],
    slots: [
      { time: '6:00', price: 10 }, { time: '8:00', price: 12 }, { time: '15:00', price: 14 },
      { time: '17:00', price: 16 }, { time: '19:00', price: 18 },
    ],
  },
];

export function venueById(id: string): Venue | undefined {
  return DEMO_VENUES.find((v) => v.id === id);
}

/** Deterministic "booked" slots so the demo is stable day to day. */
export function slotBooked(venueId: string, dateISO: string, time: string): boolean {
  let h = 0;
  const s = `${venueId}|${dateISO}|${time}`;
  for (let i = 0; i < s.length; i++) h = ((h * 31 + s.charCodeAt(i)) >>> 0);
  return h % 4 === 0;
}

export interface DayOption {
  dateISO: string;
  weekday: string;
  dayNum: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function nextDays(n = 6): DayOption[] {
  const out: DayOption[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push({ dateISO: iso, weekday: WEEKDAYS[d.getDay()], dayNum: String(d.getDate()) });
  }
  return out;
}
