function required(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return value;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  serviceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4480",
  isConfigured: () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
};
