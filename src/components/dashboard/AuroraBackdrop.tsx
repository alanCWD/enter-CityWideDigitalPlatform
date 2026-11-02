/**
 * Ambient backdrop for the Glassmorphic CRM Workspace.
 *
 * Purely decorative: four slow-drifting colour orbs plus a faint grid behind
 * the workspace content. Fixed so it does not scroll with the page, and hidden
 * from assistive tech. Motion is disabled through CSS when the visitor prefers
 * reduced motion.
 */
export function AuroraBackdrop() {
  return (
    <div className="glass-aurora" aria-hidden="true">
      <div className="glass-aurora__orb glass-aurora__orb--violet" />
      <div className="glass-aurora__orb glass-aurora__orb--indigo" />
      <div className="glass-aurora__orb glass-aurora__orb--cyan" />
      <div className="glass-aurora__orb glass-aurora__orb--pink" />
      <div className="glass-aurora__grid" />
    </div>
  );
}
