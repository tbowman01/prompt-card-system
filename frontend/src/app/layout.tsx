import './globals.css'
import { Inter } from 'next/font/google'
import { Metadata } from 'next'
import React from 'react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import Header from '@/components/Header/Header'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Prompt Card System',
  description: 'Test-driven prompt development with local LLM integration',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider defaultTheme="system" storageKey="prompt-card-theme">
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
            <Header 
              user={{
                name: 'Demo User',
                email: 'demo@example.com'
              }}
              onLogin={() => console.log('Login clicked')}
              onLogout={() => console.log('Logout clicked')}
            />
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
              <div className="px-4 py-6 sm:px-0">
                {children}
              </div>
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}