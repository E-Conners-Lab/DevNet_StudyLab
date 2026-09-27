import { APP_NAME } from "@/lib/product";
import type { Metadata } from "next";
import "./globals.css";


export const metadata: Metadata = {
  title: APP_NAME,
  description: "Local supplementary study tools based on historical Cisco DevNet 200-901 objectives",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
