import type { ReactNode } from "react";
import { Montserrat } from "next/font/google";

import "./globals.css";
import { PageTransition } from "./_components/page-transition";
import { ToastProvider } from "./_components/toast";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body>
        <ToastProvider>
          <PageTransition>{children}</PageTransition>
        </ToastProvider>
      </body>
    </html>
  );
}
