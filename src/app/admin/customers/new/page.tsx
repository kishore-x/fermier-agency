import { PageHeader } from "@/components/ui/primitives";
import { can, requireStaff } from "@/lib/auth";
import { getSalespeople } from "@/lib/queries/staff";
import { CustomerForm } from "../customer-form";

export default async function NewCustomerPage() {
  const session = await requireStaff("admin", "sales_manager", "sales_executive");
  return (
    <div className="max-w-4xl">
      <PageHeader title="New customer" back={{ href: "/admin/customers", label: "Customers" }} />
      <CustomerForm salespeople={await getSalespeople()} canManageTerms={can.approve(session)} c={{ salesperson_id: session.userId }} />
    </div>
  );
}
