import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333",
  plugins: [adminClient()],
});

export const { signIn, signOut, signUp, useSession, getSession } = authClient;

export default authClient;
