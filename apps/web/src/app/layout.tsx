import type { Metadata } from "next";
import { cookies } from "next/headers";
import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { PrefsProvider } from "@/components/prefs";
import { LANG_COOKIE, THEME_COOKIE, type Lang, type Theme } from "@/lib/prefs";

export const metadata: Metadata = {
  title: "TIGERIS · Sovereign Intelligence OS",
  description: "Demonstration build. Public snapshots and synthetic data only.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const theme: Theme = jar.get(THEME_COOKIE)?.value === "light" ? "light" : "dark";
  const lang: Lang = jar.get(LANG_COOKIE)?.value === "ar" ? "ar" : "en";
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
