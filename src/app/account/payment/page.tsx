import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymentPref } from "@/components/account/PaymentPref";

export const metadata = { title: "Payment methods — Maximize" };

export default async function PaymentPage() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) redirect("/login?redirect=/account/payment");

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Payment methods</h1>
      <p className="mt-1 text-sm text-muted">
        Choose how you&apos;d like to pay by default. For security, we never store card numbers.
      </p>
      <PaymentPref initial={user?.preferredPayment ?? null} />
    </div>
  );
}
