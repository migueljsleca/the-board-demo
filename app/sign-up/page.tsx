import { redirect } from "next/navigation";
import { createLocalUser } from "@/lib/database";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const ERROR_MESSAGES: Record<string, string> = {
  invalid_username: "Username must be 3-32 chars and use only letters, numbers, or underscore.",
  password_too_short: "Password must be at least 8 characters.",
  password_mismatch: "Passwords do not match.",
  username_taken: "That username is already taken.",
  create_failed: "Unable to create account right now.",
  server_error: "Server configuration is missing. Please check environment variables and try again.",
};

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : null;
}

export default async function SignUpPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const errorKey = readParam(params, "error");
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] ?? "Unable to create account." : null;

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
              <source src="/videos/the-board-1.mp4" type="video/mp4" />
            </video>
          </div>
        </section>

        <section className="flex w-full items-center justify-center bg-[#111317] px-6 py-12 sm:px-8 lg:w-[40.4%] lg:px-12">
          <div className="w-full max-w-[432px]">
            <h1 className="text-2xl font-semibold tracking-tight text-white">Create account</h1>
            <p className="mt-2 text-sm text-white/62">Choose a username and password.</p>
            {errorMessage ? <p className="mt-4 border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{errorMessage}</p> : null}

            <form
              className="mt-8"
              action={async (formData) => {
                "use server";
                const usernameRaw = String(formData.get("username") ?? "");
                const password = String(formData.get("password") ?? "");
                const confirmPassword = String(formData.get("confirmPassword") ?? "");
                const username = usernameRaw.trim().toLowerCase();

                if (!/^[a-z0-9_]{3,32}$/.test(username)) {
                  redirect("/sign-up?error=invalid_username");
                }
                if (password.length < 8) {
                  redirect("/sign-up?error=password_too_short");
                }
                if (password !== confirmPassword) {
                  redirect("/sign-up?error=password_mismatch");
                }

                let createdUserId: string | null = null;
                try {
                  createdUserId = await createLocalUser({ username, password });
                } catch (error) {
                  console.error("Sign up failed:", error);
                  redirect("/sign-up?error=server_error");
                }
                if (!createdUserId) {
                  redirect("/sign-up?error=username_taken");
                }
                redirect("/sign-in?created=1");
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
                autoComplete="new-password"
                className="w-full border border-white/22 bg-[#0d0f13] px-3 py-2.5 text-sm text-white outline-none ring-0 placeholder:text-white/35 focus:border-white/42"
                placeholder="At least 8 characters"
              />
              <label className="mb-2 mt-4 block text-xs uppercase tracking-[0.12em] text-white/62" htmlFor="confirmPassword">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full border border-white/22 bg-[#0d0f13] px-3 py-2.5 text-sm text-white outline-none ring-0 placeholder:text-white/35 focus:border-white/42"
                placeholder="Repeat your password"
              />

              <button
                type="submit"
                className="mt-6 inline-flex w-full items-center justify-center border border-white/26 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:border-white/40 hover:bg-white/16"
              >
                Create account
              </button>
            </form>
            <p className="mt-5 text-center text-sm text-white/70">
              Already have an account?{" "}
              <a href="/sign-in" className="text-white underline decoration-white/35 underline-offset-4 hover:decoration-white">
                Sign in
              </a>
              .
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
