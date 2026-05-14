import Logo from "@/components/logo/logo";

export function MobileBlock() {
  return (
    <div className="mobile-block" aria-hidden>
      <div className="mobile-block-card">
        <div className="mobile-block-logo">
          <Logo />
        </div>
        <h1 className="mobile-block-title">Open on desktop</h1>
      </div>
    </div>
  );
}
