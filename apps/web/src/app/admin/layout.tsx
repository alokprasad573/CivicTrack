import type { Metadata } from "next";
import AdminPortalGate from "../../components/layout/admin-portal-gate";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminPortalGate>{children}</AdminPortalGate>;
}