import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, sessionToken } from "@/lib/session";

async function login(formData: FormData) {
  "use server";
  const pw = (formData.get("password") ?? "").toString();
  if (pw !== (process.env.HUB_PASSWORD || "renbnb")) redirect("/login?e=1");
  (await cookies()).set(COOKIE, await sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
  redirect("/");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center bg-linen px-4">
      <form action={login} className="card w-full max-w-sm space-y-4">
        <div>
          <div className="eyebrow">RenBNB</div>
          <h1 className="font-display text-2xl text-timber">Operations Hub</h1>
        </div>
        <input type="password" name="password" placeholder="Password" className="input w-full" autoFocus required />
        {e && <p className="text-sm text-red-700">Wrong password.</p>}
        <button className="btn w-full">Enter</button>
      </form>
    </div>
  );
}
