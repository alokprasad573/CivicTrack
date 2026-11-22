import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "../components/theme/theme-context";
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
          colorPrimary: "hsl(13, 67%, 54%)", // Terracotta #D95D39
          colorBackground: "hsl(150, 8%, 10%)", // Forest charcoal
          colorForeground: "hsl(38, 23%, 93%)",
          colorMutedForeground: "hsl(150, 4%, 65%)",
          colorDanger: "hsl(0, 68%, 52%)",
          borderRadius: "0.75rem",
        },
        elements: {
          card: "bg-card border border-border shadow-xl rounded-2xl",
          headerTitle: "text-foreground font-semibold",
          headerSubtitle: "text-muted-foreground",
          formButtonPrimary:
            "bg-primary hover:bg-[#c34e2c] text-white font-semibold transition rounded-xl",
          footerActionLink: "text-primary hover:text-[#c34e2c] font-medium",
        },
      }}
    >
      <html lang="en" className="dark" suppressHydrationWarning>
        <body className="min-h-screen bg-background font-sans antialiased text-foreground">
          <ThemeProvider>{children}</ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
