import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { findUserIdByEmail, getOrCreateUserId } from "@/lib/auth-user";

function splitName(name: string | null | undefined) {
  if (!name?.trim()) return { firstName: null, lastName: null };
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      const email = user.email?.trim();
      if (!email) return false;
      const { firstName, lastName } = splitName(user.name);
      await getOrCreateUserId({
        email,
        firstName,
        lastName,
        imageUrl: user.image ?? null,
        provider: account?.provider ?? null,
        providerAccountId: account?.providerAccountId ?? null,
      });
      return true;
    },
    async jwt({ token, account, user }) {
      if (account && user?.email) {
        const { firstName, lastName } = splitName(user.name);
        const userId = await getOrCreateUserId({
          email: user.email,
          firstName,
          lastName,
          imageUrl: user.image ?? null,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        });
        token.userId = String(userId);
        return token;
      }

      if (!token.userId && token.email) {
        const existingUserId = await findUserIdByEmail(String(token.email));
        if (existingUserId) {
          token.userId = String(existingUserId);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = String(token.userId);
      }
      return session;
    },
  },
};
