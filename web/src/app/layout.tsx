import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Nav } from '@/components/nav';
import { ChatWidget } from '@/components/chat-widget';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SiteOps Safety MVP',
  description: 'ML-powered construction site safety monitoring',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex">
          <Nav />
          <main className="flex-1 p-8">{children}</main>
        </div>
        <ChatWidget />
      </body>
    </html>
  );
}