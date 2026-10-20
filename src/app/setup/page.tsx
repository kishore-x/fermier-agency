import { redirect } from "next/navigation";
import { SetupRequired } from "@/components/setup-required";
import { env } from "@/lib/env";

export const metadata = { title: "Setup required" };

export default function SetupPage() {
  if (env.isConfigured()) redirect("/");
  return <SetupRequired />;
}
