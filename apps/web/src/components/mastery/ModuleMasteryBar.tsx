import type { ModuleMastery } from '@ogwi/shared';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';

/**
 * Doc 2 B1's module states. "Due for a refresh" is deliberately gentle and
 * never red: the spaced engine is already queueing exactly those questions, so
 * there is nothing for the learner to do about it.
 */
const STATE_LABEL = { mastered: 'Mastered', due_for_refresh: 'Due for a refresh', building: null } as const;

export function ModuleMasteryBar({ mastery }: { mastery: ModuleMastery }) {
  const percent = Math.round(mastery.displayedScore * 100);
  const label = STATE_LABEL[mastery.state];

  return (
    <div style={{ margin: 'var(--space-3) 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)', gap: 'var(--space-2)' }}>
        <span>
          {mastery.moduleName}{' '}
          {label && <Badge tone={mastery.state === 'mastered' ? 'success' : 'neutral'}>{label}</Badge>}
        </span>
        <span style={{ color: 'var(--color-text-muted)' }}>{percent}%</span>
      </div>
      <ProgressBar percent={percent} />
    </div>
  );
}
