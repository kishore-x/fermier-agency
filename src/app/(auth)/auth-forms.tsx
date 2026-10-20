"use client";

import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Field, Input } from "@/components/ui/primitives";
import { register, signIn, submitContact } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={signIn} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" name="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Password" name="password"><Input id="password" name="password" type="password" autoComplete="current-password" required /></Field>
      <SubmitButton className="w-full" pendingText="Signing in…">Sign in</SubmitButton>
      <p className="text-center text-sm text-muted">New customer? <Link href="/register" className="font-medium text-navy hover:underline">Open a trade account</Link></p>
    </ActionForm>
  );
}

export function DemoLogin({ email, password, label, sub, next }: { email: string; password: string; label: string; sub: string; next?: string }) {
  return (
    <ActionForm action={signIn}>
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="password" value={password} />
      <input type="hidden" name="next" value={next ?? ""} />
      <button className="flex w-full items-center justify-between rounded-md border border-line px-3 py-2 text-left text-sm hover:border-navy/40 hover:bg-canvas">
        <span><span className="font-medium">{label}</span><span className="block text-xs text-muted">{sub}</span></span>
        <span className="text-xs font-medium text-navy">Sign in →</span>
      </button>
    </ActionForm>
  );
}

export function RegisterForm() {
  return (
    <ActionForm action={register} className="space-y-4">
      {(s) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" name="full_name" required error={s?.fieldErrors?.full_name}><Input id="full_name" name="full_name" autoComplete="name" required /></Field>
            <Field label="Company name" name="company_name" required error={s?.fieldErrors?.company_name}><Input id="company_name" name="company_name" autoComplete="organization" required /></Field>
            <Field label="Work email" name="email" required error={s?.fieldErrors?.email}><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
            <Field label="Phone" name="phone" required error={s?.fieldErrors?.phone}><Input id="phone" name="phone" type="tel" autoComplete="tel" required /></Field>
            <Field label="State" name="state" error={s?.fieldErrors?.state}><Input id="state" name="state" /></Field>
            <Field label="GSTIN (optional)" name="gstin" error={s?.fieldErrors?.gstin}><Input id="gstin" name="gstin" maxLength={15} className="uppercase" /></Field>
          </div>
          <Field label="Password" name="password" required hint="At least 8 characters" error={s?.fieldErrors?.password}>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </Field>
          <SubmitButton className="w-full" variant="success" pendingText="Creating account…">Create account</SubmitButton>
          <p className="text-center text-sm text-muted">Already registered? <Link href="/login" className="font-medium text-navy hover:underline">Sign in</Link></p>
        </>
      )}
    </ActionForm>
  );
}

export function ContactForm({ product }: { product?: string }) {
  return (
    <ActionForm action={submitContact} className="space-y-4" resetOnSuccess>
      {(s) => (
        <>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" name="name" required error={s?.fieldErrors?.name}><Input id="name" name="name" required /></Field>
            <Field label="Company" name="company"><Input id="company" name="company" /></Field>
            <Field label="Email" name="email" required error={s?.fieldErrors?.email}><Input id="email" name="email" type="email" required /></Field>
            <Field label="Phone" name="phone"><Input id="phone" name="phone" type="tel" /></Field>
          </div>
          <Field label="What do you need?" name="message" required error={s?.fieldErrors?.message}>
            <textarea id="message" name="message" required rows={5} placeholder="Products, quantities, site location, timeline…" defaultValue={product ? `Enquiry for ${product}\nQuantity: \nSite location: \nRequired by: ` : undefined}
              className="w-full rounded-md border border-line p-3 text-sm focus:border-navy focus:outline-none" />
          </Field>
          {s?.ok && <p className="rounded-md bg-brand-50 p-3 text-sm text-brand-600">{s.message}</p>}
          <SubmitButton variant="success" pendingText="Sending…">Send enquiry</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
