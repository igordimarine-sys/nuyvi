import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loja N.UY",
  description: "Loja N.UY",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
