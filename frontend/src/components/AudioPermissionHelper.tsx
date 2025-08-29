'use client'

import { useState, useEffect } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, Settings, ExternalLink } from 'lucide-react'

export function AudioPermissionHelper() {
  const [showPermissionHelper, setShowPermissionHelper] = useState(false)
  const [hasAudioPermission, setHasAudioPermission] = useState<boolean | null>(null)

  useEffect(() => {
    checkAudioPermission()
  }, [])

  const checkAudioPermission = async () => {
    try {
      // Try to get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setHasAudioPermission(true)
      stream.getTracks().forEach(track => track.stop()) // Stop the test stream
    } catch (error) {
      setHasAudioPermission(false)
      setShowPermissionHelper(true)
    }
  }

  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setHasAudioPermission(true)
      setShowPermissionHelper(false)
      stream.getTracks().forEach(track => track.stop())
    } catch (error) {
      console.error('Permission denied:', error)
      // If still denied, show system instructions
    }
  }

  const openSystemPreferences = () => {
    // On macOS, this will prompt user to open System Preferences
    if (navigator.userAgent.includes('Mac')) {
      alert('Please open System Preferences → Privacy & Security → Microphone and enable access for this app')
    }
  }

  if (hasAudioPermission === null) {
    return null // Still checking
  }

  if (hasAudioPermission) {
    return null // All good
  }

  if (!showPermissionHelper) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <Alert className="border-orange-200 bg-orange-50">
        <MicOff className="h-4 w-4 text-orange-600" />
        <AlertTitle className="text-orange-800">Microphone Permission Required</AlertTitle>
        <AlertDescription className="text-orange-700 space-y-3">
          <p>To record meetings, please enable microphone access:</p>
          
          <div className="space-y-2">
            <Button 
              size="sm" 
              onClick={requestPermission}
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
              <Mic className="h-4 w-4 mr-2" />
              Request Permission
            </Button>
            
            <Button 
              size="sm" 
              variant="outline" 
              onClick={openSystemPreferences}
              className="w-full"
            >
              <Settings className="h-4 w-4 mr-2" />
              Open System Preferences
            </Button>
          </div>

          <div className="text-xs space-y-1 pt-2 border-t border-orange-200">
            <p><strong>Manual steps:</strong></p>
            <p>1. Open System Preferences</p>
            <p>2. Go to Privacy & Security</p>
            <p>3. Click "Microphone"</p>
            <p>4. Enable access for Meetily</p>
            <p>5. Restart the app</p>
          </div>
          
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => setShowPermissionHelper(false)}
            className="w-full text-orange-600"
          >
            Dismiss
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  )
}
