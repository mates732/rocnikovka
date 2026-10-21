import { useState, useRef, useEffect } from "react";

type EvidenceThumbProps = {
  /** Server-backed URL of the stored RAW file (controlled route). */
  src: string;
  /** Optional plant identifier for context in error state. */
  plantId?: string;
};

/**
 * Small photographic-evidence thumbnail served from the controlled RAW route.
 * Always renders the <img> element; shows loading/error overlays on top.
 * The record itself is never hidden — nearby text always identifies the image.
 */
export function EvidenceThumb({ src, plantId }: EvidenceThumbProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const imgRef = useRef<HTMLImageElement>(null);

  const handleLoad = () => setStatus("ready");
  const handleError = () => setStatus("error");
  const handleRetry = () => {
    setStatus("loading");
    // Force a fresh request by adding a cache-busting parameter
    if (imgRef.current) {
      const currentSrc = imgRef.current.src;
      const separator = currentSrc.includes("?") ? "&" : "?";
      imgRef.current.src = currentSrc + separator + "t=" + Date.now();
    }
  };

  useEffect(() => {
    // Reset status when src changes
    setStatus("loading");
  }, [src]);

  return (
    <div className="thumb-wrapper" style={{ position: "relative", display: "inline-block" }}>
      <img
        ref={imgRef}
        className={`thumb ${status === "loading" ? "thumb-is-loading" : ""} ${status === "error" ? "thumb-is-error" : ""}`}
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        onLoad={handleLoad}
        onError={handleError}
      />
      {status === "loading" && (
        <div className="thumb-overlay thumb-loading-overlay" aria-hidden="true" aria-label="Loading image…">
          <span className="thumb-spinner" />
          <span className="thumb-loading-text">Loading…</span>
        </div>
      )}
      {status === "error" && (
        <div className="thumb-overlay thumb-error-overlay" aria-label={`Failed to load image for ${plantId ?? "plant"}`}>
          <span className="thumb-error-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" />
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeLinecap="round" />
            </svg>
          </span>
          <span className="thumb-error-text">Image unavailable</span>
          <button
            type="button"
            className="thumb-retry"
            onClick={handleRetry}
            aria-label="Retry loading image"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}