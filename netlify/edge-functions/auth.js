export default async (request, context) => {
  const url = new URL(request.url);
  const qToken = url.searchParams.get("t");
  const cookieToken = getCookie(request, "t");
  const token = qToken || cookieToken;
  if (!token) return new Response("Unauthorized", { status: 401 });

  try {
    const { payload, signingInput, signature } = decodeJwt(token);
    if (payload.aud !== "investor") throw new Error("Invalid audience");
    if (payload.exp && Date.now() >= payload.exp * 1000) throw new Error("Token expired");

    // Fallback secret if env var is missing
    const secret = Deno.env.get("SIGNING_SECRET") || "4f4fe635fe7077d4e3180151f2323c69e8a9856616f6f7b7bd56dc67f32c5221";
    const valid = await verifyHmac(signingInput, signature, secret);
    if (!valid) throw new Error("Invalid signature");

    // If token in query string, set cookie and redirect to clean URL
    if (qToken) {
      const clean = new URL(request.url);
      clean.searchParams.delete("t");
      const headers = new Headers({ Location: clean.toString() });
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

function getCookie(req, name) {
  const raw = req.headers.get("cookie") || "";
  const m = raw.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function decodeJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");
  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(atob(b64UrlToB64(headerB64)));
  const payload = JSON.parse(atob(b64UrlToB64(payloadB64)));
  return { payload, signingInput: `${headerB64}.${payloadB64}`, signature: b64UrlToUint8Array(sigB64) };
}

function b64UrlToB64(str) {
  return str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
}

function b64UrlToUint8Array(str) {
  const b64 = b64UrlToB64(str);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function verifyHmac(data, signature, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  return await crypto.subtle.verify("HMAC", key, signature, new TextEncoder().encode(data));
}
