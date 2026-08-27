import './globals.css';

export const metadata = {
  title: 'Zuna — your books, with a voice',
  description: 'A private listening room for the books you already own.',
};

export const viewport = { themeColor: '#f5efe6' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
