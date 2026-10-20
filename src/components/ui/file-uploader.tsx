"use client";

import { useState } from "react";
import { UploadCloud } from "lucide-react";
import type { ActionState } from "@/lib/actions";
import { ActionForm, SubmitButton } from "./forms";

export function FileUploader({ action, fields, accept, multiple, label, hint, buttonLabel = "Upload" }: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>; fields: Record<string, string>; accept: string;
  multiple?: boolean; label: string; hint: string; buttonLabel?: string;
}) {
  const [names, setNames] = useState<string[]>([]);
  return (
    <ActionForm action={action} resetOnSuccess onSuccess={() => setNames([])} className="space-y-2">
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line bg-canvas/50 px-4 py-6 text-center hover:border-navy/40">
        <UploadCloud className="h-6 w-6 text-muted" />
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted">{hint}</span>
        <input type="file" name="files" accept={accept} multiple={multiple} className="sr-only" required
          onChange={(e) => setNames(Array.from(e.target.files ?? []).map((f) => f.name))} />
      </label>
      {names.length > 0 && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate text-muted">{names.join(", ")}</span>
          <SubmitButton size="sm" pendingText="Uploading…">{buttonLabel}</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}
