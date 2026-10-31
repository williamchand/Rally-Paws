/** TheMealDB free API (no key): recipes with ingredients + instructions. */

export interface RecipeIngredient {
  name: string;
  measure: string;
}

export interface Recipe {
  id: string;
  name: string;
  category: string;
  area: string;
  instructions: string;
  image: string;
  youtube: string;
  tags: string[];
  ingredients: RecipeIngredient[];
}

const API = 'https://www.themealdb.com/api/json/v1/1';

function toRecipe(m: Record<string, unknown>): Recipe {
  const str = (k: string) => (typeof m[k] === 'string' ? (m[k] as string).trim() : '');
  const ingredients: RecipeIngredient[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = str(`strIngredient${i}`);
    if (name) ingredients.push({ name, measure: str(`strMeasure${i}`) });
  }
  const tags = str('strTags');
  return {
    id: str('idMeal'),
    name: str('strMeal') || 'Untitled',
    category: str('strCategory'),
    area: str('strArea'),
    instructions: str('strInstructions'),
    image: str('strMealThumb'),
    youtube: str('strYoutube'),
    tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    ingredients,
  };
}

async function getMeals(path: string): Promise<Recipe[]> {
  const resp = await fetch(API + path);
  if (!resp.ok) throw new Error(`Recipe lookup failed (${resp.status})`);
  const data = (await resp.json()) as { meals?: unknown };
  // TheMealDB returns {"meals": null} when nothing matches.
  if (!data || !Array.isArray(data.meals)) return [];
  return (data.meals as Record<string, unknown>[]).map(toRecipe);
}

export const searchMeals = (q: string): Promise<Recipe[]> =>
  getMeals(`/search.php?s=${encodeURIComponent(q.trim())}`);

export const randomMeal = async (): Promise<Recipe | null> =>
  (await getMeals('/random.php'))[0] ?? null;
