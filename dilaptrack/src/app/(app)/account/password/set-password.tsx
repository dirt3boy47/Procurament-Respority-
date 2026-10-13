"use client";

import { useRouter } from "next/navigation";
import { PasswordForm } from "../account-forms";

export function SetPassword() {
  const router = useRouter();
  return <PasswordForm onDone={() => router.push("/")} />;
}
