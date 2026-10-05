export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="text-gold">
      <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M33 16.5A11 11 0 1 0 33 31.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 9l1.6 3.4L29 14l-3.4 1.6L24 19l-1.6-3.4L19 14l3.4-1.6z" fill="currentColor" />
    </svg>
  );
}
