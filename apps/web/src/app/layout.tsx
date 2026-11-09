import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import "@fontsource-variable/host-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "./globals.css";
import { PrefsProvider } from "@/components/prefs";
import { LANG_COOKIE, THEME_COOKIE, type Lang, type Theme } from "@/lib/prefs";

export const metadata: Metadata = {
  title: "TIGERIS · Sovereign Intelligence OS",
  description: "Demonstration build. Public snapshots and synthetic data only.",
};

/** Browser chrome matches the page background of the chosen theme. */
export async function generateViewport(): Promise<Viewport> {
  const jar = await cookies();
  const light = jar.get(THEME_COOKIE)?.value === "light";
  return { themeColor: light ? "#f6f5f0" : "#070d18", colorScheme: light ? "light" : "dark" };
}

/** Without a saved choice, the first language follows the browser (Accept-Language), never location. */
async function initialLang(saved: string | undefined): Promise<Lang> {
  if (saved === "ar" || saved === "en") return saved;
  const accept = (await headers()).get("accept-language") ?? "";
  const first = accept.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("ar") ? "ar" : "en";
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const theme: Theme = jar.get(THEME_COOKIE)?.value === "light" ? "light" : "dark";
  const lang: Lang = await initialLang(jar.get(LANG_COOKIE)?.value);
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} data-theme={theme}>
      <body>
        <PrefsProvider initialTheme={theme} initialLang={lang}>
          {children}
        </PrefsProvider>
      </body>
    </html>
  );
}
