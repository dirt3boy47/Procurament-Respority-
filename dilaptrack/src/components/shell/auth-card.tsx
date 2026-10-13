import type { ReactNode } from "react";
import { Logo } from "./logo";

export function AuthCard({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-fg">{description}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </main>
  );
}
