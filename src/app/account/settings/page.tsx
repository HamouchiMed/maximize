import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "@/components/account/SettingsForm";

export const metadata = { title: "Account settings — Maximize" };

export default async function SettingsPage() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) redirect("/login?redirect=/account/settings");

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <SettingsForm
        email={user.email}
        initialName={user.name ?? ""}
        initialImage={user.image}
        initialCountry={user.country ?? ""}
        hasPassword={Boolean(user.passwordHash)}
      />
    </div>
  );
}
