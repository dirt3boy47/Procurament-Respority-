"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/**
 * A form that submits to a Server Action, shows a toast with the result and
 * keeps the user's input if the action fails.
 */
export function ActionForm({
  action,
  children,
  className,
  onSuccess,
  resetOnSuccess = false,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: ReactNode | ((pending: boolean) => ReactNode);
  className?: string;
  onSuccess?: (result: ActionResult) => void;
  resetOnSuccess?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      ref={formRef}
      className={cn("flex flex-col gap-4", className)}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await action(formData);
          if (result.ok) {
            setError(null);
            if (result.message) toast.success(result.message);
            if (resetOnSuccess) formRef.current?.reset();
            onSuccess?.(result);
          } else {
            setError(result.error);
            toast.error(result.error);
          }
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        {typeof children === "function" ? children(pending) : children}
      </fieldset>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}
