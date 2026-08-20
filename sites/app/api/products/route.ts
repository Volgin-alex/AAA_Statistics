import { asc } from "drizzle-orm";
import { getDb } from "../../../db";
import { products } from "../../../db/schema";
import { ensureProductsSeeded } from "../../../lib/products";

export async function GET() {
  await ensureProductsSeeded();
  const rows = await getDb().select().from(products).orderBy(asc(products.id));
  return Response.json({ products: rows });
}
