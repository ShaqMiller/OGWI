/**
 * The colour-coded option button list shared by every quiz-taking surface
 * (the qualification dashboard's composition-driven flow, Practice's
 * fixed-queue flow). Presentational only - selection/grading logic lives
 * in whichever component uses this.
 */
export function MultipleChoiceOptions({
  options,
  correctOptionIndex,
  selectedOption,
  onSelect,
}: {
  options: string[];
  correctOptionIndex: number;
  selectedOption: number | null;
  onSelect: (index: number) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {options.map((option, index) => {
        const isSelected = selectedOption === index;
        const isCorrectAnswer = index === correctOptionIndex;
        const showResult = selectedOption !== null;

        let background = 'var(--color-bg-elevated)';
        let borderColor = 'var(--color-border)';
        let color = 'var(--color-text)';
        if (showResult && isCorrectAnswer) {
          background = 'var(--color-success-bg)';
          borderColor = 'var(--color-success)';
          color = 'var(--color-success)';
        } else if (showResult && isSelected) {
          background = 'var(--color-danger-bg)';
          borderColor = 'var(--color-danger)';
          color = 'var(--color-danger)';
        }

        return (
          <button
            key={option}
            type="button"
            disabled={selectedOption !== null}
            onClick={() => onSelect(index)}
            style={{
              textAlign: 'left',
              padding: '0.6rem 0.85rem',
              background,
              color,
              border: `1px solid ${borderColor}`,
              borderRadius: 'var(--radius)',
              cursor: selectedOption === null ? 'pointer' : 'default',
              fontSize: '0.95rem',
            }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
