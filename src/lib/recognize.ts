// Local, offline keyword-based clothing & icon suggestions (no AI).

export interface ClothingGuess {
  type: string;
  icon: string;
  categoryHint: string; // matches default category names where possible
}

// Order matters: more specific keywords first.
const KEYWORDS: Array<{ words: string[]; guess: ClothingGuess }> = [
  // Shoes
  { words: ["סניקרס", "נעלי ספורט", "נעליי ספורט"], guess: { type: "נעלי ספורט", icon: "👟", categoryHint: "נעליים" } },
  { words: ["מגפיים", "מגף"], guess: { type: "מגפיים", icon: "🥾", categoryHint: "נעליים" } },
  { words: ["סנדל", "סנדלים", "כפכף", "כפכפים"], guess: { type: "סנדלים", icon: "🩴", categoryHint: "נעליים" } },
  { words: ["עקבים", "עקב"], guess: { type: "נעלי עקב", icon: "👠", categoryHint: "נעליים" } },
  { words: ["נעל", "נעליים"], guess: { type: "נעליים", icon: "👞", categoryHint: "נעליים" } },
  { words: ["גרב", "גרביים"], guess: { type: "גרביים", icon: "🧦", categoryHint: "תחתונים" } },

  // Tops
  { words: ["טי שירט", "טי-שירט", "טישירט", "חולצת טי", "טי"], guess: { type: "חולצת טי", icon: "👕", categoryHint: "חולצות" } },
  { words: ["פולו"], guess: { type: "חולצת פולו", icon: "👕", categoryHint: "חולצות" } },
  { words: ["גופיה", "גופייה"], guess: { type: "גופייה", icon: "🎽", categoryHint: "חולצות" } },
  { words: ["חולצה מכופתרת", "מכופתרת"], guess: { type: "חולצה מכופתרת", icon: "👔", categoryHint: "חולצות" } },
  { words: ["סווטשירט", "סווצ'ר", "קפוצ'ון"], guess: { type: "סווטשירט", icon: "👕", categoryHint: "חולצות" } },
  { words: ["סוודר", "סריג"], guess: { type: "סוודר", icon: "🧶", categoryHint: "חולצות" } },
  { words: ["חולצה"], guess: { type: "חולצה", icon: "👕", categoryHint: "חולצות" } },

  // Bottoms
  { words: ["ג'ינס", "גינס"], guess: { type: "ג'ינס", icon: "👖", categoryHint: "מכנסיים" } },
  { words: ["טייץ", "טייטס", "לגינס"], guess: { type: "טייץ", icon: "🧘", categoryHint: "מכנסיים" } },
  { words: ["מכנס קצר", "מכנסיים קצרים", "שורט"], guess: { type: "מכנסיים קצרים", icon: "🩳", categoryHint: "מכנסיים" } },
  { words: ["מכנס", "מכנסיים"], guess: { type: "מכנסיים", icon: "👖", categoryHint: "מכנסיים" } },
  { words: ["חצאית"], guess: { type: "חצאית", icon: "👗", categoryHint: "חולצות" } },
  { words: ["שמלה"], guess: { type: "שמלה", icon: "👗", categoryHint: "חולצות" } },

  // Outerwear
  { words: ["מעיל גשם"], guess: { type: "מעיל גשם", icon: "🧥", categoryHint: "מעילים" } },
  { words: ["ג'קט", "גקט", "מעיל"], guess: { type: "מעיל", icon: "🧥", categoryHint: "מעילים" } },
  { words: ["וסט"], guess: { type: "וסט", icon: "🦺", categoryHint: "מעילים" } },

  // Underwear / swim
  { words: ["תחתון", "תחתונים", "בוקסר"], guess: { type: "תחתונים", icon: "🩲", categoryHint: "תחתונים" } },
  { words: ["חזייה"], guess: { type: "חזייה", icon: "👙", categoryHint: "תחתונים" } },
  { words: ["בגד ים", "ביקיני"], guess: { type: "בגד ים", icon: "🩱", categoryHint: "תחתונים" } },
  { words: ["פיג'מה", "פיגמה"], guess: { type: "פיג'מה", icon: "🛌", categoryHint: "תחתונים" } },

  // Accessories
  { words: ["כובע", "כומתה", "קסקט"], guess: { type: "כובע", icon: "🧢", categoryHint: "כובעים" } },
  { words: ["צעיף"], guess: { type: "צעיף", icon: "🧣", categoryHint: "מעילים" } },
  { words: ["כפפות"], guess: { type: "כפפות", icon: "🧤", categoryHint: "מעילים" } },
  { words: ["חגורה"], guess: { type: "חגורה", icon: "👖", categoryHint: "מכנסיים" } },
  { words: ["עניבה"], guess: { type: "עניבה", icon: "👔", categoryHint: "חולצות" } },
];

// For category-name → emoji (no AI).
const CATEGORY_ICONS: Array<{ words: string[]; icon: string }> = [
  { words: ["חולצ"], icon: "👕" },
  { words: ["מכנס", "ג'ינס", "גינס"], icon: "👖" },
  { words: ["שורט", "קצר"], icon: "🩳" },
  { words: ["נעל", "סניקרס"], icon: "👟" },
  { words: ["מגף"], icon: "🥾" },
  { words: ["סנדל", "כפכף"], icon: "🩴" },
  { words: ["עקב"], icon: "👠" },
  { words: ["מעיל", "ג'קט", "גקט"], icon: "🧥" },
  { words: ["וסט"], icon: "🦺" },
  { words: ["כובע", "קסקט"], icon: "🧢" },
  { words: ["גרב"], icon: "🧦" },
  { words: ["תחתון", "בוקסר"], icon: "🩲" },
  { words: ["חזייה"], icon: "👙" },
  { words: ["בגד ים", "ביקיני", "ים"], icon: "🩱" },
  { words: ["פיג", "שינה"], icon: "🛌" },
  { words: ["שמלה", "חצאית"], icon: "👗" },
  { words: ["צעיף"], icon: "🧣" },
  { words: ["כפפ"], icon: "🧤" },
  { words: ["חגיגי", "חתונה", "אירוע"], icon: "👔" },
  { words: ["ספורט", "ריצה", "אימון"], icon: "🏃" },
  { words: ["חוף"], icon: "🏖️" },
  { words: ["עבודה", "משרד"], icon: "💼" },
  { words: ["חורף", "קור"], icon: "❄️" },
  { words: ["קיץ", "חום"], icon: "☀️" },
  { words: ["יום יום", "יומיום"], icon: "🌤️" },
];

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/[\u0591-\u05BD\u05BF\u05C1-\u05C7]/g, "");
}

export function guessClothing(name: string): ClothingGuess | null {
  const n = normalize(name);
  if (!n) return null;
  for (const entry of KEYWORDS) {
    for (const w of entry.words) {
      if (n.includes(normalize(w))) return entry.guess;
    }
  }
  return null;
}

export function guessCategoryIcon(name: string): string {
  const n = normalize(name);
  if (!n) return "🏷️";
  for (const entry of CATEGORY_ICONS) {
    for (const w of entry.words) {
      if (n.includes(normalize(w))) return entry.icon;
    }
  }
  return "🏷️";
}
