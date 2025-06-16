import { GeistSans, GeistMono } from "geist/font";
import "./globals.css";

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata = {
  title: "Stock Market Simulator",
  description: "A real-time stock market simulation game",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
