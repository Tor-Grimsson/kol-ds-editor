/**
 * Reusable Phase 2 inspector placeholder. Each layer's real inspector replaces
 * this when its phase ships. Drop the Placeholder import + use direct content.
 */
export default function Placeholder({ title, stage, next, hint }) {
  return (
    <div className="kol-compose-placeholder">
      <p className="kol-helper-10 uppercase text-meta mb-1">{stage}</p>
      <p className="kol-helper-16 text-emphasis mb-3">{title}</p>
      {hint && <p className="kol-sans-body-03 text-body mb-4">{hint}</p>}
      {next && (
        <p className="kol-helper-12 text-meta pt-3 border-t border-fg-08">
          {next}
        </p>
      )}
    </div>
  )
}
