import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand">404</p>
      <h1 className="mt-2 text-2xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-md text-sm text-muted">The product or record may have been removed, or you may not have access to it.</p>
      <div className="mt-6 flex gap-2">
        <Link href="/" className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white">Home</Link>
        <Link href="/catalog" className="rounded-md border border-line bg-white px-4 py-2 text-sm font-medium">Browse catalog</Link>
      </div>
    </div>
  );
}
