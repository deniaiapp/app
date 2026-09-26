import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { recordAdEvent, verifyAdDelivery } from "@/lib/ads";
import { isFreeAdViewer } from "@/lib/usage";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return new Response(null, { status: 403 });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.session) return new Response(null, { status: 401 });
  if (!session.user.isAnonymous && !(await isFreeAdViewer(session.session.userId)))
    return new Response(null, { status: 403 });
  const input = z
    .object({ id: z.string().uuid(), token: z.string() })
    .safeParse(await request.json().catch(() => null));
  if (!input.success || !verifyAdDelivery(input.data.token, input.data.id, session.session.userId))
    return new Response(null, { status: 400 });
  await recordAdEvent(
    input.data.id,
    session.session.userId,
    "view",
    Boolean(session.user.isAnonymous),
  );
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
