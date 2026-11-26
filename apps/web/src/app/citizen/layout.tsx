import type { Metadata } from "next";
import CitizenPortalGate from "../../components/layout/citizen-portal-gate";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CitizenLayout({ children }: { children: React.ReactNode }) {
  return <CitizenPortalGate>{children}</CitizenPortalGate>;
}