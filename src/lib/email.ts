import "server-only";

export type EmailResult = { status: "sent"; id: string } | { status: "not_configured" } | { status: "failed"; error: string };

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** Sends through Resend when configured. Never reports success unless the provider accepted the message. */
export async function sendEmail(opts: {
  to: string; subject: string; html: string; attachments?: { filename: string; content: Buffer }[];
}): Promise<EmailResult> {
  if (!emailConfigured()) return { status: "not_configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM, to: [opts.to], subject: opts.subject, html: opts.html,
        attachments: opts.attachments?.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { status: "failed", error: (body as { message?: string }).message ?? `HTTP ${res.status}` };
    return { status: "sent", id: (body as { id: string }).id };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : "Network error" };
  }
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
