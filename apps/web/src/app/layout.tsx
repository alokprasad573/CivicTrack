import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ToastProvider } from "../components/ui/toast-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "CivicTrack — Smart Civic Complaint Management System",
  description:
    "Empowering citizens and municipal departments with transparent, real-time civic issue reporting and resolution tracking.",
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
          colorPrimary: "#2563EB", // PolicyOracle Blue
          colorBackground: "#FFFFFF", // Pure white card
          colorForeground: "#0F172A", // Dark slate
          colorMutedForeground: "#64748B", // Slate gray
          colorDanger: "#EF4444", // Red error
          borderRadius: "0.75rem",
        },
        elements: {
          card: "bg-white border border-slate-200 shadow-xl shadow-blue-500/5 rounded-2xl",
          headerTitle: "text-slate-900 font-bold text-xl tracking-tight",
          headerSubtitle: "text-slate-500 text-sm",
          formButtonPrimary:
            "bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all shadow-md shadow-blue-500/20 active:scale-[0.98]",
          footerActionLink: "text-blue-600 hover:text-blue-700 font-semibold",
          formFieldInput:
            "rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800",
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                try {
                  localStorage.removeItem("civictrack-theme");
                  document.documentElement.classList.remove("dark");
                } catch (_) {}
              `,
            }}
          />
        </head>
        <body className="min-h-screen bg-background font-sans antialiased text-foreground">
          <ToastProvider>
            {children}
          </ToastProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
