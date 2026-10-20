import type { Metadata } from "next";
import { Barlow, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";
import { CartProvider } from "@/components/catalog/cart";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const barlow = Barlow({ variable: "--font-barlow", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "Fermier Agency — Construction & Industrial Equipment", template: "%s · Fermier Agency" },
  description: "Construction, lifting, power and agricultural equipment — catalog, quotations and orders.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${barlow.variable} h-full antialiased`}>
      <body className="min-h-full">
        <CartProvider>{children}</CartProvider>
        <Toaster />
      </body>
    </html>
  );
}
