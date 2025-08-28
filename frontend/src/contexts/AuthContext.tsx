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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Safety timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      console.warn('Auth loading timeout reached, forcing loading to false')
      setLoading(false)
    }, 10000) // 10 seconds timeout

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        loadUserData(session.user.id).finally(() => {
          clearTimeout(loadingTimeout)
        })
      } else {
        setLoading(false)
        clearTimeout(loadingTimeout)
      }
    }).catch((error) => {
      console.error('Error getting initial session:', error)
      setLoading(false)
      clearTimeout(loadingTimeout)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      if (session?.user) {
        try {
          await loadUserData(session.user.id)
          // Clear auto recording flag when user authenticates
          if (typeof window !== 'undefined' && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
            sessionStorage.removeItem('autoStartRecording')
          }
        } catch (error) {
          console.error('Error in auth state change:', error)
          setLoading(false)
        }
      } else {
        setUser(null)
        setOrganization(null)
        setLoading(false)
        // Clear auto recording flag when user signs out
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('autoStartRecording')
        }
      }
    })

    return () => {
      subscription.unsubscribe()
      clearTimeout(loadingTimeout)
    }
  }, [])

  const loadUserData = async (userId: string) => {
    try {
      console.log('Loading user data for:', userId)

      // Load user profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileError) {
        console.error('Error loading user profile:', profileError)
        // If profile doesn't exist, we still set loading to false
        setUser(null)
        setOrganization(null)
        setLoading(false)
        return
      }

      setUser(profile)

      // Load organization if user has one
      if (profile.organization_id) {
        try {
          const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', profile.organization_id)
            .single()

          if (orgError) {
            console.error('Error loading organization:', orgError)
            setOrganization(null)
          } else {
            setOrganization(org)
          }
        } catch (orgLoadError) {
          console.error('Exception loading organization:', orgLoadError)
          setOrganization(null)
        }
      } else {
        setOrganization(null)
      }
    } catch (error) {
      console.error('Error loading user data:', error)
      setUser(null)
      setOrganization(null)
    } finally {
      console.log('User data loading completed, setting loading to false')
      setLoading(false)
    }
  }

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
