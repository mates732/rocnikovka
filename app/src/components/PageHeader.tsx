type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Small overline placed above the h1, e.g. a workflow section name. */
  eyebrow?: string;
  /** id applied to the h1 (used by `aria-labelledby` on the page section). */
  titleId?: string;
};

export function PageHeader({ title, description, actions, eyebrow, titleId }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
        <h1 id={titleId} className="page-title">
          {title}
        </h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}
