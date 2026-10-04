import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { adminDb } from "@/lib/firestore/admin";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || "alhadid-traders-erp-nextauth-secret-key-2026",
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        financialYear: { label: "Financial Year", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials.password) {
          return null;
        }

        const usernameTrimmed = credentials.username.trim();
        const target = usernameTrimmed.toLowerCase();
        
        try {
          const snap = await adminDb.collection("users").get();
          const allUsers: any[] = [];
          snap.forEach(doc => {
            allUsers.push({ _id: doc.id, id: doc.id, ...doc.data() });
          });

          const user = allUsers.find((u: any) => 
            u.isActive !== false && (
              (u.username && String(u.username).trim().toLowerCase() === target) ||
              (u.email && String(u.email).trim().toLowerCase() === target) ||
              (u.name && String(u.name).trim().toLowerCase() === target)
            )
          );

          if (!user) return null;

          const ok = await bcrypt.compare(credentials.password, user.password);
          if (!ok) return null;

          return {
            id: String(user._id || user.id),
            name: user.name,
            role: user.role,
            financialYear: user.financialYear,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.financialYear = (user as any).financialYear;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role;
        session.user.financialYear = token.financialYear;
      }
      return session;
    },
  },
};
