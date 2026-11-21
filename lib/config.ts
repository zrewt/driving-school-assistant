// Small helpers for reading settings from environment variables.
// Values come from .env.local (locally) or Vercel's Environment Variables.

/** True if a value is missing or still one of the placeholders from .env.example. */
export function isPlaceholder(value: string | undefined): boolean {
  if (!value || value.trim() === "") return true;
  return (
    value.includes("your-") ||
    value.startsWith("replace-with") ||
    value.includes("xxxxxxxx") ||
    value === "+15555550100"
  );
}

export function isSupabaseConfigured(): boolean {
  return (
    !isPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    !isPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export function isServiceRoleConfigured(): boolean {
  return isSupabaseConfigured() && !isPlaceholder(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** MOCK_SMS=true → texts are printed to the terminal instead of sent. */
export function isMockSms(): boolean {
  return process.env.MOCK_SMS === "true";
}

/** The key used to check Retell's webhook signature (or null if none is set). */
export function retellSigningKey(): string | null {
  const secret = process.env.RETELL_WEBHOOK_SECRET;
  if (!isPlaceholder(secret)) return secret!;
  const apiKey = process.env.RETELL_API_KEY;
  if (!isPlaceholder(apiKey)) return apiKey!;
  return null;
}
