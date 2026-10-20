import { Card } from "@/components/ui/primitives";
import { RegisterForm } from "../auth-forms";

export const metadata = { title: "Open a trade account" };

export default function RegisterPage() {
  return (
    <Card className="w-full max-w-xl p-6">
      <h1 className="text-xl font-semibold">Open a trade account</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Submit order requests, receive quotations, upload POs and track deliveries online.</p>
      <RegisterForm />
    </Card>
  );
}
