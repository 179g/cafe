// src/hooks/useYouTube.ts
"use client";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface UseYouTubeOptions {
  containerId: string;
  videoId: string | null;
  isHost: boolean;
  startTime?: number;
  onPlay?: (time: number) => void;
  onPause?: (time: number) => void;
  onSeek?: (time: number) => void;
}

export function useYouTube({
  containerId,
  videoId,
  isHost,
  startTime = 0,
  onPlay,
  onPause,
  onSeek,
}: UseYouTubeOptions) {
  const playerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const lastSeekRef = useRef(0);

  // Load YT API
  useEffect(() => {
    if (window.YT) {
      initPlayer();
      return;
    }
    window.onYouTubeIframeAPIReady = initPlayer;
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  }, []);

  const initPlayer = () => {
    if (!videoId) return;
    if (playerRef.current) {
      playerRef.current.destroy();
    }
    playerRef.current = new window.YT.Player(containerId, {
      videoId,
      playerVars: {
        autoplay: 1,
        start: Math.floor(startTime),
        controls: isHost ? 1 : 0,
        disablekb: isHost ? 0 : 1,
        modestbranding: 1,
        rel: 0,
        fs: 1,
        cc_load_policy: 0,
      },
      events: {
        onReady: (e: any) => {
          setReady(true);
          if (!isHost) e.target.seekTo(startTime, true);
        },
        onStateChange: (e: any) => {
          if (!isHost) return;
          const t = e.target.getCurrentTime();
          if (e.data === window.YT.PlayerState.PLAYING) {
            onPlay?.(t);
          } else if (e.data === window.YT.PlayerState.PAUSED) {
            // Distinguish seek from pause
            const diff = Math.abs(t - lastSeekRef.current);
            if (diff > 1) {
              lastSeekRef.current = t;
              onSeek?.(t);
            } else {
              onPause?.(t);
            }
          }
        },
      },
    });
  };

  // When videoId changes
  useEffect(() => {
    if (!ready || !videoId || !playerRef.current) return;
    playerRef.current.loadVideoById({ videoId, startSeconds: 0 });
  }, [videoId, ready]);

  // Listen for sync events from other users
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (!playerRef.current || isHost) return;
      const { type, time } = e.detail;
      if (type === "play") {
        playerRef.current.seekTo(time, true);
        playerRef.current.playVideo();
      } else if (type === "pause") {
        playerRef.current.seekTo(time, true);
        playerRef.current.pauseVideo();
      } else if (type === "seek") {
        playerRef.current.seekTo(time, true);
      }
    };
    window.addEventListener("cafe-sync", handler as EventListener);
    return () => window.removeEventListener("cafe-sync", handler as EventListener);
  }, [isHost]);

  return { playerRef, ready };
}

// Extract videoId from URL or query
export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  // Full URL
  const urlMatch = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  if (urlMatch) return urlMatch[1];
  // Raw 11-char ID
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  return null;
}
