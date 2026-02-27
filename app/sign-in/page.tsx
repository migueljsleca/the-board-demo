import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Invalid username or password.",
  created: "Account created. Please sign in.",
};

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : null;
}

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const errorKey = readParam(params, "error");
  const createdFlag = readParam(params, "created");
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] ?? "Unable to sign in." : null;
  const successMessage = createdFlag === "1" ? ERROR_MESSAGES.created : null;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0d12] px-6 py-20 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(140,160,255,0.2),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(81,153,125,0.16),transparent_35%),radial-gradient(circle_at_50%_85%,rgba(255,255,255,0.08),transparent_45%)]" />
      <section className="relative w-full max-w-md rounded-2xl border border-white/12 bg-black/35 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <p className="mb-3 inline-flex border border-white/20 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white/60">The Board v3</p>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Sign in to your workspace</h1>
        <p className="mt-2 text-sm text-white/60">Use your username and password to access your private boards and cloud images.</p>
        {successMessage ? <p className="mt-4 border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{successMessage}</p> : null}
        {errorMessage ? <p className="mt-4 border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{errorMessage}</p> : null}

        <form
          className="mt-8"
          action={async (formData) => {
            "use server";
            const username = String(formData.get("username") ?? "");
            const password = String(formData.get("password") ?? "");

            try {
              await signIn("credentials", {
                username,
                password,
                redirectTo: "/",
              });
            } catch (error) {
              if (error instanceof AuthError) {
                redirect("/sign-in?error=invalid_credentials");
              }
              throw error;
            }
          }}
        >
          <label className="mb-2 block text-xs uppercase tracking-[0.12em] text-white/65" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            name="username"
            required
            minLength={3}
            maxLength={32}
            pattern="[a-zA-Z0-9_]+"
            autoComplete="username"
            className="w-full border border-white/20 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-0 placeholder:text-white/40 focus:border-white/40"
            placeholder="your_username"
          />
          <label className="mb-2 mt-4 block text-xs uppercase tracking-[0.12em] text-white/65" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="current-password"
            className="w-full border border-white/20 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-0 placeholder:text-white/40 focus:border-white/40"
            placeholder="••••••••"
          />
          <button
            type="submit"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:border-white/35 hover:bg-white/15"
          >
            Sign in
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-white/70">
          No account?{" "}
          <a href="/sign-up" className="text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
            Create one
          </a>
          .
        </p>
      </section>
    </main>
  );
}
