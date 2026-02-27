import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { findUserIdByEmail, upsertAuthUser } from "@/lib/database";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
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
