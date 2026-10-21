import { useState } from "react";

type ImageViewerProps = {
  imageUrl?: string;
  alt?: string;
  plantId?: string;
};

export function ImageViewer({ imageUrl, alt = "Plant image", plantId }: ImageViewerProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(imageUrl ? "loading" : "error");
  const [currentUrl, setCurrentUrl] = useState(imageUrl);

  const handleLoad = () => setStatus("ready");
  const handleError = () => setStatus("error");
  const handleRetry = () => {
    setStatus("loading");
    // Force a fresh request by adding a cache-busting parameter
    const separator = currentUrl?.includes("?") ? "&" : "?";
    setCurrentUrl((currentUrl ?? "") + separator + "t=" + Date.now());
  };

  if (status === "loading") {
    return (
      <section className="panel image-viewer image-viewer-loading" aria-label="Loading image">
        <div className="image-viewer-spinner" aria-hidden="true" />
        <p>Loading image…</p>
      </section>
    );
  }

  if (status === "error" || !currentUrl) {
    return (
      <section className="panel image-viewer image-viewer-empty" aria-label="Image unavailable">
        <div className="image-viewer-empty-state">
          <svg className="image-viewer-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M7 7l10 10M17 7l-10 10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
          </svg>
          <p className="image-viewer-empty-title">Image unavailable</p>
          <p className="image-viewer-empty-note">
            {plantId ? `Could not load image for ${plantId}.` : "No image available."}
          </p>
          {currentUrl && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleRetry}>
              Retry
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="panel image-viewer" aria-label="Image viewer">
      <img
        src={currentUrl}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        style={{ maxWidth: "100%", height: "auto", display: "block" }}
      />
    </section>
  );
}