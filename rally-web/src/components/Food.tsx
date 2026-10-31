import { ChefHat, Clock, RefreshCw, Search, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { ApiError } from '../api/types';
import { randomMeal, searchMeals, type Recipe } from '../lib/meals';
import type { Store } from '../state/store';
import { Modal } from './bits';
import { coachContext } from './Today';

interface Meal {
  name: string;
  why: string;
  prepMin: number | null;
  tags: string[];
  ingredients: { name: string; measure: string }[];
  steps: string[];
}

function parseIngredientList(raw: unknown): { name: string; measure: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { name: string; measure: string }[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const name = item.trim().slice(0, 60);
      if (name) out.push({ name, measure: '' });
    } else if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      const name = typeof o.name === 'string' ? o.name.trim().slice(0, 60) : '';
      const measure = typeof o.measure === 'string' ? o.measure.trim().slice(0, 40) : '';
      if (name) out.push({ name, measure });
    }
    if (out.length >= 10) break;
  }
  return out;
}

function parseSteps(raw: unknown): string[] {
  if (typeof raw === 'string') {
    return raw.split(/\r?\n/).map((s) => s.trim().slice(0, 300)).filter(Boolean).slice(0, 8);
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
    .map((s) => s.trim().slice(0, 300))
    .slice(0, 8);
}

function parseMeal(raw: unknown): Meal | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== 'string' || !r.name.trim()) return null;
  const prep = Number(r.prep_min);
  return {
    name: r.name.trim().slice(0, 80),
    why: typeof r.why === 'string' ? r.why.trim().slice(0, 200) : '',
    prepMin: Number.isFinite(prep) && prep > 0 ? Math.round(prep) : null,
    tags: Array.isArray(r.tags)
      ? r.tags.filter((t): t is string => typeof t === 'string' && t.trim() !== '').slice(0, 4)
      : [],
    ingredients: parseIngredientList(r.ingredients),
    steps: parseSteps(r.steps ?? r.instructions),
  };
}

/** Build a full recipe details page from an AI-generated meal (no lookup needed). */
function mealToRecipe(meal: Meal): Recipe {
  const slug = meal.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'meal';
  return {
    id: `ai-${slug}`,
    name: meal.name,
    category: '',
    area: '',
    instructions: meal.steps.join('\n'),
    image: '',
    youtube: '',
    tags: meal.tags,
    ingredients: meal.ingredients.map((ing) => ({ name: ing.name, measure: ing.measure })),
  };
}

function tryLine(line: string): Meal | null {
  const t = line.trim();
  if (!t || t.startsWith('```')) return null;
  try {
    return parseMeal(JSON.parse(t) as unknown);
  } catch {
    return null;
  }
}

