import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { findUserIdByEmail, upsertAuthUser } from "@/lib/database";

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
const googleClientId = process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret,
  providers: [
    Google({
      clientId: googleClientId ?? "",
      clientSecret: googleClientSecret ?? "",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.provider === "google") {
        const email = typeof token.email === "string" ? token.email : typeof profile?.email === "string" ? profile.email : null;
        if (email) {
          const userId = await upsertAuthUser({
            email,
            name: typeof token.name === "string" ? token.name : typeof profile?.name === "string" ? profile.name : null,
            image: typeof token.picture === "string" ? token.picture : null,
            providerUserId: account.providerAccountId,
          });
          token.appUserId = userId;
        }
      }

      if (!token.appUserId && typeof token.email === "string") {
        const existingUserId = await findUserIdByEmail(token.email);
        if (existingUserId) {
          token.appUserId = existingUserId;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.appUserId === "string" ? token.appUserId : "";
      }
      return session;
    },
  },
});
