import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { orderItems, orders } from "../../../db/schema";
import { getCurrentUser } from "../../../lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return Response.json({ user: null, orders: [] });
  }

  const db = getDb();
  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, user.id))
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(20);

  const enriched = await Promise.all(
    orderRows.map(async (order) => {
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      return { ...order, items };
    })
  );

  return Response.json({ user, orders: enriched });
}
