import type { ModuleMastery } from '@ogwi/shared';
import { ProgressBar } from '@/components/ui/ProgressBar';

export function ModuleMasteryBar({ mastery }: { mastery: ModuleMastery }) {
  const percent = Math.round(mastery.displayedScore * 100);

  return (
    <div style={{ margin: 'var(--space-3) 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
        <span>{mastery.moduleName}</span>
        <span style={{ color: 'var(--color-text-muted)' }}>{percent}%</span>
      </div>
      <ProgressBar percent={percent} />
    </div>
  );
}
