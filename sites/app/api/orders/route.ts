import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { cartItems, orderItems, orders, products } from "../../../db/schema";
import { requireUser } from "../../../lib/auth";

export async function POST(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response;

  const payload = (await request.json()) as {
    customerName?: string;
    customerPhone?: string;
    deliveryAddress?: string;
  };
  const customerName = payload.customerName?.trim() ?? "";
  const customerPhone = payload.customerPhone?.trim() ?? "";
  const deliveryAddress = payload.deliveryAddress?.trim() ?? "";

  if (customerName.length < 2 || customerPhone.length < 6 || deliveryAddress.length < 8) {
    return Response.json({ error: "Заполните имя, телефон и адрес доставки." }, { status: 400 });
  }

  const db = getDb();
  const items = await db
    .select({
      productId: products.id,
      title: products.title,
      priceCents: products.priceCents,
      quantity: cartItems.quantity,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.userId, user.id));

  if (items.length === 0) {
    return Response.json({ error: "Корзина пуста." }, { status: 400 });
  }

  const totalCents = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  const [order] = await db
    .insert(orders)
    .values({ userId: user.id, customerName, customerPhone, deliveryAddress, totalCents })
    .returning();

  await db.insert(orderItems).values(
    items.map((item) => ({
      orderId: order.id,
      productId: item.productId,
      title: item.title,
      priceCents: item.priceCents,
      quantity: item.quantity,
    }))
  );
  await db.delete(cartItems).where(eq(cartItems.userId, user.id));

  return Response.json({ order: { ...order, items } }, { status: 201 });
}
