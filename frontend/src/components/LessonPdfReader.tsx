import { useCallback, useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, FileText, Maximize2, Minimize2 } from "lucide-react";

type LessonPdfReaderProps = {
  title: string;
  pdfSrc: string;
  onPrev?: () => void;
  onNext?: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
};

export function LessonPdfReader({
  title,
  pdfSrc,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled
}: LessonPdfReaderProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [isFs, setIsFs] = useState(false);

  const syncFsState = useCallback(() => {
    const el = shellRef.current;
    setIsFs(!!el && document.fullscreenElement === el);
  }, []);

  useEffect(() => {
    document.addEventListener("fullscreenchange", syncFsState);
    return () => document.removeEventListener("fullscreenchange", syncFsState);
  }, [syncFsState]);

  const toggleFullscreen = useCallback(async () => {
    const el = shellRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div
      ref={shellRef}
      className={`flex min-h-0 w-full flex-col ${isFs ? "h-screen bg-stone-900" : "h-full bg-stone-100"}`}
    >
      <div
        className={`flex shrink-0 items-center gap-2 border-b px-3 py-2 shadow-sm ${
          isFs ? "border-stone-700 bg-stone-900" : "border-stone-200 bg-white"
        }`}
      >
        <FileText className={`h-4 w-4 shrink-0 ${isFs ? "text-red-400" : "text-red-600"}`} aria-hidden />
        <p
          className={`min-w-0 flex-1 truncate text-sm font-medium ${isFs ? "text-stone-100" : "text-stone-800"}`}
        >
          {title}
        </p>
        <button
          type="button"
          onClick={toggleFullscreen}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
            isFs
              ? "border-stone-600 bg-stone-800 text-stone-100 hover:bg-stone-700"
              : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100"
          }`}
          title={isFs ? "Exit full screen" : "Full screen"}
        >
          {isFs ? (
            <>
              <Minimize2 className="h-3.5 w-3.5" />
              Exit
            </>
          ) : (
            <>
              <Maximize2 className="h-3.5 w-3.5" />
              Full screen
            </>
          )}
        </button>
      </div>

      <iframe title={title} src={pdfSrc} className="min-h-0 w-full flex-1 border-0 bg-white" />

      <div
        className={`flex shrink-0 items-center justify-center gap-6 border-t px-4 py-2.5 ${
          isFs ? "border-stone-700 bg-stone-950" : "border-stone-200 bg-stone-900"
        }`}
      >
        <button
          type="button"
          disabled={prevDisabled}
          onClick={onPrev}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>
        <span className="text-xs text-stone-400">PDF</span>
        <button
          type="button"
          disabled={nextDisabled}
          onClick={onNext}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
