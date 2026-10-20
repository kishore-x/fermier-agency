"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { saveCategory } from "../catalog-actions";

export function EditCategory({ c, parents }: {
  c: { id: string; name: string; slug: string; description: string | null; parent_id: string | null; sort_order: number };
  parents: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Edit</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-lg bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 font-semibold">Edit category</h2>
            <ActionForm action={saveCategory} className="space-y-3" onSuccess={() => setOpen(false)}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="sort_order" value={c.sort_order} />
              <Field label="Name" name="name" required><Input id="name" name="name" defaultValue={c.name} required /></Field>
              <Field label="Slug" name="slug" hint="Changing the slug changes the public URL"><Input id="slug" name="slug" defaultValue={c.slug} /></Field>
              <Field label="Parent" name="parent_id">
                <Select id="parent_id" name="parent_id" defaultValue={c.parent_id ?? ""}>
                  <option value="">None — top level</option>
                  {parents.filter((p) => p.id !== c.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
              <Field label="Description" name="description"><Input id="description" name="description" defaultValue={c.description ?? ""} /></Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <SubmitButton>Save</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </div>
      )}
    </>
  );
}
