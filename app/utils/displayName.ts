/**
 * Returns Googer Support only for super admin users, normal names for everyone else.
 * Use this everywhere a user's display name is rendered.
 */
export function displayName(
    user_type: string | null | undefined,
    full_name: string | null | undefined,
    username: string | null | undefined
): string {
    const type = String(user_type || "").toLowerCase().replace(/[\s-]+/g, "_");
    if (type === "superadmin" || type === "super_admin") return "Googer Support";
    return full_name || username || "";
}
