import "./globals.css";
import Providers from "@/components/Providers";

export const metadata = {
  title: "Game of Trades",
  description: "A real-time stock market simulation game",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
