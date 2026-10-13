import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Empty / whitespace-only form values become null. */
export function blankToNull(value: FormDataEntryValue | null | undefined) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v === "" ? null : v;
}
