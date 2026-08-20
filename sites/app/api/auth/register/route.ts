import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { createSession, sessionCookie, shouldUseSecureCookie } from "../../../../lib/auth";
import { createSalt, hashPassword } from "../../../../lib/crypto";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    name?: string;
    email?: string;
    password?: string;
  };
  const name = payload.name?.trim() ?? "";
  const email = payload.email?.trim().toLowerCase() ?? "";
  const password = payload.password ?? "";

  if (name.length < 2 || !isEmail(email) || password.length < 8) {
    return Response.json(
      { error: "Введите имя, корректный email и пароль от 8 символов." },
      { status: 400 }
    );
  }

  const db = getDb();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return Response.json({ error: "Пользователь с таким email уже есть." }, { status: 409 });
  }

  const salt = createSalt();
  const passwordHash = await hashPassword(password, salt);
  const [user] = await db.insert(users).values({ name, email, passwordHash, salt }).returning({
    id: users.id,
    name: users.name,
    email: users.email,
  });
  const session = await createSession(user.id);

  return Response.json(
    { user },
    {
      status: 201,
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
