'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, User, Organization } from '@/lib/supabase'
import { Session } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  organization: Organization | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, fullName: string, organizationName: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(false) // Start with false - no blocking loader!

        useEffect(() => {
    let isMounted = true

    console.log('🚀 AuthContext: Starting initialization (no blocking loader)')

    // Simple auth check - no complex timeouts
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!isMounted) return

        console.log('📱 Session check:', session ? '✅ Found' : '❌ None')
        setSession(session)

        if (session?.user) {
          console.log('👤 Setting user from session')
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            full_name: session.user.user_metadata?.full_name || undefined,
            organization_id: session.user.user_metadata?.organization_id || undefined,
            role: 'member'
          })
        } else {
          setUser(null)
        }
      } catch (error) {
        console.error('Auth error (continuing without auth):', error)
        setUser(null)
        setSession(null)
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return

      console.log('🔄 Auth state changed:', event)
      setSession(session)

      if (session?.user) {
        console.log('👤 User signed in via state change')
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          full_name: session.user.user_metadata?.full_name || undefined,
          organization_id: session.user.user_metadata?.organization_id || undefined,
          role: 'member'
        })
        // Clear session flags on sign in
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('autoStartRecording')
        }
      } else {
        console.log('❌ User signed out via state change')
        setUser(null)
        setOrganization(null)
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('autoStartRecording')
        }
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

      // Simplified - no longer needed since we use session data directly
  // const loadUserData = async (userId: string) => {
  //   // This function has been replaced with direct session data usage
  //   // to avoid DB loading delays and potential infinite loading issues
  // }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signUp = async (email: string, password: string, fullName: string, organizationName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          organization_name: organizationName,
        }
      }
    })
    return { error }
  }

  const signOut = async () => {
    try {
      console.log('Starting sign out process...')

      // Clear local state first
      setUser(null)
      setOrganization(null)
      setSession(null)

      // Clear session storage
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('autoStartRecording')
        sessionStorage.removeItem('autoStartRecordingSource')
      }

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Supabase sign out error:', error)
      } else {
        console.log('Successfully signed out from Supabase')
      }

      console.log('Sign out completed')
    } catch (error) {
      console.error('Error signing out:', error)
      // Even if there's an error, clear local state
      setUser(null)
      setOrganization(null)
      setSession(null)

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('autoStartRecording')
        sessionStorage.removeItem('autoStartRecordingSource')
      }
    }
  }

  const value = {
    user,
    organization,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
