import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ToastProvider } from "../components/ui/toast-context";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://civic-track-beta-three.vercel.app/";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "CivicTrack — Smart Civic Complaint Management Platform",
    template: "%s | CivicTrack",
  },
  description:
    "Empowering citizens and municipal departments with transparent, real-time civic issue reporting and resolution tracking.",
  applicationName: "CivicTrack",
  openGraph: {
    type: "website",
    siteName: "CivicTrack",
    title: "CivicTrack — Smart Civic Complaint Management System",
    description:
      "Empowering citizens and municipal departments with transparent, real-time civic issue reporting and resolution tracking.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "CivicTrack — Smart Civic Complaint Management System",
    description:
      "Empowering citizens and municipal departments with transparent, real-time civic issue reporting and resolution tracking.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#2563EB",
          colorBackground: "#FFFFFF",
          colorForeground: "#0F172A",
          colorMutedForeground: "#475569",
          colorDanger: "#DC2626",
          borderRadius: "0.75rem",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", system-ui, sans-serif',
        },
        elements: {
          card: "bg-white border border-slate-200/90 shadow-elevated rounded-2xl",
          headerTitle: "text-slate-900 font-semibold text-xl tracking-tight",
          headerSubtitle: "text-slate-600 text-sm",
          formButtonPrimary:
            "bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors duration-150 shadow-hairline active:scale-[0.98]",
          footerActionLink: "text-blue-600 hover:text-blue-700 font-medium",
          formFieldInput:
            "rounded-xl border border-slate-200 bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none text-slate-900 min-h-[44px]",
        },
      }}
    >
      <html lang="en">
        <body className="min-h-screen bg-background font-sans antialiased text-foreground selection:bg-blue-600/15 selection:text-blue-700">
          <ToastProvider>{children}</ToastProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
