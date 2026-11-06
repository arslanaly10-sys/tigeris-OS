export type Theme = "dark" | "light";
export type Lang = "en" | "ar";
export const THEME_COOKIE = "tigeris_theme";
export const LANG_COOKIE = "tigeris_lang";

export function setPrefCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}
