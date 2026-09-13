"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui";

const AUTH_PERSONAS = [
  {
    email: "haileabt@gmail.com",
    pass: "Haile@zbe",
    label: "Haile (Superadmin)",
  },
  {
    email: "abebe@zbe.com",
    pass: "Password123!",
    label: "Abebe (Ops)",
  },
  {
    email: "hana@zbe.com",
    pass: "Password123!",
    label: "Hana (Site Manager)",
  },
  {
    email: "dawit@zbe.com",
    pass: "Password123!",
    label: "Dawit (Site Manager)",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    
    setError(null);
    setIsPending(true);
    
    const { error: signInError } = await signIn.email({
      email,
      password,
    });
    
    setIsPending(false);
    
    if (signInError) {
      setError(signInError.message || "Failed to sign in");
    } else {
      router.push("/");
      // The AuthProvider will detect the change in session and handle the rest,
      // though Next.js client router might need a refresh to invalidate RSCs if they depend on cookies.
      // We will do a full refresh to be safe if the app has layout server components that need to read cookies.
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-2rem)] w-full items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="font-medium tracking-[-0.06em] text-[1.65rem] leading-none">
            ZBE
          </p>
          <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-yellow">
            Ops desk
          </p>
        </div>

        <div className="border border-black/10 bg-paper/40 p-5">
          <div className="mb-5">
            <p className="kicker">Access</p>
            <p className="mt-1 text-lg tracking-tight">Log in to your account</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email address">
              <input 
                type="email" 
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field" 
                required 
              />
            </Field>
            
            <Field label="Password">
              <input 
                type="password" 
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field" 
                required 
              />
            </Field>

            {error && (
              <div className="mt-2 border-l-2 border-bad bg-bad/10 px-3 py-2 text-sm text-bad">
                {error}
              </div>
            )}

            <div className="pt-2">
              <button 
                type="submit" 
                className="btn w-full justify-center" 
                disabled={isPending}
              >
                {isPending ? "Logging in..." : "Log in"}
              </button>
            </div>
          </form>
        </div>

        {process.env.NEXT_PUBLIC_USE_DEMO === "true" && (
          <div className="mt-8 border border-black/10 bg-paper/40 p-5">
            <p className="kicker mb-3">Demo personas (click to fill)</p>
            <div className="flex flex-col gap-[1px] bg-black/10">
              {AUTH_PERSONAS.map((p) => (
                <button
                  key={p.email}
                  type="button"
                  onClick={() => {
                    setEmail(p.email);
                    setPassword(p.pass);
                  }}
                  className="flex items-center justify-between bg-white px-3 py-2 text-left transition-colors hover:bg-black/5"
                >
                  <span className="text-sm font-medium">{p.label}</span>
                  <span className="font-mono text-[0.65rem] uppercase tracking-wider text-black/50">{p.email}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
