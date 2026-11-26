import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Public Complaint Map",
  description: "Explore public civic complaints on the city map.",
  robots: { index: true, follow: true },
};

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}