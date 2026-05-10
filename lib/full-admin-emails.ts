/** Varsayılan tam yetkili (ek ortam listesi yoksa) */
const DEFAULT_FULL_ADMIN_EMAIL = "ugurgrses@gmail.com";

/** Tam yetkili e-postalar: varsayılan + NEXT_PUBLIC_ADMIN_EMAILS (virgülle) */
export function getFullAdminEmailSet(): Set<string> {
  const set = new Set<string>();
  set.add(DEFAULT_FULL_ADMIN_EMAIL.trim().toLowerCase());
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "";
  raw.split(",").forEach((part) => {
    const e = part.trim().toLowerCase();
    if (e) set.add(e);
  });
  return set;
}
