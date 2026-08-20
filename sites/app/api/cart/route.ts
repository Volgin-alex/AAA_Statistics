import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { cartItems, products } from "../../../db/schema";
import { requireUser } from "../../../lib/auth";
import { getProductById } from "../../../lib/products";

async function cartForUser(userId: number) {
  const rows = await getDb()
    .select({
      id: cartItems.id,
      productId: products.id,
      title: products.title,
      category: products.category,
      priceCents: products.priceCents,
      imageUrl: products.imageUrl,
      inventory: products.inventory,
      quantity: cartItems.quantity,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.userId, userId));

  return {
    items: rows,
    totalCents: rows.reduce((sum, item) => sum + item.priceCents * item.quantity, 0),
  };
}

export async function GET(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  return Response.json(await cartForUser(user.id));
}

export async function POST(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response;

  const payload = (await request.json()) as { productId?: number; quantity?: number };
  const productId = Number(payload.productId);
  const quantity = Math.max(1, Math.min(20, Number(payload.quantity ?? 1)));
  const product = Number.isFinite(productId) ? await getProductById(productId) : null;

  if (!product) {
    return Response.json({ error: "Товар не найден." }, { status: 404 });
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.userId, user.id), eq(cartItems.productId, productId)))
    .limit(1);

  if (existing) {
    await db
      .update(cartItems)
      .set({
        quantity: Math.min(product.inventory, existing.quantity + quantity),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(cartItems.id, existing.id));
  } else {
    await db.insert(cartItems).values({
      userId: user.id,
      productId,
      quantity: Math.min(product.inventory, quantity),
    });
  }

  return Response.json(await cartForUser(user.id), { status: 201 });
}

export async function PATCH(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response;

  const payload = (await request.json()) as { productId?: number; quantity?: number };
  const productId = Number(payload.productId);
  const quantity = Math.max(0, Math.min(20, Number(payload.quantity ?? 1)));
  const db = getDb();

  if (quantity === 0) {
    await db.delete(cartItems).where(and(eq(cartItems.userId, user.id), eq(cartItems.productId, productId)));
  } else {
    await db
      .update(cartItems)
      .set({ quantity, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(cartItems.userId, user.id), eq(cartItems.productId, productId)));
  }

  return Response.json(await cartForUser(user.id));
}
