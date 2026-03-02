/**
 * SecureVideoPlayer - Udemy-style video player with full feature set
 * Excludes transcript per user request.
 *
 * Features: play/pause, rewind/forward 10s, playback speed, time display,
 * volume slider, fullscreen, PiP, settings menu (autoplay, shortcuts, content info),
 * prev/next navigation, keyboard shortcuts.
 */

import { useRef, useEffect, useCallback, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  RotateCcw,
  RotateCw,
  Settings,
  PictureInPicture,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface SecureVideoPlayerProps {
  src: string;
  poster?: string;
  title: string;
  isEmbed?: boolean;
  watermarkText?: string;
  onError?: (message: string) => void;
  className?: string;
  /** Previous lesson callback */
  onPrev?: () => void;
  /** Next lesson callback */
  onNext?: () => void;
  /** Autoplay next lesson */
  autoplay?: boolean;
  /** Autoplay change callback */
  onAutoplayChange?: (enabled: boolean) => void;
}

export function SecureVideoPlayer({
  src,
  poster,
  title,
  isEmbed = false,
  watermarkText,
  onError,
  className = "",
  onPrev,
  onNext,
  autoplay = false,
  onAutoplayChange
}: SecureVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [quality, setQuality] = useState<"auto" | "144" | "240" | "360" | "480" | "720" | "1080">("auto");
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const QUALITY_OPTIONS = [
    { value: "auto" as const, label: "Auto" },
    { value: "144" as const, label: "144p" },
    { value: "240" as const, label: "240p" },
    { value: "360" as const, label: "360p" },
    { value: "480" as const, label: "480p" },
    { value: "720" as const, label: "720p" },
    { value: "1080" as const, label: "1080p" }
  ];

  const qualityHeight = quality === "auto" || quality === "1080" ? undefined : parseInt(quality, 10);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const blocked = ["s", "S", "c", "C", "p", "P", "u", "U"];
      if (e.ctrlKey && blocked.includes(e.key)) {
        e.preventDefault();
        return;
      }
      if (e.key === "PrintScreen" || (e.ctrlKey && e.shiftKey && e.key === "I")) {
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const preventSelect = (e: Event) => e.preventDefault();
    el.addEventListener("selectstart", preventSelect);
    el.addEventListener("dragstart", preventSelect);
    el.style.userSelect = "none";
    el.style.webkitUserSelect = "none";
    return () => {
      el.removeEventListener("selectstart", preventSelect);
      el.removeEventListener("dragstart", preventSelect);
    };
  }, []);

  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (videoRef.current?.paused === false) setShowControls(false);
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
    resetControlsTimeout();
  };

  const skip = (seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + seconds));
    resetControlsTimeout();
  };

  const setSpeed = (rate: number) => {
    const v = videoRef.current;
    if (v) v.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  const setVolumeLevel = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
    setVolume(val);
    setIsMuted(val === 0);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const togglePiP = async () => {
    const v = videoRef.current;
    if (!v || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await v.requestPictureInPicture();
      }
    } catch {
      /* ignore */
    }
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (v) {
      setCurrentTime(v.currentTime);
      setProgress((v.currentTime / v.duration) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (v) setDuration(v.duration);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (autoplay && onNext) onNext();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const pct = Number(e.target.value);
    v.currentTime = (pct / 100) * v.duration;
    setProgress(pct);
    setCurrentTime(v.currentTime);
  };

  // Keyboard shortcuts for player
  useEffect(() => {
    const handlePlayerKey = (e: KeyboardEvent) => {
      const v = videoRef.current;
      const container = containerRef.current;
      if (!v || !container) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (!container.contains(target) && target !== document.body) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          if (v.paused) v.play();
          else v.pause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          v.currentTime = Math.max(0, v.currentTime - 10);
          break;
        case "ArrowRight":
          e.preventDefault();
          v.currentTime = Math.min(v.duration, v.currentTime + 10);
          break;
        case "m":
        case "M":
          e.preventDefault();
          v.muted = !v.muted;
          break;
        case "f":
        case "F":
          e.preventDefault();
          if (!document.fullscreenElement) container.requestFullscreen?.();
          else document.exitFullscreen?.();
          break;
        case "Escape":
          setShowShortcutsModal(false);
          setShowSettingsMenu(false);
          setShowSpeedMenu(false);
          setShowQualityMenu(false);
          break;
        default:
          break;
      }
    };
    document.addEventListener("keydown", handlePlayerKey);
    return () => document.removeEventListener("keydown", handlePlayerKey);
  }, []);

  if (isEmbed) {
    return (
      <div
        ref={containerRef}
        className={`relative overflow-hidden bg-black ${className}`}
        onContextMenu={handleContextMenu}
        style={{ userSelect: "none", WebkitUserSelect: "none" }}
      >
        <iframe
          src={src}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        {watermarkText && (
          <div className="pointer-events-none absolute bottom-4 left-4 text-xs font-medium text-white/40" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}>
            {watermarkText}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative aspect-video overflow-hidden bg-black group ${className}`}
      onContextMenu={handleContextMenu}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => {
        if (videoRef.current?.paused === false && controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
          controlsTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
            setShowSpeedMenu(false);
            setShowSettingsMenu(false);
            setShowQualityMenu(false);
          }, 500);
        }
      }}
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        title={title}
        playsInline
        preload="metadata"
        controlsList="nodownload nofullscreen noremoteplayback"
        className="h-full w-full object-contain"
        style={qualityHeight ? { maxHeight: `${qualityHeight}px` } : undefined}
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={() => onError?.("Video could not be loaded.")}
      />

      {/* Prev/Next arrows */}
      {onPrev && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className={`absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/70 ${showControls ? "opacity-100" : ""}`}
          aria-label="Previous lesson"
        >
          <ChevronLeft className="h-8 w-8" />
        </button>
      )}
      {onNext && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/70 ${showControls ? "opacity-100" : ""}`}
          aria-label="Next lesson"
        >
          <ChevronRight className="h-8 w-8" />
        </button>
      )}

      {/* Controls overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={togglePlay}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/50 p-4 text-white transition hover:bg-black/70"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="h-12 w-12" /> : <Play className="h-12 w-12 ml-1" />}
        </button>

        {/* Bottom controls bar - Udemy style */}
        <div className="absolute bottom-0 left-0 right-0 p-3 space-y-2">
          {/* Progress bar */}
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={handleSeek}
            className="w-full h-1.5 accent-amber-500 cursor-pointer"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button type="button" onClick={togglePlay} className="rounded p-1.5 text-white hover:bg-white/20" aria-label={isPlaying ? "Pause" : "Play"}>
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <button type="button" onClick={() => skip(-10)} className="rounded p-1.5 text-white hover:bg-white/20" aria-label="Rewind 10s">
                <RotateCcw className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => skip(10)} className="rounded p-1.5 text-white hover:bg-white/20" aria-label="Forward 10s">
                <RotateCw className="h-5 w-5" />
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowSettingsMenu(false); setShowQualityMenu(false); }}
                  className="rounded px-2 py-1 text-sm text-white hover:bg-white/20 min-w-[3rem]"
                >
                  {playbackRate}x
                </button>
                {showSpeedMenu && (
                  <div className="absolute bottom-full left-0 mb-1 rounded bg-black/90 py-1 min-w-[4rem]">
                    {SPEED_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSpeed(s)}
                        className={`block w-full px-3 py-1.5 text-left text-sm text-white hover:bg-white/20 ${playbackRate === s ? "bg-amber-500/30" : ""}`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-sm text-white/90 tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={toggleMute} className="rounded p-1.5 text-white hover:bg-white/20" aria-label={isMuted ? "Unmute" : "Mute"}>
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolumeLevel(Number(e.target.value))}
                className="w-20 h-1 accent-amber-500 cursor-pointer"
              />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setShowSettingsMenu(!showSettingsMenu); setShowSpeedMenu(false); setShowQualityMenu(false); }}
                  className="rounded p-1.5 text-white hover:bg-white/20"
                  aria-label="Settings"
                >
                  <Settings className="h-5 w-5" />
                </button>
                {showSettingsMenu && (
                  <div className="absolute bottom-full right-0 mb-1 rounded bg-black/95 py-2 min-w-[200px] shadow-xl">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                      <span className="text-sm font-medium text-white">Settings</span>
                      <button type="button" onClick={() => setShowSettingsMenu(false)} className="text-white/70 hover:text-white">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {onAutoplayChange && (
                      <div className="flex items-center justify-between px-3 py-2 hover:bg-white/5">
                        <span className="text-sm text-white">Autoplay</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={autoplay}
                          onClick={() => onAutoplayChange(!autoplay)}
                          className={`relative w-10 h-5 rounded-full transition ${autoplay ? "bg-amber-500" : "bg-gray-600"}`}
                        >
                          <span className={`absolute top-1 w-3 h-3 rounded-full bg-white transition ${autoplay ? "left-6" : "left-1"}`} />
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => { setShowShortcutsModal(true); setShowSettingsMenu(false); }}
                      className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5"
                    >
                      Keyboard shortcuts
                    </button>
                    <div className="border-t border-white/10">
                      <p className="px-3 py-2 text-xs text-white/50">Quality</p>
                      {QUALITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => { setQuality(opt.value); setShowSettingsMenu(false); }}
                          className={`w-full px-3 py-1.5 text-left text-sm text-white hover:bg-white/5 ${quality === opt.value ? "bg-amber-500/20 text-amber-400" : ""}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {document.pictureInPictureEnabled && (
                <button type="button" onClick={togglePiP} className="rounded p-1.5 text-white hover:bg-white/20" aria-label="Picture-in-picture">
                  <PictureInPicture className="h-5 w-5" />
                </button>
              )}
              <button type="button" onClick={toggleFullscreen} className="rounded p-1.5 text-white hover:bg-white/20" aria-label="Fullscreen">
                <Maximize className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {watermarkText && (
        <div className="pointer-events-none absolute bottom-4 left-4 text-xs font-medium text-white/30" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}>
          {watermarkText}
        </div>
      )}

      {/* Keyboard shortcuts modal */}
      {showShortcutsModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowShortcutsModal(false)}>
          <div className="rounded-lg bg-gray-900 p-6 max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Keyboard shortcuts</h3>
              <button type="button" onClick={() => setShowShortcutsModal(false)} className="text-white/70 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="space-y-2 text-sm text-white/90">
              <li className="flex justify-between"><span>Play / Pause</span><kbd className="px-1.5 py-0.5 rounded bg-gray-700 text-xs">Space</kbd></li>
              <li className="flex justify-between"><span>Rewind 10s</span><kbd className="px-1.5 py-0.5 rounded bg-gray-700 text-xs">←</kbd></li>
              <li className="flex justify-between"><span>Forward 10s</span><kbd className="px-1.5 py-0.5 rounded bg-gray-700 text-xs">→</kbd></li>
              <li className="flex justify-between"><span>Mute</span><kbd className="px-1.5 py-0.5 rounded bg-gray-700 text-xs">M</kbd></li>
              <li className="flex justify-between"><span>Fullscreen</span><kbd className="px-1.5 py-0.5 rounded bg-gray-700 text-xs">F</kbd></li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
