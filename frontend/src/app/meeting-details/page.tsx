"use client"
import { useSidebar } from "@/components/Sidebar/SidebarProvider";
import { useState, useEffect } from "react";
import { Transcript, Summary } from "@/types";
import PageContent from "./page-content";
import { useRouter } from "next/navigation";
import Analytics from "@/lib/analytics";
import { invoke } from "@tauri-apps/api/core";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface MeetingDetailsResponse {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  transcripts: Transcript[];
}

const sampleSummary: Summary = {
  key_points: { title: "Key Points", blocks: [] },
  action_items: { title: "Action Items", blocks: [] },
  decisions: { title: "Decisions", blocks: [] },
  main_topics: { title: "Main Topics", blocks: [] }
};

export default function MeetingDetails() {
  const { currentMeeting , serverAddress} = useSidebar();
  const { session } = useAuth();
  const router = useRouter();
  const [meetingDetails, setMeetingDetails] = useState<MeetingDetailsResponse | null>(null);
  const [meetingSummary, setMeetingSummary] = useState<Summary|null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset states when currentMeeting changes
  useEffect(() => {
    setMeetingDetails(null);
    setMeetingSummary(null);
    setError(null);
  }, [currentMeeting?.id]);

  useEffect(() => {
    if (!currentMeeting?.id || currentMeeting.id === 'intro-call') {
      setError("No meeting selected");
      Analytics.trackPageView('meeting_details');
      return;
    }

    setMeetingDetails(null);
    setMeetingSummary(null);
    setError(null);

    const fetchMeetingDetails = async () => {
      try {
        console.log('🔄 Fetching meeting details from Supabase...');

        if (!session?.user?.id) {
          setError("User not authenticated");
          return;
        }

        // Query meeting using existing structure (meetings + transcripts)
        const { data: meetingData, error: meetingError } = await supabase
          .from('meetings')
          .select(`
            id,
            title,
            description,
            status,
            created_at,
            updated_at,
            transcripts(
              id,
              transcript,
              timestamp,
              summary,
              action_items,
              key_points,
              created_at
            )
          `)
          .eq('id', currentMeeting.id)
          .eq('user_id', session.user.id)
          .single();

        if (meetingError) {
          console.error('Supabase error fetching meeting:', meetingError);
          setError("Failed to load meeting details");
          return;
        }

        // Transform the data to match expected format
        const transformedData = {
          id: meetingData.id,
          title: meetingData.title || 'Untitled Meeting',
          created_at: meetingData.created_at,
          updated_at: meetingData.updated_at,
          transcripts: meetingData.transcripts?.length > 0 ?
            // Parse the first transcript (there should typically be one per meeting)
            meetingData.transcripts[0].transcript.split('\n')
              .filter((line: string) => line.trim())
              .map((line: string, index: number) => {
                const timeMatch = line.match(/^\[(.+?)\] (.*)$/);
                if (timeMatch) {
                  return {
                    id: `transcript-${index}`,
                    text: timeMatch[2],
                    timestamp: timeMatch[1],
                    speaker: 'Speaker'
                  };
                }
                return {
                  id: `transcript-${index}`,
                  text: line,
                  timestamp: new Date().toISOString(),
                  speaker: 'Speaker'
                };
              }) : []
        };

        console.log('✅ Successfully fetched meeting details from Supabase');
        setMeetingDetails(transformedData);
      } catch (error) {
        console.error('Error fetching meeting details:', error);
        setError("Failed to load meeting details");
      }
    };

    const fetchMeetingSummary = async () => {
      try {
        console.log('🔄 Fetching meeting summary from Supabase...');

        if (!session?.user?.id) {
          return;
        }

        // Get summary data from transcripts table (where summary is stored)
        const { data: transcriptData, error } = await supabase
          .from('transcripts')
          .select('summary, action_items, key_points')
          .eq('meeting_id', currentMeeting.id)
          .single();

        if (error) {
          console.error('Error fetching summary:', error);
          setMeetingSummary(sampleSummary);
          return;
        }

        // Parse the summary data if it exists
        let summaryData = {};
        if (transcriptData?.summary) {
          try {
            summaryData = JSON.parse(transcriptData.summary);
          } catch (e) {
            // If not JSON, treat as plain text
            summaryData = {
              main_topics: { title: "Summary", blocks: [{ content: transcriptData.summary }] }
            };
          }
        }

        // Also add action_items and key_points if they exist
        if (transcriptData?.action_items) {
          try {
            const actionItems = JSON.parse(transcriptData.action_items);
            summaryData = { ...summaryData, action_items: actionItems };
          } catch (e) {
            summaryData = {
              ...summaryData,
              action_items: { title: "Action Items", blocks: [{ content: transcriptData.action_items }] }
            };
          }
        }

        if (transcriptData?.key_points) {
          try {
            const keyPoints = JSON.parse(transcriptData.key_points);
            summaryData = { ...summaryData, key_points: keyPoints };
          } catch (e) {
            summaryData = {
              ...summaryData,
              key_points: { title: "Key Points", blocks: [{ content: transcriptData.key_points }] }
            };
          }
        }

        const { MeetingName, _section_order, ...restSummaryData } = summaryData as any;

        // Format the summary data with consistent styling - PRESERVE ORDER
        const formattedSummary: Summary = {};

        // Use section order if available to maintain exact order and handle duplicates
        const sectionKeys = _section_order || Object.keys(restSummaryData);

        for (const key of sectionKeys) {
          try {
            const section = restSummaryData[key];
            // Comprehensive null checks to prevent the error
            if (section &&
                typeof section === 'object' &&
                'title' in section &&
                'blocks' in section) {

              const typedSection = section as { title?: string; blocks?: any[] };

              // Ensure blocks is an array before mapping
              if (Array.isArray(typedSection.blocks)) {
                formattedSummary[key] = {
                  title: typedSection.title || key,
                  blocks: typedSection.blocks.map((block: any) => ({
                    ...block,
                    // type: 'bullet',
                    color: 'default',
                    content: block?.content?.trim() || ''
                  }))
                };
              } else {
                // Handle case where blocks is not an array
                console.warn(`Section ${key} has invalid blocks:`, typedSection.blocks);
                formattedSummary[key] = {
                  title: typedSection.title || key,
                  blocks: []
                };
              }
            } else {
              console.warn(`Skipping invalid section ${key}:`, section);
            }
          } catch (error) {
            console.warn(`Error processing section ${key}:`, error);
            // Continue processing other sections
          }
        }
        setMeetingSummary(formattedSummary);
      } catch (error) {
        console.error('Error fetching meeting summary:', error);
        // Don't set error state for summary fetch failure, just use sample summary
        setMeetingSummary(sampleSummary);
      }
    };

    fetchMeetingDetails();
    fetchMeetingSummary();
  }, [currentMeeting?.id, serverAddress]);

  // if (error) {
  //   return (
  //     <div className="flex items-center justify-center h-screen">
  //       <div className="text-center">
  //         <p className="text-red-500 mb-4">{error}</p>
  //         <button
  //           onClick={() => router.push('/')}
  //           className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
  //         >
  //           Go Back
  //         </button>
  //       </div>
  //     </div>
  //   );
  // }

  if (!meetingDetails || !meetingSummary) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return <PageContent meeting={meetingDetails} summaryData={meetingSummary} />;
}