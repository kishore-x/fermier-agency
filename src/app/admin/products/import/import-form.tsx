"use client";

import { useActionState } from "react";
import { Alert, Card, CardHeader, Field, Select } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/forms";
import { importProductsCsv, type ImportResult } from "../actions";

export function ImportForm() {
  const [state, action] = useActionState<ImportResult, FormData>(importProductsCsv, null);
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <form action={action} className="grid gap-4 sm:grid-cols-[1fr_220px_auto] sm:items-end">
          <Field label="CSV file" name="file" required>
            <input id="file" type="file" name="file" accept=".csv,text/csv" required className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-navy file:px-3 file:py-2 file:text-white" />
          </Field>
          <Field label="Mode" name="mode">
            <Select id="mode" name="mode" defaultValue="create_only">
              <option value="create_only">Create new only (reject existing SKUs)</option>
              <option value="upsert">Create or update by SKU</option>
            </Select>
          </Field>
          <SubmitButton pendingText="Validating…">Validate & import</SubmitButton>
        </form>
      </Card>
      {state?.ok && <Alert tone="success">{state.message}</Alert>}
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.rowErrors && (
        <Card>
          <CardHeader title={`Rows with problems (${state.rowErrors.length})`} description="No rows were imported. Correct these and re-upload the whole file." />
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-canvas text-left text-xs uppercase text-muted"><th className="px-4 py-2">Row</th><th className="px-4 py-2">SKU</th><th className="px-4 py-2">Problems</th></tr></thead>
              <tbody>
                {state.rowErrors.map((r) => (
                  <tr key={`${r.row}-${r.sku}`} className="border-b border-line align-top">
                    <td className="px-4 py-2 tnum">{r.row}</td><td className="px-4 py-2 font-mono text-xs">{r.sku || "—"}</td>
                    <td className="px-4 py-2 text-danger">{r.errors.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
