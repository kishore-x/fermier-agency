"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { saveCategory } from "../catalog-actions";

export function EditCategory({ c, parents }: {
  c: { id: string; name: string; slug: string; description: string | null; parent_id: string | null; sort_order: number;
    overview?: string | null; key_points?: string[]; applications?: string[]; buying_guide?: { title: string; text: string }[]; faqs?: { q: string; a: string }[] };
  parents: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Edit</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5" onClick={(e) => e.stopPropagation()}>
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
              <Field label="Short description" name="description"><Input id="description" name="description" defaultValue={c.description ?? ""} /></Field>
              <input type="hidden" name="with_content" value="1" />
              <p className="border-t border-line pt-3 text-xs font-semibold uppercase tracking-wide text-muted">Category page content</p>
              <Field label="Overview" name="overview" hint="Separate paragraphs with a blank line"><Textarea id="overview" name="overview" rows={5} defaultValue={c.overview ?? ""} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="What we offer (one per line)" name="key_points"><Textarea id="key_points" name="key_points" rows={4} defaultValue={(c.key_points ?? []).join("\n")} /></Field>
                <Field label="Applications (one per line)" name="applications"><Textarea id="applications" name="applications" rows={4} defaultValue={(c.applications ?? []).join("\n")} /></Field>
              </div>
              <Field label="How to choose" name="buying_guide" hint="One tip per line:  Title | explanation"><Textarea id="buying_guide" name="buying_guide" rows={4} defaultValue={(c.buying_guide ?? []).map((g) => `${g.title} | ${g.text}`).join("\n")} /></Field>
              <Field label="FAQs" name="faqs" hint="One per line:  Question | Answer"><Textarea id="faqs" name="faqs" rows={4} defaultValue={(c.faqs ?? []).map((f) => `${f.q} | ${f.a}`).join("\n")} /></Field>
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
