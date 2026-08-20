import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { sessions } from "../../../../db/schema";
import { clearSessionCookie, getCurrentUser, shouldUseSecureCookie } from "../../../../lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (user) {
    await getDb().delete(sessions).where(eq(sessions.id, user.sessionId));
  }

  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": clearSessionCookie(shouldUseSecureCookie(request)) } }
  );
}
