import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Financeiro | IG Integra Gestão",
  description: "Controle de entradas, saídas, contas a receber e pessoas que pagaram.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}<Toaster richColors position="top-right" /></body>
    </html>
  );
}
