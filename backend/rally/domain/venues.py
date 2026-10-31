"""Demo venue dataset for the find_venues tool. Sample data only.

IDs are shared with the web app's venue details (rally-web/src/lib/venues.ts):
keep them in sync when adding venues. Real provider search is planned.
"""

from __future__ import annotations

VENUES: list[dict] = [
    {"id": "riverside-padel", "name": "Riverside Padel Club", "city": "Jakarta",
     "sports": ["padel"], "tags": ["Indoor", "Padel", "Rental racket"],
     "distance_km": 0.8, "rating": 4.8, "reviews": 212},
    {"id": "greenfield-tennis", "name": "Greenfield Tennis Courts", "city": "Jakarta",
     "sports": ["tennis"], "tags": ["Outdoor", "Tennis", "Clay"],
     "distance_km": 1.4, "rating": 4.6, "reviews": 98},
    {"id": "city-sports-hall", "name": "City Sports Hall", "city": "Jakarta",
     "sports": ["volleyball", "football", "basketball"],
     "tags": ["Indoor", "Multi-sport", "Volleyball"],
     "distance_km": 2.1, "rating": 4.4, "reviews": 301},
    {"id": "senayan-padel", "name": "Senayan Padel Club", "city": "Jakarta",
     "sports": ["padel"], "tags": ["Outdoor", "Padel", "Coaching"],
     "distance_km": 3.2, "rating": 4.7, "reviews": 156},
    {"id": "kemang-tennis", "name": "Kemang Tennis Center", "city": "Jakarta",
     "sports": ["tennis"], "tags": ["Outdoor", "Tennis", "Clay"],
     "distance_km": 4.5, "rating": 4.5, "reviews": 89},
]

SPORT_ALIASES = {
    "padel": "padel",
    "tennis": "tennis",
    "volley": "volleyball",
    "volleyball": "volleyball",
    "soccer": "football",
    "football": "football",
    "basket": "basketball",
    "basketball": "basketball",
}

_STOPWORDS = frozenset({"near", "me", "nearby", "around", "any", "a", "the", "in", "at", "for", "to"})


def _tokens(query: str) -> list[str]:
    return [t for t in query.lower().split() if t and t not in _STOPWORDS]


def search_venues(sport: str | None = None, city: str | None = None,
                  query: str | None = None, limit: int = 5) -> list[dict]:
    """Filter the demo dataset. Empty filters return everything, nearest first."""
    want_sport = SPORT_ALIASES.get((sport or "").strip().lower(), None) if sport else None
    if sport and want_sport is None:
        return []
    want_city = (city or "").strip().lower() or None
    tokens = _tokens(query or "")
    hits = []
    for venue in VENUES:
        if want_city and want_city not in venue["city"].lower():
            continue
        if want_sport and want_sport not in venue["sports"]:
            continue
        if tokens:
            haystack = " ".join([venue["name"], venue["city"],
                                 *venue["sports"], *venue["tags"]]).lower()
            if not all(t in haystack for t in tokens):
                continue
        hits.append(venue)
    hits.sort(key=lambda v: v["distance_km"])
    return hits[:max(1, limit)]
