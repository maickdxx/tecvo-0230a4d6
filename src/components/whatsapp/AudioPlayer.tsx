import React, { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, RotateCcw, RotateCw, Mic, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { useAudioGlobal } from "@/contexts/AudioContext";
import { Button } from "@/components/ui/button";

interface AudioPlayerProps {
  src: string;
  isMe: boolean;
  messageId: string;
}

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, isMe, messageId }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { activeId, play, stop } = useAudioGlobal();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(() => {
    return parseFloat(localStorage.getItem("whatsapp_audio_speed") || "1");
  });

  // Handle global single playback logic
  const isCurrentlyActive = activeId === messageId;

  useEffect(() => {
    if (!isCurrentlyActive && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
  }, [isCurrentlyActive, isPlaying]);

  // Load saved position
  useEffect(() => {
    const savedTime = localStorage.getItem(`audio_pos_${messageId}`);
    if (savedTime && audioRef.current) {
      const time = parseFloat(savedTime);
      if (!isNaN(time) && isFinite(time)) {
        audioRef.current.currentTime = time;
        setCurrentTime(time);
      }
    }
  }, [messageId]);

  // Handle audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      localStorage.setItem(`audio_pos_${messageId}`, audio.currentTime.toString());
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const onEnded = () => {
      setIsPlaying(false);
      stop(messageId);
      audio.currentTime = 0;
      setCurrentTime(0);
      localStorage.removeItem(`audio_pos_${messageId}`);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    // Set initial playback rate
    audio.playbackRate = playbackRate;

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, [messageId, playbackRate, stop]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      stop(messageId);
    } else {
      play(messageId);
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (values: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = values[0];
      setCurrentTime(values[0]);
    }
  };

  const changeSpeed = () => {
    const speeds = [1, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackRate);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackRate(nextSpeed);
    localStorage.setItem("whatsapp_audio_speed", nextSpeed.toString());
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const skip = (seconds: number) => {
    if (audioRef.current) {
      const newTime = Math.min(Math.max(0, audioRef.current.currentTime + seconds), duration);
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  return (
    <div className={cn(
      "flex flex-col gap-2 p-3 rounded-xl transition-all w-full max-w-[320px] relative group",
      isMe ? "bg-primary/20" : "bg-muted",
      isPlaying && (isMe ? "ring-2 ring-primary/40 bg-primary/25" : "ring-2 ring-primary/20 bg-muted/80")
    )}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className={cn(
            "h-12 w-12 rounded-full flex items-center justify-center shrink-0 transition-transform hover:scale-105 active:scale-95 shadow-sm",
            isMe ? "bg-primary text-primary-foreground" : "bg-background text-primary"
          )}
        >
          {isPlaying ? (
            <Pause className="h-6 w-6 fill-current" />
          ) : (
            <Play className="h-6 w-6 fill-current ml-1" />
          )}
        </button>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="flex-1"
            />
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-medium opacity-70 tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <div className="flex items-center gap-2">
               <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 rounded-full" 
                onClick={() => skip(-5)}
                title="-5s"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 rounded-full" 
                onClick={() => skip(5)}
                title="+5s"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={changeSpeed}
                className={cn(
                  "h-6 px-1.5 py-0 text-[10px] font-bold rounded-full transition-colors",
                  playbackRate > 1 && "bg-primary text-primary-foreground border-primary"
                )}
              >
                {playbackRate}x
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 opacity-40">
           <Mic className="h-3 w-3" />
           <div className="flex items-end gap-[1px] h-4">
             {[1, 2, 3, 4, 5].map(i => (
               <div 
                 key={i} 
                 className={cn(
                   "w-0.5 bg-current rounded-full transition-all duration-300",
                   isPlaying ? "animate-bounce" : "h-1"
                 )}
                 style={{ 
                   height: isPlaying ? "100%" : "4px",
                   animationDuration: "0.8s",
                   animationDelay: `${i * 0.15}s`
                 }}
               />
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};
