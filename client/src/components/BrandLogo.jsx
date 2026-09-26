export default function BrandLogo({ className = '' }) {
  return (
    <div className={`brand ${className}`.trim()} role="img" aria-label="OmniInbox">
      <img className="brand-mark" src="/icons/icon-192.svg" alt="" />
      <span>omni<span className="brand-accent">inbox</span></span>
    </div>
  );
}
