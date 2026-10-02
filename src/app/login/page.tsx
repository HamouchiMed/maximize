import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = { title: "Log in — Maximize" };

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
