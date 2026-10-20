import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";
import { CartProvider } from "@/components/catalog/cart";
import { SetupRequired } from "@/components/setup-required";
import { env } from "@/lib/env";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Fermier Agency — Construction & Industrial Equipment", template: "%s · Fermier Agency" },
  description: "Construction, lifting, power and agricultural equipment — catalog, quotations and orders.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        {env.isConfigured() ? <CartProvider>{children}</CartProvider> : <SetupRequired />}
        <Toaster />
      </body>
    </html>
  );
}
