import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'success' | 'warning';

const TONE_STYLES: Record<BadgeTone, { background: string; color: string }> = {
  neutral: { background: 'var(--color-border)', color: 'var(--color-text-muted)' },
  success: { background: 'var(--color-success-bg)', color: 'var(--color-success)' },
  warning: { background: 'var(--color-danger-bg)', color: 'var(--color-danger)' },
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.15rem 0.6rem',
        borderRadius: 999,
        fontSize: '0.75rem',
        fontWeight: 500,
        ...TONE_STYLES[tone],
      }}
    >
      {children}
    </span>
  );
}
