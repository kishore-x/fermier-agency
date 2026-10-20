import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { ContactForm } from "@/app/(auth)/auth-forms";
import { Card } from "@/components/ui/primitives";
import { getCompany, whatsappLink } from "@/lib/queries/catalog";

export const metadata = { title: "Contact us" };

export default async function ContactPage() {
  const c = await getCompany();
  const wa = whatsappLink(c?.whatsapp_number, "Hello Fermier Agency, I have an enquiry.");
  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 md:grid-cols-[1fr_1.4fr]">
      <div>
        <h1 className="text-2xl font-semibold">Contact our sales team</h1>
        <p className="mt-2 text-sm text-muted">Tell us what you need and a salesperson will respond with availability and pricing.</p>
        <ul className="mt-6 space-y-3 text-sm">
          {c?.address && <li className="flex gap-2"><MapPin className="h-4 w-4 text-brand" />{c.address}</li>}
          {c?.phone && <li className="flex gap-2"><Phone className="h-4 w-4 text-brand" /><a href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a></li>}
          {c?.email && <li className="flex gap-2"><Mail className="h-4 w-4 text-brand" /><a href={`mailto:${c.email}`}>{c.email}</a></li>}
          {wa && <li className="flex gap-2"><MessageCircle className="h-4 w-4 text-brand" /><a href={wa} target="_blank" rel="noopener noreferrer" className="text-navy hover:underline">Chat on WhatsApp (opens WhatsApp)</a></li>}
        </ul>
      </div>
      <Card className="p-5"><ContactForm /></Card>
    </div>
  );
}
