import "./PageSkeleton.css";

/**
 * Shown while a page loads its data.
 *
 * Without it the previous page just sits there frozen until the new one
 * arrives, which reads as "the app is slow" even when the wait is short.
 */
function Block({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skel ${className ?? ""}`} style={style} />;
}

export function PageSkeleton() {
  return (
    <div className="stack-8" aria-busy="true" aria-label="Loading">
      <div className="skel-head">
        <div className="stack-3">
          <Block style={{ height: "2.5rem", width: "14rem" }} />
          <Block style={{ height: "1rem", width: "20rem" }} />
        </div>
        <Block className="skel-pill" style={{ height: "2.75rem", width: "9rem" }} />
      </div>

      <div className="skel-stats">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card skel-stat">
            <Block style={{ height: "2.5rem", width: "2.5rem" }} />
            <Block style={{ height: "0.75rem", width: "6rem" }} />
            <Block style={{ height: "2rem", width: "4rem" }} />
          </div>
        ))}
      </div>

      <div className="card skel-rows">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skel-row">
            <Block className="skel-pill" style={{ height: "2.5rem", width: "2.5rem", flexShrink: 0 }} />
            <div className="skel-row-text stack-2">
              <Block style={{ height: "1rem", width: "33%" }} />
              <Block style={{ height: "0.75rem", width: "25%" }} />
            </div>
            <Block className="skel-pill" style={{ height: "1.5rem", width: "5rem" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A quieter one, for a panel rather than a whole page. */
export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card skel-rows" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Block key={i} style={{ height: "1rem", width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}
