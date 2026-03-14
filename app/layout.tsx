import type { Metadata } from "next";
import "./globals.css";
import SiteFooter from "./components/site-footer";
import SiteHeader from "./components/site-header";

export const metadata: Metadata = {
  title: "Hotel Reservation System",
  description: "Book your perfect stay",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <SiteHeader />
          <main style={{ flex: 1 }}>{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
