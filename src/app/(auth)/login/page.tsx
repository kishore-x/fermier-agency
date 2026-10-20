import { Card } from "@/components/ui/primitives";
import { USERS } from "@/lib/demo-seed";
import { env } from "@/lib/env";
import { LOCAL_DEMO_PASSWORD } from "@/lib/local/seed";
import { DemoLogin, LoginForm } from "../auth-forms";

export const metadata = { title: "Sign in" };

const ROLE_NAME: Record<string, string> = {
  super_admin: "Super Admin", admin: "Admin", sales_manager: "Sales Manager", sales_executive: "Sales Executive",
  inventory_manager: "Inventory Manager", customer: "Customer",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = (await searchParams) as { next?: string };
  const local = env.isLocal();
  return (
    <div className="flex w-full max-w-3xl flex-col gap-4 md:flex-row md:items-start">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mb-5 mt-1 text-sm text-muted">Customers and staff use the same sign-in.</p>
        <LoginForm next={next} />
      </Card>
      {local && (
        <Card className="w-full p-6">
          <h2 className="text-sm font-semibold">Demo accounts</h2>
          <p className="mb-3 mt-1 text-xs text-muted">Local demo database (sample data). Password for all: <code className="rounded bg-canvas px-1">{LOCAL_DEMO_PASSWORD}</code></p>
          <div className="space-y-1.5">
            {USERS.map((u) => (
              <DemoLogin key={u.email} email={u.email} password={LOCAL_DEMO_PASSWORD} label={u.roles.map((r) => ROLE_NAME[r]).join(", ")} sub={u.email} next={next} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
