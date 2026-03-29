"use client";
// src/components/CafeSyncApp.tsx

import { useState, useEffect, useRef, useCallback } from "react";
import { useRoom, type RoomState } from "@/hooks/useRoom";
import { useYouTube, extractVideoId } from "@/hooks/useYouTube";
import { getVideoInfo, type VideoInfo } from "@/lib/youtube";
import { SNACKS, REACTIONS, type SnackItem } from "@/lib/items";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || "https://cafe-sync-worker.YOUR_SUBDOMAIN.workers.dev";

// ─── Animated Steam ────────────────────────────────────────────────────────────
function SteamAnimation() {
  return (
    <div className="steam-container" aria-hidden>
      {[0, 1, 2].map(i => (
        <div key={i} className={`steam steam-${i}`} />
      ))}
    </div>
  );
}

// ─── Seat ─────────────────────────────────────────────────────────────────────
function Seat({ participant, isMe }: {
  participant: { id: string; name: string; isHost: boolean; snack: string | null };
  isMe: boolean;
}) {
  const snack = SNACKS.find(s => s.id === participant.snack);
  return (
    <div className={`seat ${isMe ? "seat--me" : ""}`}>
      {participant.isHost && <div className="seat__crown">👑</div>}
      <div className="seat__avatar">
        {participant.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="seat__name">{participant.name}</div>
      {snack && (
        <div className="seat__snack">
          <span>{snack.emoji}</span>
          {snack.hot && <SteamAnimation />}
        </div>
      )}
    </div>
  );
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
function ConfettiEffect({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  const pieces = Array.from({ length: 60 }, (_, i) => i);
  return (
    <div className="confetti-container" aria-hidden>
      {pieces.map(i => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 0.5}s`,
            backgroundColor: `hsl(${Math.random() * 360}, 90%, 60%)`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Projectile ───────────────────────────────────────────────────────────────
function ProjectileEffect({ emoji, onDone }: { emoji: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="projectile" aria-hidden>
      <span>{emoji}</span>
    </div>
  );
}

// ─── Balloon ──────────────────────────────────────────────────────────────────
function BalloonEffect({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="balloon-effect" aria-hidden>
      {[0, 1, 2].map(i => (
        <span key={i} className={`balloon balloon-${i}`}>🎈</span>
      ))}
    </div>
  );
}

// ─── Patrol Car ───────────────────────────────────────────────────────────────
function PatrolEffect({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="patrol-effect" aria-hidden>
      <span className="patrol-car">🚔</span>
    </div>
  );
}

// ─── Reaction Renderer ────────────────────────────────────────────────────────
function ReactionRenderer({ reactions, onRemove }: {
  reactions: Array<{ id: string; reaction: string }>;
  onRemove: (id: string) => void;
}) {
  return (
    <>
      {reactions.map(r => {
        switch (r.reaction) {
          case "cracker":
            return <ConfettiEffect key={r.id} onDone={() => onRemove(r.id)} />;
          case "stone":
            return <ProjectileEffect key={r.id} emoji="🪨" onDone={() => onRemove(r.id)} />;
          case "balloon":
            return <BalloonEffect key={r.id} onDone={() => onRemove(r.id)} />;
          case "police":
            return <PatrolEffect key={r.id} onDone={() => onRemove(r.id)} />;
          default:
            return null;
        }
      })}
    </>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({
  open, code, logs, roomState, userId, onSnack, onReaction, onClose
}: {
  open: boolean;
  code: string;
  logs: Array<{ id: string; text: string; emoji: string }>;
  roomState: RoomState | null;
  userId: string;
  onSnack: (id: string) => void;
  onReaction: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"log" | "snack" | "react">("snack");
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const mySnack = roomState?.participants[userId]?.snack;

  const snackGroups = [
    { label: "☕ ドリンク", items: SNACKS.filter(s => s.category === "drink") },
    { label: "🍱 フード", items: SNACKS.filter(s => s.category === "food") },
    { label: "🍭 スイーツ", items: SNACKS.filter(s => s.category === "sweet") },
  ];

  return (
    <aside className={`sidebar ${open ? "sidebar--open" : ""}`}>
      <div className="sidebar__header">
        <div className="sidebar__room-code">
          <span className="sidebar__code-label">ルームコード</span>
          <button className="sidebar__code-btn" onClick={copyCode}>
            <span className="sidebar__code-value">{code}</span>
            <span className="sidebar__copy-hint">{copied ? "✓ コピー済み" : "タップでコピー"}</span>
          </button>
        </div>
        <button className="sidebar__close" onClick={onClose} aria-label="サイドバーを閉じる">✕</button>
      </div>

      <div className="sidebar__tabs">
        {([["snack", "🍭 メニュー"], ["react", "✨ アイテム"], ["log", "📋 ログ"]] as const).map(
          ([id, label]) => (
            <button
              key={id}
              className={`sidebar__tab ${tab === id ? "sidebar__tab--active" : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          )
        )}
      </div>

      <div className="sidebar__content">
        {tab === "snack" && (
          <div className="snack-menu">
            {snackGroups.map(group => (
              <div key={group.label} className="snack-group">
                <div className="snack-group__label">{group.label}</div>
                <div className="snack-grid">
                  {group.items.map(item => (
                    <button
                      key={item.id}
                      className={`snack-item ${mySnack === item.id ? "snack-item--active" : ""}`}
                      onClick={() => onSnack(item.id)}
                    >
                      <span className="snack-item__emoji">{item.emoji}</span>
                      <span className="snack-item__name">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "react" && (
          <div className="reaction-panel">
            <p className="reaction-panel__hint">アイテムを使って盛り上げよう！</p>
            <div className="reaction-grid">
              {REACTIONS.map(r => (
                <button
                  key={r.id}
                  className="reaction-btn"
                  onClick={() => onReaction(r.id)}
                >
                  <span className="reaction-btn__emoji">{r.emoji}</span>
                  <span className="reaction-btn__name">{r.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === "log" && (
          <div className="log-list">
            {logs.length === 0 && (
              <div className="log-empty">まだログはありません</div>
            )}
            {logs.map(log => (
              <div key={log.id} className="log-entry">
                <span className="log-entry__emoji">{log.emoji}</span>
                <span className="log-entry__text">{log.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Video Search Bar ──────────────────────────────────────────────────────────
function VideoSearchBar({ onAdd, playlist, currentIndex }: {
  onAdd: (videoId: string) => void;
  playlist: string[];
  currentIndex: number;
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async () => {
    if (!input.trim()) return;
    setError("");
    setLoading(true);
    try {
      const id = extractVideoId(input.trim());
      if (!id) {
        setError("有効なYouTube URLまたは動画IDを入力してください");
        return;
      }
      onAdd(id);
      setInput("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-bar">
      <div className="search-bar__input-wrap">
        <span className="search-bar__icon">🎬</span>
        <input
          type="text"
          className="search-bar__input"
          placeholder="YouTubeのURLを入力..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
        />
        <button
          className="search-bar__btn"
          onClick={handleAdd}
          disabled={loading || !input.trim()}
        >
          {loading ? "..." : "追加"}
        </button>
      </div>
      {error && <div className="search-bar__error">{error}</div>}
      {playlist.length > 0 && (
        <div className="playlist-bar">
          {playlist.map((id, i) => (
            <div
              key={id}
              className={`playlist-item ${i === currentIndex ? "playlist-item--active" : ""}`}
              title={id}
            >
              <img
                src={`https://img.youtube.com/vi/${id}/default.jpg`}
                alt=""
                className="playlist-item__thumb"
              />
              {i === currentIndex && <div className="playlist-item__playing">▶</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Counter (Seats) ──────────────────────────────────────────────────────────
function Counter({ roomState, userId }: { roomState: RoomState; userId: string }) {
  const participants = Object.values(roomState.participants);
  return (
    <div className="counter">
      <div className="counter__wood-top" />
      <div className="counter__seats-wrap">
        <div className="counter__seats">
          {participants.length === 0 && (
            <div className="counter__empty">まだ誰もいません…</div>
          )}
          {participants.map(p => (
            <Seat key={p.id} participant={p} isMe={p.id === userId} />
          ))}
        </div>
      </div>
      <div className="counter__wood-bottom" />
    </div>
  );
}

// ─── Entry Screen ─────────────────────────────────────────────────────────────
function EntryScreen({ onEnter }: {
  onEnter: (code: string, name: string) => void;
}) {
  const [mode, setMode] = useState<"home" | "create" | "join">("home");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const generateCode = () =>
    Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 33)]).join("");

  const handleCreate = () => {
    if (!name.trim()) { setError("名前を入力してください"); return; }
    onEnter(generateCode(), name.trim());
  };

  const handleJoin = () => {
    if (!name.trim()) { setError("名前を入力してください"); return; }
    if (code.length !== 4) { setError("4桁のコードを入力してください"); return; }
    onEnter(code.toUpperCase(), name.trim());
  };

  return (
    <div className="entry">
      <div className="entry__bg" aria-hidden />
      <div className="entry__card">
        <div className="entry__logo">
          <span className="entry__logo-icon">☕</span>
          <h1 className="entry__title">Cafe Sync</h1>
          <p className="entry__subtitle">みんなで観て、作業して、くつろごう</p>
        </div>

        {mode === "home" && (
          <div className="entry__actions">
            <button className="entry__btn entry__btn--primary" onClick={() => setMode("create")}>
              ☕ 新しいルームを作る
            </button>
            <button className="entry__btn entry__btn--secondary" onClick={() => setMode("join")}>
              🚪 ルームに入る
            </button>
          </div>
        )}

        {(mode === "create" || mode === "join") && (
          <div className="entry__form">
            <input
              className="entry__input"
              placeholder="あなたの名前"
              value={name}
              maxLength={20}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
            {mode === "join" && (
              <input
                className="entry__input entry__input--code"
                placeholder="4桁のコード (例: CAFE)"
                value={code}
                maxLength={4}
                onChange={e => setCode(e.target.value.toUpperCase())}
              />
            )}
            {error && <div className="entry__error">{error}</div>}
            <div className="entry__form-actions">
              <button className="entry__btn entry__btn--ghost" onClick={() => { setMode("home"); setError(""); }}>
                ← 戻る
              </button>
              <button
                className="entry__btn entry__btn--primary"
                onClick={mode === "create" ? handleCreate : handleJoin}
              >
                {mode === "create" ? "ルームを作成" : "入室する"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="entry__deco" aria-hidden>
        {["☕", "🍵", "🍪", "🎬", "🎵", "✨", "🍰", "🎧"].map((e, i) => (
          <span key={i} className={`entry__deco-item entry__deco-item--${i}`}>{e}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function CafeSyncApp() {
  const [session, setSession] = useState<{ code: string; name: string; userId: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeReactions, setActiveReactions] = useState<Array<{ id: string; reaction: string }>>([]);

  // Stable userId
  const userId = useRef(
    typeof window !== "undefined"
      ? localStorage.getItem("cafe-userId") || `u_${Math.random().toString(36).slice(2)}`
      : `u_${Math.random().toString(36).slice(2)}`
  );

  useEffect(() => {
    localStorage.setItem("cafe-userId", userId.current);
  }, []);

  const handleEnter = (code: string, name: string) => {
    setSession({ code, name, userId: userId.current });
  };

  if (!session) {
    return <EntryScreen onEnter={handleEnter} />;
  }

  return <RoomView session={session} onLeave={() => setSession(null)} />;
}

// ─── Room View ────────────────────────────────────────────────────────────────
function RoomView({
  session,
  onLeave,
}: {
  session: { code: string; name: string; userId: string };
  onLeave: () => void;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeReactions, setActiveReactions] = useState<Array<{ id: string; reaction: string }>>([]);

  const { roomState, logs, reactions, connected, isHost, actions } = useRoom({
    code: session.code,
    userId: session.userId,
    userName: session.name,
    workerUrl: WORKER_URL,
  });

  // Sync new reactions to active effects
  useEffect(() => {
    if (reactions.length === 0) return;
    const newest = reactions[0];
    setActiveReactions(prev => {
      if (prev.find(r => r.id === newest.id)) return prev;
      return [...prev, newest];
    });
  }, [reactions]);

  const removeReaction = useCallback((id: string) => {
    setActiveReactions(prev => prev.filter(r => r.id !== id));
  }, []);

  const { playerRef } = useYouTube({
    containerId: "yt-player",
    videoId: roomState?.videoId ?? null,
    isHost,
    startTime: roomState?.currentTime ?? 0,
    onPlay: (t) => actions.play(t),
    onPause: (t) => actions.pause(t),
    onSeek: (t) => actions.seek(t),
  });

  const handleAddVideo = (videoId: string) => {
    actions.addVideo(videoId);
  };

  return (
    <div className="app">
      {/* Reaction overlay */}
      <div className="reaction-overlay" aria-hidden>
        <ReactionRenderer reactions={activeReactions} onRemove={removeReaction} />
      </div>

      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        code={session.code}
        logs={logs}
        roomState={roomState}
        userId={session.userId}
        onSnack={actions.setSnack}
        onReaction={actions.sendReaction}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className={`main ${sidebarOpen ? "main--sidebar-open" : ""}`}>
        {/* Header */}
        <header className="header">
          <div className="header__left">
            {!sidebarOpen && (
              <button className="header__menu-btn" onClick={() => setSidebarOpen(true)} aria-label="メニューを開く">
                ☰
              </button>
            )}
            <div className="header__brand">
              <span className="header__brand-icon">☕</span>
              <span className="header__brand-name">Cafe Sync</span>
            </div>
          </div>

          <div className="header__center">
            <VideoSearchBar
              onAdd={handleAddVideo}
              playlist={roomState?.playlist ?? []}
              currentIndex={roomState?.currentIndex ?? 0}
            />
          </div>

          <div className="header__right">
            <div className={`header__conn ${connected ? "header__conn--ok" : "header__conn--ng"}`}>
              {connected ? "● オンライン" : "● 接続中…"}
            </div>
            {isHost && <div className="header__host-badge">👑 ホスト</div>}
            <button className="header__leave" onClick={onLeave}>退室</button>
          </div>
        </header>

        {/* Player */}
        <div className="player-wrap">
          {!roomState?.videoId ? (
            <div className="player-placeholder">
              <div className="player-placeholder__inner">
                <span className="player-placeholder__icon">🎬</span>
                <p className="player-placeholder__text">
                  URLを入力して動画を追加してください
                </p>
                {!isHost && (
                  <p className="player-placeholder__sub">
                    ホストが動画を追加するまでお待ちください
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="player-container">
              <div id="yt-player" />
              {!isHost && (
                <div className="player-overlay" title="ホストが操作中です" />
              )}
            </div>
          )}

          {/* Host controls */}
          {isHost && roomState && roomState.playlist.length > 1 && (
            <div className="player-controls">
              <button
                className="player-controls__btn"
                onClick={actions.prevVideo}
                disabled={roomState.currentIndex === 0}
              >
                ⏮ 前へ
              </button>
              <button
                className="player-controls__btn"
                onClick={actions.nextVideo}
                disabled={roomState.currentIndex >= roomState.playlist.length - 1}
              >
                次へ ⏭
              </button>
            </div>
          )}
        </div>

        {/* Counter seats */}
        {roomState && (
          <Counter roomState={roomState} userId={session.userId} />
        )}
      </div>
    </div>
  );
}
