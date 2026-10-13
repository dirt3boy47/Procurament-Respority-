import { z } from "zod";

/** Optional free text: trimmed, blank -> null. */
export const text = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .transform((v) => (v === "" ? null : v));

/** Required free text. */
export const requiredText = (label: string, max = 2000) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

/** Optional YYYY-MM-DD date. */
export const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), "Enter a valid date")
  .transform((v) => (v === "" ? null : v));

export const uuid = z.string().uuid();

/** FormData -> plain object of strings for the given keys (missing -> ""). */
export function formFields<K extends string>(formData: FormData, keys: readonly K[]): Record<K, string> {
  return Object.fromEntries(
    keys.map((k) => {
      const v = formData.get(k);
      return [k, typeof v === "string" ? v : ""];
    }),
  ) as Record<K, string>;
}

export function firstIssue(error: z.ZodError) {
  const issue = error.issues[0];
  return issue?.message ?? "Please check the form";
}
