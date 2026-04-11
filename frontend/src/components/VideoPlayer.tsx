import { useState, useRef } from "react";
import { Play, ExternalLink } from "lucide-react";

interface VideoPlayerProps {
  url: string;
  type: "YOUTUBE" | "VIMEO" | "UPLOAD";
  thumbnail?: string;
  title?: string;
}

function getYoutubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function getVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match ? match[1] : null;
}

export default function VideoPlayer({ url, type, thumbnail, title }: VideoPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ── YouTube ───────────────────────────────────────────────────
  if (type === "YOUTUBE") {
    const ytId = getYoutubeId(url);
    if (!ytId) return null;
    const thumb = thumbnail || `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
    const embedUrl = `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`;

    return (
      <div className="relative w-full rounded-2xl overflow-hidden"
        style={{ aspectRatio: "16/9", border: "1px solid rgba(255,255,255,0.08)" }}>
        {playing ? (
          <iframe
            src={embedUrl}
            className="w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={title || "Event Video"}
          />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            className="group relative w-full h-full block focus:outline-none"
            aria-label="Play video"
          >
            {/* Thumbnail */}
            <img
              src={thumb}
              alt={title || "Event preview"}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors" />
            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-2xl"
                style={{
                  background: "rgba(255,0,0,0.85)",
                  backdropFilter: "blur(8px)",
                  border: "2px solid rgba(255,255,255,0.3)",
                }}
              >
                <Play className="w-7 h-7 text-white fill-white ml-1" />
              </div>
            </div>
            {/* YouTube watermark area */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5 text-xs text-white/60">
              <ExternalLink className="w-3 h-3" />
              YouTube
            </div>
          </button>
        )}
      </div>
    );
  }

  // ── Vimeo ─────────────────────────────────────────────────────
  if (type === "VIMEO") {
    const vimeoId = getVimeoId(url);
    if (!vimeoId) return null;
    const embedUrl = `https://player.vimeo.com/video/${vimeoId}?autoplay=1&title=0&byline=0`;
    const thumb = thumbnail || `https://vumbnail.com/${vimeoId}.jpg`;

    return (
      <div className="relative w-full rounded-2xl overflow-hidden"
        style={{ aspectRatio: "16/9", border: "1px solid rgba(255,255,255,0.08)" }}>
        {playing ? (
          <iframe
            src={embedUrl}
            className="w-full h-full"
            frameBorder="0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title={title || "Event Video"}
          />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            className="group relative w-full h-full block focus:outline-none"
            aria-label="Play video"
          >
            <img
              src={thumb}
              alt={title || "Event preview"}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-2xl"
                style={{
                  background: "rgba(26,183,234,0.85)",
                  backdropFilter: "blur(8px)",
                  border: "2px solid rgba(255,255,255,0.3)",
                }}
              >
                <Play className="w-7 h-7 text-white fill-white ml-1" />
              </div>
            </div>
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5 text-xs text-white/60">
              <ExternalLink className="w-3 h-3" />
              Vimeo
            </div>
          </button>
        )}
      </div>
    );
  }

  // ── Uploaded video (Cloudinary / CDN) ────────────────────────
  if (type === "UPLOAD") {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden"
        style={{ aspectRatio: "16/9", border: "1px solid rgba(255,255,255,0.08)" }}>
        <video
          ref={videoRef}
          src={url}
          poster={thumbnail}
          controls
          preload="metadata"
          className="w-full h-full object-cover"
          style={{ background: "#000" }}
        >
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  return null;
}