export function Food({ store }: { store: Store }) {
  const { state } = store;
  const [meals, setMeals] = useState<Meal[]>([]);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Recipe[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [recipeNotice, setRecipeNotice] = useState<string | null>(null);
  const [cooking, setCooking] = useState<string | null>(null);

  const last = state.history[0];
  const week = state.history.filter((h) => Date.now() - new Date(h.startedAt).getTime() < 7 * 86400000);
  const weekMin = week.reduce((s, h) => s + h.durationMin, 0);
  const contextLine = last
    ? `After your ${last.durationMin}-min ${last.sportName.toLowerCase()} · ${week.length} session${week.length === 1 ? '' : 's'} this week`
    : 'Rest day · no sessions logged yet';

  useEffect(() => {
    let alive = true;
    let buf = '';
    const seen = new Set<string>();
    setMeals([]);
    setError(null);
    setLive(true);
    const goal = state.schedules[0]?.goal;
    const prompt =
      `You are suggesting meals for the Rally app. Reply with one JSON object per line (NDJSON) and nothing else — no intro, no code fences, no trailing text. `
      + `Eater: ${state.prefs.vegetarian ? 'vegetarian' : 'no dietary restriction'}. `
      + `Recent activity: ${state.history.slice(0, 3).map((h) => `${h.sportName} ${h.durationMin}min`).join('; ') || 'none yet'}. `
      + `This week: ${week.length} sessions, ${weekMin} min total. `
      + `Goal: ${goal || 'none'}. Local time: ${new Date().toString()}. `
      + `Suggest 3-4 meals suited to right now (recovery fuel after training, light balanced eating on rest days). `
      + `Each line must be a full recipe details page: {"name": "<meal>", "why": "<one short sentence>", "prep_min": <number>, "tags": ["<short-tag>"], `
      + `"ingredients": [{"name": "<ingredient>", "measure": "<amount>"}], "steps": ["<step 1>", "<step 2>"]}. `
      + `Include 4-6 ingredients with measures and 3-5 short steps per meal.`;
    const pushLine = (line: string) => {
      const meal = tryLine(line);
      if (meal && !seen.has(meal.name.toLowerCase())) {
        seen.add(meal.name.toLowerCase());
        setMeals((m) => [...m, meal]);
      }
    };
    const stream = api.chatStream(prompt, [], coachContext(store), (e) => {
      if (!alive) return;
      if (e.type === 'delta' && e.text) {
        buf += e.text;
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) pushLine(line);
      } else if (e.type === 'done') {
        if (e.reply !== undefined) buf = e.reply;
        for (const line of buf.split('\n')) pushLine(line);
        buf = '';
        // Lenient fallback: whole reply as one JSON value with meals.
        setMeals((m) => {
          if (m.length > 0 || !e.reply) return m;
          try {
            const v = JSON.parse(e.reply) as unknown;
            const arr = Array.isArray(v) ? v : (v as { meals?: unknown }).meals;
            const found = (Array.isArray(arr) ? arr : [v]).map(parseMeal).filter((x): x is Meal => x !== null);
            return found.length ? found : m;
          } catch {
            return m;
          }
        });
      } else if (e.type === 'error') {
        setError(e.code === 'model_not_configured'
          ? 'The coach is not connected: the server has no MODEL_API_KEY. Recipes below still work — ask your host to set the key for AI picks.'
          : (e.message || 'Could not load food ideas.'));
      }
    });
    stream.done.then(() => {
      if (alive) setLive(false);
    }).catch((e) => {
      if (!alive) return;
      setLive(false);
      setError(e instanceof ApiError ? e.message : 'Could not reach the Rally server. Recipes below still work.');
    });
    return () => { alive = false; stream.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, state.prefs.vegetarian]);

  const runSearch = async (q: string) => {
    const term = q.trim();
    if (!term || searching) return;
    setSearching(true);
    setSearched(true);
    setRecipeNotice(null);
    try {
      setResults(await searchMeals(term));
    } catch {
      setResults([]);
      setRecipeNotice('Recipe search failed. Check your connection and try again.');
    } finally {
      setSearching(false);
    }
  };

  const surprise = async () => {
    if (searching) return;
    setSearching(true);
    setRecipeNotice(null);
    try {
      const meal = await randomMeal();
      if (meal) setRecipe(meal);
      else setRecipeNotice('Could not fetch a recipe right now.');
    } catch {
      setRecipeNotice('Could not fetch a recipe right now.');
    } finally {
      setSearching(false);
    }
  };

  const findRecipeFor = async (meal: Meal) => {
    setRecipeNotice(null);
    // The AI generation already includes details, so open it immediately.
    if (meal.ingredients.length > 0 || meal.steps.length > 0) {
      setRecipe(mealToRecipe(meal));
      return;
    }
    setCooking(meal.name);
    try {
      const found = await searchMeals(meal.name);
      if (found[0]) setRecipe(found[0]);
      else setRecipe(mealToRecipe(meal));
    } catch {
      // Offline or lookup failed: still show the generated details page.
      setRecipe(mealToRecipe(meal));
    } finally {
      setCooking(null);
    }
  };

  return (
    <div className="screen">
      <header className="topbar">
        <div>
          <h2>Food</h2>
          <p className="dim">{contextLine}</p>
        </div>
        <button className="btn secondary" disabled={live} onClick={() => setNonce((n) => n + 1)}>
          <RefreshCw size={16} aria-hidden="true" />{live ? 'Streaming…' : 'New ideas'}
        </button>
      </header>

      <div className="food-search">
        <div className="row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void runSearch(query); }}
            placeholder="Search recipes…"
            aria-label="Search recipes"
          />
          <button className="btn secondary" disabled={searching} onClick={() => void runSearch(query)}>
            <Search size={16} aria-hidden="true" />Search
          </button>
          <button className="btn ghost" disabled={searching} onClick={() => void surprise()}>Surprise me</button>
        </div>
      </div>

      {recipeNotice && <p className="dim">{recipeNotice}</p>}
      {searched && !searching && results.length === 0 && !recipeNotice && (
        <p className="dim">No recipes match "{query}".</p>
      )}
      {results.map((r) => (
        <div className="card" key={r.id}>
          <div className="recipe-row">
            {r.image && <img className="recipe-thumb" src={r.image} alt="" loading="lazy" />}
            <div className="grow">
              <p><strong>{r.name}</strong></p>
              <p className="dim">{[r.category, r.area].filter(Boolean).join(' · ')}</p>
            </div>
            <button className="btn secondary" onClick={() => setRecipe(r)}>Cook</button>
          </div>
        </div>
      ))}

      <div className="chips" role="group" aria-label="Dietary preference">
        <button
          type="button"
          className={`chip ${state.prefs.vegetarian ? 'on' : ''}`}
          aria-pressed={state.prefs.vegetarian}
          onClick={() => store.setPrefs({ ...state.prefs, vegetarian: !state.prefs.vegetarian })}
        >
          Vegetarian
        </button>
      </div>

      <p className="dim"><Sparkles size={13} aria-hidden="true" /> AI picks for right now — check allergens and portions yourself.</p>

      {meals.map((m) => (
        <div className="card" key={m.name}>
          <h4>{m.name}</h4>
          {m.why && <p>{m.why}</p>}
          <p className="dim">
            {m.prepMin !== null && <><Clock size={13} aria-hidden="true" />{m.prepMin} min prep · </>}
            {m.tags.length > 0 ? m.tags.map((t) => <span key={t} className="tag">{t}</span>) : 'AI suggestion'}
          </p>
          {(m.ingredients.length > 0 || m.steps.length > 0) && (
            <p className="dim">{m.ingredients.length} ingredients · {m.steps.length} steps</p>
          )}
          <div className="row">
            <button className="btn secondary" disabled={cooking === m.name} onClick={() => void findRecipeFor(m)}>
              <ChefHat size={16} aria-hidden="true" />{cooking === m.name ? 'Loading…' : 'Cook this'}
            </button>
          </div>
        </div>
      ))}

      {error && (
        <div className="card danger">
          <p>{error}</p>
          <button className="btn secondary" onClick={() => setNonce((n) => n + 1)}>Retry</button>
        </div>
      )}

      {recipe && (
        <Modal label={`Recipe: ${recipe.name}`} onClose={() => setRecipe(null)}>
          <h3>{recipe.name}</h3>
          {recipe.image && <img className="recipe-img" src={recipe.image} alt={recipe.name} />}
          {[recipe.category, recipe.area].filter(Boolean).length > 0 && (
            <p className="dim">{[recipe.category, recipe.area].filter(Boolean).join(' · ')}</p>
          )}
          {recipe.id.startsWith('ai-') && <p><span className="tag plus">AI recipe</span></p>}
          {recipe.tags.length > 0 && (
            <p>{recipe.tags.map((t) => <span key={t} className="tag">{t}</span>)}</p>
          )}
          <h4>Ingredients</h4>
          {recipe.ingredients.length > 0 ? (
            <ul className="plain">
              {recipe.ingredients.map((ing, i) => (
                <li key={i}><strong>{ing.name}</strong>{ing.measure ? ` — ${ing.measure}` : ''}</li>
              ))}
            </ul>
          ) : (
            <p className="dim">No ingredient list for this one — use what you have and season to taste.</p>
          )}
          <h4>How to cook</h4>
          {recipe.instructions
            ? recipe.instructions.split(/\r?\n/).map((p) => p.trim()).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)
            : <p className="dim">No instructions provided for this recipe.</p>}
          {recipe.youtube && <p><a className="link" href={recipe.youtube} target="_blank" rel="noreferrer">Watch on YouTube</a></p>}
          <div className="row">
            <button className="btn secondary" onClick={() => setRecipe(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
