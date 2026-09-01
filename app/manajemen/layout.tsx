import type { ReactNode } from "react";
import { ManajemenGuard } from "@/components/layout/ManajemenGuard";

export const metadata = {
  title: "POV Manajemen — RedBox ERP",
  description: "Back-office management dashboard for RedBox ERP",
};

export default function ManajemenLayout({ children }: { children: ReactNode }) {
  return <ManajemenGuard>{children}</ManajemenGuard>;
}
