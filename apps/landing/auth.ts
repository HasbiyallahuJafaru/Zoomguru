import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    Credentials({
      name: 'credentials',
      credentials: {
        identifier: { label: 'Email or Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          return null;
        }

        const identifier = String(credentials.identifier).toLowerCase().trim();

        const res = await fetch(
          process.env.NEXT_PUBLIC_API_URL + '/auth/login',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: identifier,
              password: credentials.password,
              deviceId: 'web',
            }),
          }
        );

        if (!res.ok) return null;
        const data = await res.json();

        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          username: data.user.username,
          isPro: data.user.isPro,
          role: data.user.role,
          image: data.user.avatarUrl,
          accessToken: data.accessToken,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
        token.isPro = (user as any).isPro;
        token.role = (user as any).role;
        token.accessToken = (user as any).accessToken;
      }
      if (account?.provider === 'google') {
        const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
        const res = await fetch(
          apiUrl + '/auth/google/web',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Send the Google id_token so the backend can verify it independently.
            // Never send raw profile claims — the backend must derive them from the token.
            body: JSON.stringify({ idToken: account.id_token }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          token.id = data.user.id;
          token.username = data.user.username;
          token.isPro = data.user.isPro;
          token.role = data.user.role;
          token.accessToken = data.accessToken;
        }
      }
      // Always refresh isPro from DB so payment changes reflect without re-login
      if (token.accessToken) {
        try {
          const meRes = await fetch(process.env.NEXT_PUBLIC_API_URL + '/auth/me', {
            headers: { Authorization: `Bearer ${token.accessToken}` },
          });
          if (meRes.ok) {
            const me = await meRes.json();
            token.isPro = me.isPro;
            token.role = me.role;
          }
        } catch {}
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.id as string;
      (session.user as any).username = token.username;
      (session.user as any).isPro = token.isPro;
      (session.user as any).role = token.role;
      // accessToken intentionally NOT copied to session.user — it stays in the
      // encrypted server-side JWT only. Client components must use /api/proxy/*.
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
});
