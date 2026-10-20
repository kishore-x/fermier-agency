import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CartView } from "./cart-view";

export const metadata = { title: "Cart" };

export default async function CartPage() {
  const session = await requireCustomer();
  const supabase = await createClient();
  const [{ data: addresses }, { data: cust }] = await Promise.all([
    supabase.from("customer_addresses").select("id, label, line1, city, state, postal_code, is_default").eq("customer_id", session.customerId).order("is_default", { ascending: false }),
    supabase.from("customers").select("billing_address").eq("id", session.customerId).single(),
  ]);
  const list = (addresses ?? []).map((a) => ({ id: a.id, text: [a.label && `${a.label}:`, a.line1, a.city, a.state, a.postal_code].filter(Boolean).join(" ").replace(": ", ": ") }));
  if (!list.length && cust?.billing_address) list.push({ id: "billing", text: cust.billing_address });
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Your cart</h1>
      <CartView addresses={list} />
    </>
  );
}
