import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Charlie Training",
  description: "Carnet d'entraînement personnel mobile-first"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
