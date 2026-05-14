type SiteHeroProps = {
  subtitle: string;
  title: string;
  description: string;
  currentPrompt: string;
  stateLabel: string;
};

export function SiteHero({ subtitle, title, description, currentPrompt, stateLabel }: SiteHeroProps) {
  return (
    <header className="hero-panel">
      <div className="hero-copy">
        <div className="eyebrow">{subtitle}</div>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="hero-tags">
          <div className="hero-tag">
            <span>Prompt</span>
            <strong>{currentPrompt}</strong>
          </div>
          <div className="hero-tag">
            <span>Status</span>
            <strong>{stateLabel}</strong>
          </div>
        </div>
      </div>

      <div className="hero-visual" aria-hidden="true">
        <div className="hero-orbit" />
        <div className="hero-window">
          <div className="hero-window-inner">
            <div className="hero-rings" />
            <div className="hero-runner-card">
              <div className="hero-runner-glow" />
              <div className="hero-runner-core" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
