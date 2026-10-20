import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { markNotificationsRead } from "../system-actions";

export default async function NotificationsPage() {
  const session = await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("id, title, body, link, read_at, created_at, event_type").eq("user_id", session.userId).order("created_at", { ascending: false }).limit(100);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Notifications" actions={<ActionForm action={markNotificationsRead}><SubmitButton variant="outline" size="sm">Mark all read</SubmitButton></ActionForm>} />
      <Card>
        {data?.length ? (
          <ul className="divide-y divide-line">
            {data.map((n) => (
              <li key={n.id} className={`flex items-start gap-3 px-4 py-3 ${n.read_at ? "" : "bg-brand-50/40"}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-line" : "bg-brand"}`} />
                <div className="flex-1">
                  {n.link ? <Link href={n.link} className="text-sm font-medium text-navy hover:underline">{n.title}</Link> : <p className="text-sm font-medium">{n.title}</p>}
                  {n.body && <p className="text-sm text-muted">{n.body}</p>}
                  <p className="text-xs text-muted">{formatDateTime(n.created_at)}</p>
                </div>
                {!n.read_at && <ActionForm action={markNotificationsRead}><input type="hidden" name="id" value={n.id} /><SubmitButton variant="ghost" size="sm">Mark read</SubmitButton></ActionForm>}
              </li>
            ))}
          </ul>
        ) : <EmptyState title="You're all caught up" />}
      </Card>
    </div>
  );
}
