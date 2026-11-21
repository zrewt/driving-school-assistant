import { isSupabaseConfigured } from "@/lib/config";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold">Missed-Call Assistant</h1>
        <p className="mt-1 mb-6 text-sm text-slate-600">Log in to see your leads.</p>
        {!isSupabaseConfigured() && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Supabase isn&apos;t connected yet. Add your Supabase URL and keys to{" "}
            <code>.env.local</code>, then restart the app.
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
