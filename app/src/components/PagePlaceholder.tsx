type PagePlaceholderProps = {
  title: string;
};

export function PagePlaceholder({ title }: PagePlaceholderProps) {
  return (
    <section className="page" aria-labelledby="page-title">
      <header className="page-header">
        <h1 id="page-title">{title}</h1>
      </header>
      <div className="panel" role="region" aria-label="Implementation status">
        <p>This page is not implemented yet.</p>
      </div>
      <div className="panel" role="status" aria-label="Pilot data status">
        <p className="empty-state-title">No pilot data available yet.</p>
        <p className="empty-state-description">
          The application is ready for pilot data acquisition.
        </p>
      </div>
    </section>
  );
}
