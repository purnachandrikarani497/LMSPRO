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
  X,
  Columns2,
  Square
} from "lucide-react";

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const WATERMARK_POSITIONS = [
  "top-4 left-4",
  "top-4 right-4",
  "top-4 left-1/2 -translate-x-1/2",
  "top-1/2 left-4 -translate-y-1/2",
  "top-1/2 right-4 -translate-y-1/2",
  "bottom-12 left-4",
  "bottom-12 right-4",
  "bottom-12 left-1/2 -translate-x-1/2",
  "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
];

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
  /** Previous lesson title */
  prevTitle?: string;
  /** Next lesson callback */
  onNext?: () => void;
  /** Next lesson title */
  nextTitle?: string;
  /** Autoplay next lesson */
  autoplay?: boolean;
  /** Autoplay change callback */
  onAutoplayChange?: (enabled: boolean) => void;
  /** Expanded view (sidebar collapsed) */
  isExpanded?: boolean;
  /** Toggle expanded view */
  onExpandToggle?: () => void;
  /** Initial playback position in seconds (resume from where user left off) */
  initialTime?: number;
  /** Called periodically with current time and duration so parent can persist position */
  onTimeReport?: (currentTime: number, duration: number) => void;
  /** Ref to which the player assigns seekTo(seconds) for external control (e.g. notes timestamp click) */
  seekToRef?: React.MutableRefObject<((seconds: number) => void) | null>;
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
  prevTitle,
  onNext,
  nextTitle,
  autoplay = false,
  onAutoplayChange,
  isExpanded = false,
  onExpandToggle,
  initialTime,
  onTimeReport,
  seekToRef
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
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const [watermarkPosIndex, setWatermarkPosIndex] = useState(0);

  useEffect(() => {
    if (!watermarkText) return;
    const interval = 3000 + Math.random() * 2000;
    const id = setInterval(() => {
      setWatermarkPosIndex((i) => (i + 1) % WATERMARK_POSITIONS.length);
    }, interval);
    return () => clearInterval(id);
  }, [watermarkText]);

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

  useEffect(() => {
    if (!seekToRef) return;
    seekToRef.current = (seconds: number) => {
      const v = videoRef.current;
      if (v && isFinite(seconds) && seconds >= 0) {
        v.currentTime = Math.min(seconds, v.duration || seconds);
        setCurrentTime(v.currentTime);
        setProgress(v.duration ? (v.currentTime / v.duration) * 100 : 0);
        onTimeReport?.(v.currentTime, v.duration);
      }
    };
    return () => { seekToRef.current = null; };
  }, [seekToRef, onTimeReport]);

  const safePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const p = v.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        setIsPlaying(false);
        const onCanPlay = () => {
          v.removeEventListener("canplay", onCanPlay);
          v.play().catch(() => setIsPlaying(false));
        };
        v.addEventListener("canplay", onCanPlay, { once: true });
      });
    }
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      safePlay();
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

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen?.();
      if (!isExpanded && onExpandToggle) onExpandToggle();
    } else {
      document.exitFullscreen?.();
    }
  }, [isExpanded, onExpandToggle]);

  const [pipSupported, setPipSupported] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    let supported = false;
    if (typeof document !== "undefined" && (document as any).pictureInPictureEnabled) supported = true;
    // Safari/iOS WebKit presentation mode
    if (v && (v as any).webkitSupportsPresentationMode) supported = true;
    setPipSupported(supported);
  }, []);

  const togglePiP = async () => {
    const v = videoRef.current as any;
    if (!v) return;

    // Standard Picture-in-Picture API (Chromium, etc.)
    if (typeof document !== "undefined" && (document as any).pictureInPictureEnabled && v.requestPictureInPicture) {
      try {
        if ((document as any).pictureInPictureElement) {
          await (document as any).exitPictureInPicture();
        } else {
          await v.requestPictureInPicture();
        }
      } catch (err) {
        // ignore or optionally report
        // console.warn('PiP toggle failed', err);
      }
      return;
    }

    // WebKit presentation mode fallback (Safari)
    if (v.webkitSupportsPresentationMode && typeof v.webkitSetPresentationMode === "function") {
      try {
        const mode = v.webkitPresentationMode;
        if (mode !== "picture-in-picture") v.webkitSetPresentationMode("picture-in-picture");
        else v.webkitSetPresentationMode("inline");
      } catch (err) {
        // console.warn('WebKit PiP toggle failed', err);
      }
    }
  };

  const hasResumedRef = useRef(false);
  const lastReportRef = useRef(0);

  useEffect(() => {
    hasResumedRef.current = false;
    if (initialTime != null && initialTime > 0) {
      setCurrentTime(initialTime);
    } else {
      setProgress(0);
      setCurrentTime(0);
    }
    setDuration(0);
    setIsPlaying(false);
  }, [src]);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (v) {
      setCurrentTime(v.currentTime);
      setProgress((v.currentTime / v.duration) * 100);

      if (onTimeReport && isFinite(v.duration) && v.duration > 0) {
        const now = Date.now();
        if (now - lastReportRef.current >= 5000) {
          lastReportRef.current = now;
          onTimeReport(v.currentTime, v.duration);
        }
      }
    }
  };

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
    if (!hasResumedRef.current && initialTime != null && initialTime > 0) {
      const nearEnd = initialTime >= v.duration * 0.95;
      if (nearEnd) {
        setCurrentTime(0);
        setProgress(0);
      } else {
        v.currentTime = initialTime;
        setCurrentTime(initialTime);
        setProgress((initialTime / v.duration) * 100);
      }
      hasResumedRef.current = true;
    } else if (!hasResumedRef.current) {
      setProgress(0);
      setCurrentTime(0);
    }
  };

  const handlePause = () => {
    setIsPlaying(false);
    const v = videoRef.current;
    if (v && onTimeReport && isFinite(v.duration) && v.duration > 0) {
      onTimeReport(v.currentTime, v.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    const v = videoRef.current;
    if (v && onTimeReport && isFinite(v.duration) && v.duration > 0) {
      onTimeReport(v.currentTime, v.duration);
    }
    if (autoplay && onNext) onNext();
  };

  const onTimeReportRef = useRef(onTimeReport);
  onTimeReportRef.current = onTimeReport;

  useEffect(() => {
    return () => {
      const v = videoRef.current;
      const cb = onTimeReportRef.current;
      if (v && cb && isFinite(v.duration) && v.duration > 0) {
        cb(v.currentTime, v.duration);
      }
    };
  }, [src]);

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !isFinite(v.duration) || v.duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
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
          if (v.paused) safePlay();
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
          toggleFullscreen();
          break;
        case "Escape":
          setShowShortcutsModal(false);
          setShowSettingsMenu(false);
          setShowSpeedMenu(false);
          break;
        default:
          break;
      }
    };
    document.addEventListener("keydown", handlePlayerKey);
    return () => document.removeEventListener("keydown", handlePlayerKey);
  }, [toggleFullscreen]);

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
          <div
            className={`pointer-events-none absolute z-10 rounded px-2 py-1 text-xs font-medium text-white/90 bg-black/40 transition-all duration-500 ${WATERMARK_POSITIONS[watermarkPosIndex]}`}
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
          >
            {watermarkText}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative aspect-video overflow-hidden bg-black group [&:fullscreen]:!w-screen [&:fullscreen]:!h-screen [&:fullscreen]:!aspect-auto [&:fullscreen]:!max-w-none [&:fullscreen]:!max-h-none [&:-webkit-full-screen]:!w-screen [&:-webkit-full-screen]:!h-screen [&:-webkit-full-screen]:!aspect-auto [&:-webkit-full-screen]:!max-w-none [&:-webkit-full-screen]:!max-h-none ${className}`}
      onContextMenu={handleContextMenu}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => {
        if (videoRef.current?.paused === false && controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
          controlsTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
            setShowSpeedMenu(false);
            setShowSettingsMenu(false);
          }, 500);
        }
      }}
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        draggable={false}
        title={title}
        playsInline
        preload="auto"
        controlsList="nodownload noremoteplayback"
        disableRemotePlayback
        className="h-full w-full object-contain"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={handlePause}
        onError={() => onError?.("Video could not be loaded.")}
      />

      {/* Prev/Next arrows with lesson name tooltips */}
      {onPrev && (
        <div
          className={`absolute left-2 top-1/2 -translate-y-1/2 opacity-0 transition group-hover:opacity-100 ${showControls ? "opacity-100" : ""}`}
          style={{ zIndex: 10 }}
        >
          <div className="peer rounded-full bg-black/50 p-2 text-white cursor-pointer hover:bg-black/70"
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
          >
            <ChevronLeft className="h-8 w-8" />
          </div>
          {prevTitle && (
            <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 rounded bg-black/90 px-3 py-1.5 text-sm text-white max-w-[250px] truncate opacity-0 peer-hover:opacity-100 transition-opacity">
              {prevTitle}
            </div>
          )}
        </div>
      )}
      {onNext && (
        <div
          className={`absolute right-2 top-1/2 -translate-y-1/2 opacity-0 transition group-hover:opacity-100 ${showControls ? "opacity-100" : ""}`}
          style={{ zIndex: 10 }}
        >
          <div className="peer rounded-full bg-black/50 p-2 text-white cursor-pointer hover:bg-black/70"
            onClick={(e) => { e.stopPropagation(); onNext(); }}
          >
            <ChevronRight className="h-8 w-8" />
          </div>
          {nextTitle && (
            <div className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-2 rounded bg-black/90 px-3 py-1.5 text-sm text-white max-w-[250px] truncate opacity-0 peer-hover:opacity-100 transition-opacity">
              {nextTitle}
            </div>
          )}
        </div>
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
          <div
            className="group/seek relative w-full h-1.5 bg-white/30 rounded-full cursor-pointer hover:h-2.5 transition-all"
            onClick={handleSeekClick}
          >
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-amber-500 pointer-events-none"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-amber-500 shadow-md opacity-0 group-hover/seek:opacity-100 transition-opacity pointer-events-none"
              style={{ left: `calc(${progress}% - 7px)` }}
            />
          </div>
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
                  onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowSettingsMenu(false); }}
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
                  onClick={() => { setShowSettingsMenu(!showSettingsMenu); setShowSpeedMenu(false); }}
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
                  </div>
                )}
              </div>
              {pipSupported && (
                <button type="button" onClick={togglePiP} className="rounded p-1.5 text-white hover:bg-white/20" aria-label="Picture-in-picture">
                  <PictureInPicture className="h-5 w-5" />
                </button>
              )}
              {onExpandToggle && (
                <div className="relative group/expand">
                  <button
                    type="button"
                    onClick={() => {
                      if (document.fullscreenElement === containerRef.current) document.exitFullscreen?.();
                      onExpandToggle();
                    }}
                    className="rounded p-1.5 text-white hover:bg-white/20"
                    aria-label={isExpanded ? "Course content" : "Expanded view"}
                  >
                    {isExpanded ? <Columns2 className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                  </button>
                  <div className="pointer-events-none absolute bottom-full right-0 mb-2 hidden rounded bg-black/90 px-2 py-1 text-xs text-white whitespace-nowrap group-hover/expand:block">
                    {isExpanded ? "Course content" : "Expanded view"}
                  </div>
                </div>
              )}
              <button type="button" onClick={toggleFullscreen} className="rounded p-1.5 text-white hover:bg-white/20" aria-label="Fullscreen">
                <Maximize className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {watermarkText && (
        <div
          className={`pointer-events-none absolute z-10 rounded px-2 py-1 text-xs font-medium text-white/90 bg-black/40 transition-all duration-500 ${WATERMARK_POSITIONS[watermarkPosIndex]}`}
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
        >
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
