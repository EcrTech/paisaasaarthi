import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNotification } from "@/hooks/useNotification";

interface CallRecordingPlayerProps {
  callLogId: string;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
}

export const CallRecordingPlayer = ({ callLogId, variant = "ghost", size = "sm" }: CallRecordingPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const notify = useNotification();

  const fetchRecording = async () => {
    try {
      setIsLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "https://newvgnbygvtnmyomxbmu.supabase.co"}/functions/v1/exotel-get-recording?callLogId=${callLogId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch recording');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      const audio = new Audio(url);
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
      });
      setAudioElement(audio);

      return audio;
    } catch (error: any) {
      console.error('Error fetching recording:', error);
      notify.error("Failed to load recording", error.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPause = async () => {
    if (isPlaying) {
      audioElement?.pause();
      setIsPlaying(false);
    } else {
      let audio = audioElement;
      if (!audio) {
        audio = await fetchRecording();
      }
      
      if (audio) {
        audio.play();
        setIsPlaying(true);
      }
    }
  };

  const handleDownload = async () => {
    try {
      if (audioUrl) {
        const a = document.createElement('a');
        a.href = audioUrl;
        a.download = `call-recording-${callLogId}.mp3`;
        a.click();
      } else {
        setIsLoading(true);
        const audio = await fetchRecording();
        if (audio && audioUrl) {
          const a = document.createElement('a');
          a.href = audioUrl;
          a.download = `call-recording-${callLogId}.mp3`;
          a.click();
        }
        setIsLoading(false);
      }
    } catch (error: any) {
      notify.error("Failed to download recording", error.message);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant={variant}
        size={size}
        onClick={handlePlayPause}
        disabled={isLoading}
        title={isPlaying ? "Pause recording" : "Play recording"}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>
      
      <Button
        variant={variant}
        size={size}
        onClick={handleDownload}
        disabled={isLoading}
        title="Download recording"
      >
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
};
