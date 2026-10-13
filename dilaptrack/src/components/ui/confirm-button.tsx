"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "./button";

/** A button that asks for confirmation, runs a Server Action and refreshes the page. */
export function ConfirmButton({
  action,
  confirmText,
  children,
  variant = "secondary",
  size = "md",
  className,
  disabled,
}: {
  action: () => Promise<ActionResult>;
  confirmText?: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
  className?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={pending || disabled}
      onClick={() => {
        if (confirmText && !confirm(confirmText)) return;
        startTransition(async () => {
          const result = await action();
          if (!result) return; // redirected
          if (result.ok) {
            if (result.message) toast.success(result.message);
            router.refresh();
          } else toast.error(result.error);
        });
      }}
    >
      {children}
    </Button>
  );
}
