import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticateLocalUser } from "@/lib/database";

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: authSecret,
  providers: [
    Credentials({
      name: "Username and Password",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = typeof credentials?.username === "string" ? credentials.username : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!username || !password) return null;

        const user = await authenticateLocalUser({ username, password });
        if (!user) return null;

        return {
          id: user.id,
          name: user.name ?? user.username,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.appUserId = user.id;
      }
      if (!token.appUserId && typeof token.sub === "string") {
        token.appUserId = token.sub;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.appUserId === "string" ? token.appUserId : typeof token.sub === "string" ? token.sub : "";
      }
      return session;
    },
  },
});
