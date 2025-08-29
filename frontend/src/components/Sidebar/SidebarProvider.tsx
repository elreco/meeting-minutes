'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Analytics from '@/lib/analytics';
import { invoke } from '@tauri-apps/api/core';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';


interface SidebarItem {
  id: string;
  title: string;
  type: 'folder' | 'file';
  children?: SidebarItem[];
}

export interface CurrentMeeting {
  id: string;
  title: string;
}

// Search result type for transcript search
interface TranscriptSearchResult {
  id: string;
  title: string;
  matchContext: string;
  timestamp: string;
};

interface SidebarContextType {
  currentMeeting: CurrentMeeting | null;
  setCurrentMeeting: (meeting: CurrentMeeting | null) => void;
  sidebarItems: SidebarItem[];
  isCollapsed: boolean;
  toggleCollapse: () => void;
  meetings: CurrentMeeting[];
  setMeetings: (meetings: CurrentMeeting[]) => void;
  isMeetingActive: boolean;
  setIsMeetingActive: (active: boolean) => void;
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
  handleRecordingToggle: () => void;
  searchTranscripts: (query: string) => Promise<void>;
  searchResults: TranscriptSearchResult[];
  isSearching: boolean;
  setServerAddress: (address: string) => void;
  serverAddress: string;
  transcriptServerAddress: string;
  setTranscriptServerAddress: (address: string) => void;

}

const SidebarContext = createContext<SidebarContextType | null>(null);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [currentMeeting, setCurrentMeeting] = useState<CurrentMeeting | null>({ id: 'intro-call', title: '+ New Call' });
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [meetings, setMeetings] = useState<CurrentMeeting[]>([]);
  const [sidebarItems, setSidebarItems] = useState<SidebarItem[]>([]);
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [serverAddress, setServerAddress] = useState('');
  const [transcriptServerAddress, setTranscriptServerAddress] = useState('');

  const { session } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

    useEffect(() => {
    const fetchMeetingsFromSupabase = async () => {
        if (session?.user?.id) {
          try {
            console.log('🔄 Fetching meetings from Supabase...');

            // Query meetings using existing structure (meetings + transcripts)
            const { data: meetings, error } = await supabase
              .from('meetings')
              .select(`
                id,
                title,
                description,
                created_at,
                organization_id,
                transcripts(transcript, created_at)
              `)
              .eq('user_id', session.user.id)
              .order('created_at', { ascending: false })
              .limit(50);

            if (error) {
              console.error('Supabase error fetching meetings:', error);
              setMeetings([]);
              return;
            }

            console.log('✅ Successfully fetched meetings from Supabase:', meetings?.length || 0);

            const transformedMeetings = (meetings || []).map((meeting: any) => ({
                id: meeting.id,
                title: meeting.title || 'Untitled Meeting'
            }));

            setMeetings(transformedMeetings);
            Analytics.trackBackendConnection(true);
          } catch (error) {
            console.error('Error fetching meetings from Supabase:', error);
            setMeetings([]);
            Analytics.trackBackendConnection(false, error instanceof Error ? error.message : 'Unknown error');
          }
        } else {
          console.log('⏳ Waiting for user session to fetch meetings...');
          setMeetings([]);
        }
    }

    fetchMeetingsFromSupabase();
}, [session?.user?.id]);

  useEffect(() => {
    const fetchSettings = async () => {

        setServerAddress('http://localhost:5167');
        setTranscriptServerAddress('http://127.0.0.1:8178/stream');


    };
    fetchSettings();
  }, []);

  const baseItems: SidebarItem[] = [
    {
      id: 'meetings',
      title: 'Meeting Notes',
      type: 'folder' as const,
      children: [
        ...meetings.map(meeting => ({ id: meeting.id, title: meeting.title, type: 'file' as const }))
      ]
    },
  ];



  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Update current meeting when on home page
  useEffect(() => {
    if (pathname === '/') {
      setCurrentMeeting({ id: 'intro-call', title: '+ New Call' });
    }
    setSidebarItems(baseItems);
  }, [pathname]);

  // Update sidebar items when meetings change
  useEffect(() => {
    setSidebarItems(baseItems);
  }, [meetings]);

  // Function to handle recording toggle from sidebar
  const handleRecordingToggle = () => {
    if (!isRecording) {
      // If not recording, navigate to home page and set flag to start recording automatically
      sessionStorage.setItem('autoStartRecording', 'true');
      sessionStorage.setItem('autoStartRecordingSource', 'sidebar');
      router.push('/');

      // Track recording initiation from sidebar
      Analytics.trackButtonClick('start_recording', 'sidebar');
    }
    // The actual recording start/stop is handled in the Home component
  };

      // Function to search through meeting transcripts
  const searchTranscripts = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);

      if (!session?.user?.id) {
        console.error('No user session available for search');
        setSearchResults([]);
        return;
      }

      console.log('🔍 Searching transcripts in Supabase...');

      // Search in meetings and transcripts using existing structure
      const { data: results, error } = await supabase
        .from('meetings')
        .select(`
          id,
          title,
          description,
          created_at,
          transcripts(transcript)
        `)
        .eq('user_id', session.user.id)
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(10);

      if (error) {
        console.error('Supabase search error:', error);
        setSearchResults([]);
        return;
      }

      // Also search in transcripts content
      const { data: transcriptResults } = await supabase
        .from('transcripts')
        .select(`
          meeting_id,
          transcript,
          meetings(id, title, created_at)
        `)
        .textSearch('transcript', query)
        .limit(10);

      // Combine both results
      const allResults = [
        ...(results || []),
        ...((transcriptResults || []).map((tr: any) => ({
          ...tr.meetings,
          transcripts: [{ transcript: tr.transcript }]
        })))
      ];

      // Remove duplicates and transform
      const uniqueResults = Array.from(
        new Map(allResults.map(item => [item.id, item])).values()
      );

      const transformedResults = uniqueResults.map((meeting: any) => ({
        id: meeting.id,
        title: meeting.title || 'Untitled Meeting',
        matchContext: meeting.transcripts?.[0]?.transcript ?
          meeting.transcripts[0].transcript.substring(0, 150) + '...' :
          meeting.description || 'No transcript available',
        timestamp: meeting.created_at || new Date().toISOString()
      }));

      console.log('✅ Search completed:', transformedResults.length, 'results');
      setSearchResults(transformedResults);

      // Track search performed
      Analytics.trackSearchPerformed(query, transformedResults.length);
    } catch (error) {
      console.error('Error searching transcripts:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };



  return (
    <SidebarContext.Provider value={{
      currentMeeting,
      setCurrentMeeting,
      sidebarItems,
      isCollapsed,
      toggleCollapse,
      meetings,
      setMeetings,
      isMeetingActive,
      setIsMeetingActive,
      isRecording,
      setIsRecording,
      handleRecordingToggle,
      searchTranscripts,
      searchResults,
      isSearching,
      setServerAddress,
      serverAddress,
      transcriptServerAddress,
      setTranscriptServerAddress,

    }}>
      {children}
    </SidebarContext.Provider>
  );
}
