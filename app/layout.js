import './globals.css';
import { DM_Mono, DM_Sans, Playfair_Display } from 'next/font/google';

const sans = DM_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-sans' });
const mono = DM_Mono({ subsets: ['latin'], display: 'swap', variable: '--font-mono', weight: ['400', '500'] });
const serif = Playfair_Display({ subsets: ['latin'], display: 'swap', variable: '--font-serif' });

export const metadata = {
  title: 'Zuna — your books, with a voice',
  description: 'A private listening room for the books you already own.',
};

export const viewport = { themeColor: '#f5efe6' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
