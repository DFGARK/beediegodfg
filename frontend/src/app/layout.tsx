import type { Metadata } from 'next';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'Beehive International School — Asistencias RFID',
  description: 'Sistema de control de asistencias RFID para Beehive International School, Xela Guatemala',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-gray-950 antialiased">
        <ThemeProvider />
        {children}
      </body>
    </html>
  );
}
