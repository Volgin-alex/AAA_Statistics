import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../db";
import { sessions, users } from "../db/schema";
import { createToken } from "./crypto";

const SESSION_COOKIE = "market_lane_session";
const SESSION_DAYS = 14;

type CurrentUser = {
  id: number;
  name: string;
  email: string;
  sessionId: string;
};

function parseCookie(header: string | null, name: string) {
  if (!header) {
    return null;
  }

  const match = header
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function cookieExpiresAt() {
  const date = new Date();
  date.setDate(date.getDate() + SESSION_DAYS);
  return date;
}

export function shouldUseSecureCookie(request: Request) {
  return new URL(request.url).protocol === "https:";
}

export function sessionCookie(value: string, expiresAt: Date, secure: boolean) {
  const secureFlag = secure ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(
    value
  )}; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Expires=${expiresAt.toUTCString()}`;
}

export function clearSessionCookie(secure: boolean) {
  const secureFlag = secure ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=0`;
}

export async function createSession(userId: number) {
  const db = getDb();
  const id = createToken();
  const expiresAt = cookieExpiresAt();
  await db.insert(sessions).values({
    id,
    userId,
    expiresAt: expiresAt.toISOString(),
  });

  return { id, expiresAt };
}

export async function getCurrentUser(request: Request): Promise<CurrentUser | null> {
  const sessionId = parseCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!sessionId) {
    return null;
  }

  const db = getDb();
  const [row] = await db
    .select({
      sessionId: sessions.id,
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date().toISOString())))
    .limit(1);

  return row
    ? { id: row.id, name: row.name, email: row.email, sessionId: row.sessionId }
    : null;
}

export async function requireUser(
  request: Request
): Promise<{ user: CurrentUser; response: null } | { user: null; response: Response }> {
  const user = await getCurrentUser(request);
  if (!user) {
    return { user: null, response: Response.json({ error: "auth_required" }, { status: 401 }) };
  }

  return { user, response: null };
}
