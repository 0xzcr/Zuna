// Adapted to Zuna's dependency-free CSS system from Aceternity UI's public components:
// https://ui.aceternity.com/components/spotlight
// https://ui.aceternity.com/components/moving-border

export function Spotlight() {
  return (
    <svg className="aceternity-spotlight" viewBox="0 0 700 500" aria-hidden="true">
      <defs>
        <radialGradient id="zuna-spotlight" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity=".28" />
          <stop offset="55%" stopColor="currentColor" stopOpacity=".08" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="350" cy="190" rx="340" ry="240" fill="url(#zuna-spotlight)" />
    </svg>
  );
}

export function MovingBorder({ children, className = '' }) {
  return (
    <div className={`aceternity-moving-border ${className}`.trim()}>
      <span className="moving-border-orbit" aria-hidden="true" />
      <div className="moving-border-content">{children}</div>
    </div>
  );
}
