import { redirect } from "next/navigation";

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { q } = (await searchParams) as { q?: string };
  redirect(q ? `/catalog?q=${encodeURIComponent(q)}` : "/catalog?focus=search");
}
