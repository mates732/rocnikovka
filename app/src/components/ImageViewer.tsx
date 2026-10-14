type ImageViewerProps = {
  imageUrl?: string;
  alt?: string;
};

export function ImageViewer({ imageUrl, alt = "Plant image" }: ImageViewerProps) {
  if (!imageUrl) {
    return (
      <section className="panel image-viewer-empty" aria-label="Image viewer empty state">
        <p>No image available.</p>
      </section>
    );
  }

  return (
    <section className="panel image-viewer" aria-label="Image viewer">
      <img src={imageUrl} alt={alt} />
    </section>
  );
}
