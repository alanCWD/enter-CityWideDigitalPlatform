export type Sector = "restaurant" | "retail" | "service" | "generic";

const RESTAURANT_KEYWORDS = ["restaurant", "food", "cafe", "coffee", "pizza", "bakery", "diner", "bar", "grill", "bistro", "sushi", "thai", "mexican", "italian", "chinese", "burger", "sandwich", "catering"];
const RETAIL_KEYWORDS = ["shop", "store", "retail", "boutique", "clothing", "apparel", "jewelry", "gift", "hardware", "pharmacy", "beauty", "salon", "spa", "florist", "book"];
const SERVICE_KEYWORDS = ["plumb", "electri", "contract", "legal", "law", "medical", "clinic", "doctor", "dental", "clean", "repair", "hvac", "landscap", "accounting", "consult", "insur", "real estate", "auto", "mechanic", "tow"];

export function getSector(category: string | null | undefined): Sector {
  const c = (category ?? "").toLowerCase();
  if (RESTAURANT_KEYWORDS.some((k) => c.includes(k))) return "restaurant";
  if (RETAIL_KEYWORDS.some((k) => c.includes(k))) return "retail";
  if (SERVICE_KEYWORDS.some((k) => c.includes(k))) return "service";
  return "generic";
}
