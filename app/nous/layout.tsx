import type { Metadata, Viewport } from "next";
import "./nous.css";

export const metadata: Metadata = {
  title: "NOUS — notre vie à deux",
  description: "Listes, agenda, idées, courses et pense-bêtes partagés à deux.",
  applicationName: "NOUS",
  manifest: "/nous/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NOUS"
  },
  icons: {
    icon: "/nous-icon.svg",
    apple: "/nous-icon.svg"
  }
};

export const viewport: Viewport = {
  themeColor: "#f5efe7",
  viewportFit: "cover"
};

export default function NousLayout({children}:{children:React.ReactNode}){
  return <div className="nous-root">{children}</div>;
}
