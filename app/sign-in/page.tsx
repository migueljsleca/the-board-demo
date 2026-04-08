import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { AUTH_HERO_VIDEO_URL } from "@/lib/marketing";

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
    <main className="min-h-screen bg-[#050608] text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <section className="relative flex w-full flex-col overflow-hidden border-b border-white/10 bg-[#050608] px-7 pb-10 pt-0 sm:px-10 lg:w-[59.6%] lg:border-b-0 lg:border-r lg:px-8 lg:pb-0 lg:pt-0">
          <div className="relative order-1 -ml-3 w-full pt-2 sm:-ml-4 lg:-ml-2 lg:pt-3">
            <p className="font-mono text-[46px] font-normal uppercase tracking-[0em] text-white/55 sm:text-[54px] lg:text-[58px]">THE BOARD</p>
            <p className="mt-2 font-mono text-[16px] leading-[1.55] tracking-[0em] text-white/55 sm:text-[17px]">
              Design starts here.
              <br />
              Collect. Curate. Create.
            </p>
          </div>
          <p className="order-2 -ml-3 mt-auto pb-5 font-mono text-[14px] tracking-[0em] text-white/55 sm:-ml-4 lg:-ml-2 lg:pb-7">Created by Miguel Leça</p>
          <div className="relative order-3 -mx-7 mb-0 border-b border-white/10 bg-[#050608] sm:-mx-10 lg:-mx-8">
            <video className="block h-auto w-full" autoPlay muted loop playsInline>
              <source src={AUTH_HERO_VIDEO_URL} type="video/mp4" />
            </video>
          </div>
        </section>

        <section className="flex w-full items-center justify-center bg-[#111317] px-6 py-12 sm:px-8 lg:w-[40.4%] lg:px-12">
          <div className="w-full max-w-[432px]">
            <h1 className="text-2xl font-semibold tracking-tight text-white">Welcome back</h1>
            <p className="mt-2 text-sm text-white/62">Sign in with your username and password.</p>
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
              <label className="mb-2 block text-xs uppercase tracking-[0.12em] text-white/62" htmlFor="username">
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
                className="w-full border border-white/22 bg-[#0d0f13] px-3 py-2.5 text-sm text-white outline-none ring-0 placeholder:text-white/35 focus:border-white/42"
                placeholder="your_username"
              />
              <label className="mb-2 mt-4 block text-xs uppercase tracking-[0.12em] text-white/62" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="current-password"
                className="w-full border border-white/22 bg-[#0d0f13] px-3 py-2.5 text-sm text-white outline-none ring-0 placeholder:text-white/35 focus:border-white/42"
                placeholder="••••••••"
              />
              <button
                type="submit"
                className="mt-6 inline-flex w-full items-center justify-center border border-white/26 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:border-white/40 hover:bg-white/16"
              >
                Sign in
              </button>
            </form>
            <p className="mt-5 text-center text-sm text-white/70">
              No account?{" "}
              <a href="/sign-up" className="text-white underline decoration-white/35 underline-offset-4 hover:decoration-white">
                Create one
              </a>
              .
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
