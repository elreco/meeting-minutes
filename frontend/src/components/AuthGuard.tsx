'use client'

import { useAuth } from '@/contexts/AuthContext'
import { AuthModal } from './AuthModal'
import { useState } from 'react'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user } = useAuth() // Removed loading dependency completely
  const [showAuthModal, setShowAuthModal] = useState(false)

  // Debug logging
  console.log('🔍 AuthGuard state:', { user: !!user })

  // No more loading check - just show login if no user
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Meetily</h1>
            <p className="text-gray-600 mb-8">Transform your meetings into actionable insights</p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200"
            >
              Get Started
            </button>
          </div>
        </div>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    )
  }

  return <>{children}</>
}
