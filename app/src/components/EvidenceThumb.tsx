import { useState } from "react";

type EvidenceThumbProps = {
  /** Server-backed URL of the stored RAW file (controlled route). */
  src: string;
};

/**
 * Small photographic-evidence thumbnail served from the controlled RAW route.
 * When the file cannot be displayed the tile degrades to a neutral RAW
 * placeholder — the record itself is never hidden and never replaced by a
 * fake preview. Decorative by design: nearby text always identifies the image.
 */
export function EvidenceThumb({ src }: EvidenceThumbProps) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <span className="thumb thumb-plain" aria-hidden="true">
        RAW
      </span>
    );
  }

  return (
    <img
      className="thumb"
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}
