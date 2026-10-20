import { Logo } from "@/components/catalog/site-chrome";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-center bg-navy"><Logo /></header>
      <main className="flex flex-1 items-start justify-center px-4 py-10">{children}</main>
    </div>
  );
}
