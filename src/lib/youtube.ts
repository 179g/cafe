// src/lib/youtube.ts

export interface VideoInfo {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle?: string;
}

// Use YouTube oEmbed (no API key needed)
export async function getVideoInfo(videoId: string): Promise<VideoInfo | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (!res.ok) return null;
    const data = await res.json() as { title: string; author_name: string };
    return {
      id: videoId,
      title: data.title,
      thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      channelTitle: data.author_name,
    };
  } catch {
    return null;
  }
}

// Search via YouTube Data API v3 (optional — needs API key in env)
export async function searchYouTube(
  query: string,
  apiKey?: string
): Promise<VideoInfo[]> {
  if (!apiKey) return [];
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=8&key=${apiKey}`
    );
    if (!res.ok) return [];
    const data = await res.json() as {
      items?: Array<{
        id: { videoId: string };
        snippet: {
          title: string;
          thumbnails: { medium: { url: string } };
          channelTitle: string;
        };
      }>;
    };
    return (data.items || []).map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.channelTitle,
    }));
  } catch {
    return [];
  }
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
