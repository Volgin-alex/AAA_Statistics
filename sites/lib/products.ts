import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { products } from "../db/schema";

export const seedProducts = [
  {
    slug: "atlas-backpack",
    title: "Atlas travel backpack",
    category: "Bags",
    description: "Structured 28L backpack with laptop pocket and weather-resistant shell.",
    priceCents: 12900,
    rating: 4.8,
    inventory: 24,
    imageUrl:
      "https://images.unsplash.com/photo-1622560480654-d96214fdc887?auto=format&fit=crop&w=900&q=80",
  },
  {
    slug: "linen-shirt",
    title: "Linen overshirt",
    category: "Clothing",
    description: "Breathable mid-weight linen with relaxed cut and reinforced seams.",
    priceCents: 7600,
    rating: 4.6,
    inventory: 38,
    imageUrl:
      "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=900&q=80",
  },
  {
    slug: "ceramic-cups",
    title: "Ceramic cup set",
    category: "Home",
    description: "Four hand-finished cups with matte glaze and stackable profile.",
    priceCents: 4900,
    rating: 4.7,
    inventory: 19,
    imageUrl:
      "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=80",
  },
  {
    slug: "desk-lamp",
    title: "Pivot desk lamp",
    category: "Office",
    description: "Aluminum lamp with dimmable warm light and adjustable arm.",
    priceCents: 11200,
    rating: 4.9,
    inventory: 14,
    imageUrl:
      "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80",
  },
  {
    slug: "runner-sneakers",
    title: "Runner sneakers",
    category: "Footwear",
    description: "Lightweight knit sneakers with cushioned sole for daily city routes.",
    priceCents: 9900,
    rating: 4.5,
    inventory: 31,
    imageUrl:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
  },
  {
    slug: "wireless-speaker",
    title: "Compact wireless speaker",
    category: "Audio",
    description: "Portable speaker with 18-hour battery and crisp near-field sound.",
    priceCents: 8700,
    rating: 4.4,
    inventory: 22,
    imageUrl:
      "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=80",
  },
];

export async function ensureProductsSeeded() {
  const db = getDb();
  const existing = await db.select({ id: products.id }).from(products).limit(1);
  if (existing.length > 0) {
    return;
  }

  await db.insert(products).values(seedProducts);
}

export async function getProductById(id: number) {
  const db = getDb();
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return product ?? null;
}
