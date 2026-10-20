"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-muted">The page couldn&apos;t be loaded. Please try again. {error.digest && <span className="block text-xs">Reference: {error.digest}</span>}</p>
      <button onClick={reset} className="mt-4 rounded-md bg-navy px-4 py-2 text-sm font-medium text-white">Try again</button>
    </div>
  );
}
