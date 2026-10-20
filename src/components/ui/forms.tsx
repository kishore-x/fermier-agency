"use client";

import * as React from "react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ActionState } from "@/lib/actions";
import { Alert, Button } from "./primitives";
import { toast } from "./toast";

export function SubmitButton({ children, pendingText, ...props }: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? pendingText ?? "Saving…" : children}
    </Button>
  );
}

type FormAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** Server-action form with inline error + success toast. */
export function ActionForm({ action, children, className, onSuccess, resetOnSuccess }: {
  action: FormAction; children: React.ReactNode | ((s: ActionState) => React.ReactNode); className?: string;
  onSuccess?: () => void; resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      if (state.message) toast(state.message);
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    } else if (state?.error && !state.fieldErrors) {
      toast(state.error, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {state?.error && <Alert tone="error" className="mb-4">{state.error}</Alert>}
      {typeof children === "function" ? children(state) : children}
    </form>
  );
}

/** Button that opens a confirmation dialog, then submits a server action. */
export function ConfirmAction({ action, title, description, confirmLabel = "Confirm", trigger, triggerVariant = "outline", fields, tone = "primary", requireNote }: {
  action: FormAction; title: string; description?: string; confirmLabel?: string; trigger: React.ReactNode;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"]; fields?: Record<string, string>;
  tone?: "primary" | "danger" | "success"; requireNote?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={triggerVariant} size="sm" onClick={() => setOpen(true)}>{trigger}</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            <ActionForm action={action} className="mt-4 space-y-4" onSuccess={() => setOpen(false)}>
              {Object.entries(fields ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
              {requireNote && (
                <textarea name="note" required placeholder={requireNote}
                  className="min-h-20 w-full rounded-md border border-line p-2 text-sm focus:border-navy focus:outline-none" />
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <SubmitButton variant={tone} pendingText="Working…">{confirmLabel}</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </div>
      )}
    </>
  );
}
