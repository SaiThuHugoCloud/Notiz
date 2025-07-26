// NOTIZ-NEW/src/app/layout.js
import { Geist, Geist_Mono } from "next/font/google";
import { Noto_Sans_Myanmar } from "next/font/google"; // <--- NEW: Import Noto Sans Myanmar
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap',
});

// <--- Configure Noto Sans Myanmar
const notoSansMyanmar = Noto_Sans_Myanmar({
  weight: ['400', '700'],
  subsets: [],
  variable: "--font-noto-sans-myanmar",
  display: 'swap',
});

export const metadata = {
  title: "NotizVoice", // Changed default title to your app name
  description: "Your voice, transcribed and summarized.", // More relevant description
};

export default function RootLayout({ children }) {
  return (
    // Moved the comment to avoid hydration error
    <> {/* Fragment to wrap the comment and html tag */}
      {/* Keep lang="en" for overall page, transcription will be dynamic */}
      <html lang="en">
        <body
          className={`
            ${geistSans.variable}
            ${geistMono.variable}
            ${notoSansMyanmar.variable}
            antialiased
          `}
        >
          {children}
        </body>
      </html>
    </>
  );
}