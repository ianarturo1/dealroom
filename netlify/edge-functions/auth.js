import { jwtVerify } from "jose";

function getCookie(req, name) {
  const raw = req.headers.get("cookie") || "";
  const m = raw.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export default async (request, context) => {
  const url = new URL(request.url);
  const qToken = url.searchParams.get("t");
  const cookieToken = getCookie(request, "t");
  const token = qToken || cookieToken;

  if (!token) return new Response("Unauthorized", { status: 401 });

  try {
    const secret = new TextEncoder().encode(Deno.env.get("SIGNING_SECRET"));
    await jwtVerify(token, secret, { audience: "investor" });

    if (qToken) {
      const clean = new URL(request.url);
      clean.searchParams.delete("t");
      const headers = new Headers({ "Location": clean.toString() });
      headers.append(
        "Set-Cookie",
        `t=${encodeURIComponent(qToken)}; Path=/; Max-Age=${7 * 24 * 3600}; HttpOnly; Secure; SameSite=Lax`
      );
      return new Response(null, { status: 302, headers });
    }
    return await context.next();
  } catch {
    return new Response("Link inválido o vencido", { status: 401 });
  }
};
