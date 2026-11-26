import type { Metadata } from "next";
import OfficerPortalGate from "../../components/layout/officer-portal-gate";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function OfficerLayout({ children }: { children: React.ReactNode }) {
  return <OfficerPortalGate>{children}</OfficerPortalGate>;
}