import Link from "next/link";
import { redirect } from "next/navigation";
import { Ticket } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CouponCards } from "@/components/account/CouponCards";

export const metadata = { title: "My coupons — Maximize" };

export default async function CouponsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/account/coupons");

  const coupons = await prisma.coupon.findMany({
    where: { active: true },
    orderBy: { minSubtotalCents: "asc" },
    select: { code: true, description: true },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">My coupons</h1>
      <p className="mt-1 text-sm text-muted">
        Copy a code and paste it in your cart to save.
      </p>

      {coupons.length === 0 ? (
        <div className="mt-12 flex flex-col items-center text-center">
          <Ticket size={48} className="text-border" />
          <p className="mt-4 text-muted">No coupons available right now.</p>
          <Link
            href="/products"
            className="mt-6 rounded-full bg-foreground px-7 py-3 text-sm font-semibold text-background hover:opacity-90"
          >
            Keep shopping
          </Link>
        </div>
      ) : (
        <CouponCards coupons={coupons} />
      )}
    </div>
  );
}
