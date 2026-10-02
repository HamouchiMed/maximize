import Link from "next/link";
import { Clock } from "lucide-react";

export const metadata = { title: "Coming soon — Maximize" };

export default async function ComingSoonPage({
  searchParams,
}: {
  searchParams: Promise<{ feature?: string }>;
}) {
  const { feature } = await searchParams;
  const name = feature?.trim() || "This feature";

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <Clock size={56} className="text-border" />
      <h1 className="mt-6 text-2xl font-bold tracking-tight">{name} is coming soon</h1>
      <p className="mt-3 text-muted">
        We&apos;re still building this part of your account. Check back soon!
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/account/orders"
          className="rounded-full border px-7 py-3 text-sm font-semibold hover:bg-surface"
        >
          My orders
        </Link>
        <Link
          href="/products"
          className="rounded-full bg-foreground px-7 py-3 text-sm font-semibold text-background hover:opacity-90"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
