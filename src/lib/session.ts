// Shared by middleware (edge) and server actions. Web Crypto only.
export const COOKIE = "hub_session";

export async function sessionToken(): Promise<string> {
  const secret = process.env.SESSION_SECRET || "dev-secret";
  const password = process.env.HUB_PASSWORD || "renbnb";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("hub:" + password));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
