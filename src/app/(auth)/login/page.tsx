import { Card } from "@/components/ui/primitives";
import { LoginForm } from "../auth-forms";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = (await searchParams) as { next?: string };
  return (
    <Card className="w-full max-w-sm p-6">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Customers and staff use the same sign-in.</p>
      <LoginForm next={next} />
    </Card>
  );
}
