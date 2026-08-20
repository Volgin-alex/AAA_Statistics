import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { createSession, sessionCookie, shouldUseSecureCookie } from "../../../../lib/auth";
import { hashPassword } from "../../../../lib/crypto";

export async function POST(request: Request) {
  const payload = (await request.json()) as { email?: string; password?: string };
  const email = payload.email?.trim().toLowerCase() ?? "";
  const password = payload.password ?? "";

  const db = getDb();
  const [userRecord] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!userRecord) {
    return Response.json({ error: "Неверный email или пароль." }, { status: 401 });
  }

  const passwordHash = await hashPassword(password, userRecord.salt);
  if (passwordHash !== userRecord.passwordHash) {
    return Response.json({ error: "Неверный email или пароль." }, { status: 401 });
  }

  const session = await createSession(userRecord.id);
  return Response.json(
    { user: { id: userRecord.id, name: userRecord.name, email: userRecord.email } },
    {
      headers: {
        "Set-Cookie": sessionCookie(
          session.id,
          session.expiresAt,
          shouldUseSecureCookie(request)
        ),
      },
    }
  );
}
