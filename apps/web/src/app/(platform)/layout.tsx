import Link from 'next/link';

/**
 * The Platform: home, Practice, Progress, Awards, Oggi. Normal navigation
 * and chrome (Doc 2 A2). This is one of the two worlds - contrast with
 * (flow)/layout.tsx, which strips all of this down to the minimal top strip
 * plus the Dynamic Island once a learner is inside a Topic.
 */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const linkStyle = {
    padding: '0.4rem 0.75rem',
    borderRadius: 'var(--radius)',
    color: 'var(--color-text)',
    textDecoration: 'none',
    fontSize: '0.9rem',
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-3) var(--space-5)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <span style={{ fontWeight: 700, marginRight: 'var(--space-4)' }}>Ogwi</span>
        <Link href="/" style={linkStyle}>
          Home
        </Link>
        <Link href="/practice" style={linkStyle}>
          Practice
        </Link>
        <Link href="/progress" style={linkStyle}>
          Progress
        </Link>
        <Link href="/awards" style={linkStyle}>
          Awards
        </Link>
        <Link href="/oggi" style={linkStyle}>
          Oggi
        </Link>
        {process.env.TEST_CLOCK_ENABLED === 'true' && (
          <Link href="/dev" style={{ ...linkStyle, marginLeft: 'auto', color: 'var(--color-text-muted)' }}>
            Dev
          </Link>
        )}
      </nav>
      <main style={{ padding: 'var(--space-5)' }}>{children}</main>
    </div>
  );
}
