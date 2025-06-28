import Script from "next/script";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata = {
  title: "Game of Trades",
  description: "A real-time stock market simulation game",
};

const GOOGLE_ANALYTICS_ID = process.env.GOOGLE_ANALYTICS_ID;
const sourceTag = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Script
          src={sourceTag}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GOOGLE_ANALYTICS_ID}');
        `}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
