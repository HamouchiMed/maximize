import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AddressManager } from "@/components/account/AddressManager";

export const metadata = { title: "Shipping addresses — Maximize" };

export default async function AddressesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/account/addresses");

  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Shipping addresses</h1>
      <AddressManager
        initial={addresses.map((a) => ({
          id: a.id,
          fullName: a.fullName,
          phone: a.phone,
          line1: a.line1,
          city: a.city,
          region: a.region,
          isDefault: a.isDefault,
        }))}
      />
    </div>
  );
}
