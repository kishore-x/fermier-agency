import { PageHeader } from "@/components/ui/primitives";
import { can, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "../product-form";

export default async function NewProductPage() {
  const session = await requireStaff("admin");
  const supabase = await createClient();
  const [{ data: categories }, { data: brands }] = await Promise.all([
    supabase.from("categories").select("id, name, parent_id").order("sort_order"),
    supabase.from("brands").select("id, name").order("name"),
  ]);
  return (
    <div className="max-w-4xl">
      <PageHeader title="New product" back={{ href: "/admin/products", label: "Products" }}
        description="Images and brochures can be added after the product is created." />
      <ProductForm categories={categories ?? []} brands={brands ?? []} showCost={can.viewCost(session)} />
    </div>
  );
}
