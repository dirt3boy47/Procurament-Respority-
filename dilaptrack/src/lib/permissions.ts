import type { Enums } from "@/lib/database.types";

export type Role = Enums<"app_role">;

/**
 * What each role may do in the UI. The database enforces the same rules with
 * Row Level Security, so hiding a button is a convenience, not the protection.
 */
export function capabilities(role: Role | null | undefined) {
  const manage = role === "admin" || role === "project_manager";
  const edit = manage || role === "site_engineer";
  return {
    view: Boolean(role),
    /** Surveys, uploads, landholder details. */
    editRecords: edit,
    /** Lot register, import, landholder sign-off, close-out, deletes. */
    manage,
    /** Users and roles. */
    admin: role === "admin",
  };
}

export type Capabilities = ReturnType<typeof capabilities>;
