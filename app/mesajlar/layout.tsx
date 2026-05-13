import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Mesajlar",
  description: "Proje sohbetleri ve okunmamış mesajlar",
};

export default function MesajlarLayout({ children }: { children: ReactNode }) {
  return children;
}
