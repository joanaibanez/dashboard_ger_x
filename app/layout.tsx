import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Geração X | Mobilidade & Financiamento',
  description: 'Painel analítico de mobilidade, veículos e soluções financeiras.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>
}
