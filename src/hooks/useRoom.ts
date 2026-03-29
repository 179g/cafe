// src/hooks/useRoom.ts
"use client";
import { useEffect, useRef, useState, useCallback } from "react";

export interface Participant {
  id: string;
  name: string;
  isHost: boolean;
  snack: string | null;
  joinedAt: number;
}

export interface RoomState {
  videoId: string | null;
  playlist: string[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  lastSyncAt: number;
  hostId: string | null;
  participants: Record<string, Participant>;
}

export interface LogEntry {
  id: string;
  text: string;
  emoji: string;
  time: number;
}

export interface ReactionEvent {
  userId: string;
  name: string;
  reaction: string;
  id: string;
}

interface UseRoomOptions {
  code: string;
  userId: string;
  userName: string;
  workerUrl: string;
}

export function useRoom({ code, userId, userName, workerUrl }: UseRoomOptions) {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [reactions, setReactions] = useState<ReactionEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addLog = useCallback((text: string, emoji: string) => {
    setLogs(prev => [
      { id: Math.random().toString(36), text, emoji, time: Date.now() },
      ...prev.slice(0, 49),
    ]);
  }, []);

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    const wsUrl = workerUrl
      .replace(/^http/, "ws")
      .replace(/\/$/, "") + `/api/room/${code}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "join", userId, name: userName }));
      pingRef.current = setInterval(() => {
        ws.send(JSON.stringify({ type: "ping" }));
      }, 20000);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        switch (msg.type) {
          case "room_state":
            setRoomState(msg.state);
            break;
          case "log":
            addLog(msg.text, msg.emoji);
            break;
          case "reaction":
            setReactions(prev => [
              { ...msg, id: Math.random().toString(36) },
              ...prev.slice(0, 19),
            ]);
            break;
          case "play":
          case "pause":
          case "seek":
            // Propagate to YouTube player via event
            window.dispatchEvent(new CustomEvent("cafe-sync", { detail: msg }));
            break;
        }
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      if (pingRef.current) clearInterval(pingRef.current);
    };

    ws.onerror = () => {
      setConnected(false);
    };

    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      ws.send(JSON.stringify({ type: "leave", userId }));
      ws.close();
    };
  }, [code, userId, userName, workerUrl, addLog]);

  const isHost = roomState?.hostId === userId;

  const actions = {
    play: (time: number) => send({ type: "play", time }),
    pause: (time: number) => send({ type: "pause", time }),
    seek: (time: number) => send({ type: "seek", time }),
    addVideo: (videoId: string) => send({ type: "add_video", videoId }),
    nextVideo: () => send({ type: "next_video" }),
    prevVideo: () => send({ type: "prev_video" }),
    setSnack: (snack: string) => send({ type: "snack", snack }),
    sendReaction: (reaction: string) => send({ type: "reaction", reaction }),
  };

  return { roomState, logs, reactions, connected, isHost, actions };
}
