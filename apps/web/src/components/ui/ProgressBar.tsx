export function ProgressBar({ percent, color }: { percent: number; color?: string }) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div
      style={{
        background: 'var(--color-border)',
        height: 8,
        width: '100%',
        borderRadius: 999,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: color ?? 'var(--color-primary)',
          height: '100%',
          width: `${clamped}%`,
          borderRadius: 999,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}
