import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="7" fill="var(--primary)" />
        <path d="M8 22V12l8-5 8 5v10h-5v-6h-6v6z" fill="#fff" />
      </svg>
      <span>
        Dilap<span className="text-primary">Track</span>
      </span>
    </Link>
  );
}
