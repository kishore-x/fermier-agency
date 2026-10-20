export function SetupRequired() {
  const steps = [
    ["Create a Supabase project", "supabase.com → New project (region: Mumbai for Indian customers)."],
    ["Add environment variables", "Copy .env.example to .env.local and fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY."],
    ["Apply the database", "supabase link --project-ref <ref> && supabase db push --include-seed"],
    ["Create demo logins and sample orders", "DEMO_PASSWORD=<choose one> npm run seed:demo"],
    ["Restart the dev server", "npm run dev"],
  ];
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-xl rounded-lg border border-line bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-brand text-sm font-bold text-white">F</span>
          <h1 className="text-lg font-semibold">Fermier Agency — setup required</h1>
        </div>
        <p className="text-sm text-muted">The database isn&apos;t connected yet, so no pages can load data. Nothing is mocked: catalog, orders and stock all live in Supabase.</p>
        <ol className="mt-5 space-y-3">
          {steps.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">{i + 1}</span>
              <div><p className="text-sm font-medium">{t}</p><p className="font-mono text-xs text-muted">{d}</p></div>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-xs text-muted">See README.md for full instructions, Vercel deployment and Zoho Books connection.</p>
      </div>
    </div>
  );
}
