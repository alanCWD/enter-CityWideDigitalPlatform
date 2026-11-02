/**
 * Google "G" mark — used as an attribution icon next to a "POWERED BY" label.
 *
 * Rendered as an inline SVG so it stays crisp and inherits layout sizing. It is
 * decorative (`aria-hidden`); the surrounding text carries the accessible label.
 */
export function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.64h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.18-2 3.44-4.96 3.44-8.57Z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.1 0 5.7-1.03 7.6-2.78l-3.72-2.89c-1.03.69-2.35 1.1-3.88 1.1-2.99 0-5.52-2.02-6.43-4.73H1.73v2.98A11.5 11.5 0 0 0 12 23.5Z"
      />
      <path
        fill="#FBBC05"
        d="M5.57 14.2a6.9 6.9 0 0 1 0-4.4V6.82H1.73a11.5 11.5 0 0 0 0 10.36l3.84-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.98c1.69 0 3.2.58 4.4 1.72l3.3-3.3C17.7 1.56 15.1.5 12 .5A11.5 11.5 0 0 0 1.73 6.82l3.84 2.98C6.48 7.09 9.01 4.98 12 4.98Z"
      />
    </svg>
  );
}
