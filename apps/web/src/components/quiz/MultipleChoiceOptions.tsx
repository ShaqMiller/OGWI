/**
 * The colour-coded option button list shared by every quiz-taking surface
 * (the qualification dashboard's composition-driven flow, Practice's
 * fixed-queue flow). Presentational only - selection/grading logic lives
 * in whichever component uses this.
 *
 * Two-stage feedback, because marking is now a server round-trip: tapping
 * an option locks the list and marks that option pending immediately, then
 * `correctOptionIndex` arrives with the response and the colours resolve.
 * A null `correctOptionIndex` means "not marked yet" - the answer key is
 * never known to this component before the learner has committed.
 */
export function MultipleChoiceOptions({
  options,
  correctOptionIndex,
  selectedOption,
  onSelect,
}: {
  options: string[];
  correctOptionIndex: number | null;
  selectedOption: number | null;
  onSelect: (index: number) => void;
}) {
  const marked = correctOptionIndex !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {options.map((option, index) => {
        const isSelected = selectedOption === index;
        const isCorrectAnswer = index === correctOptionIndex;

        let background = 'var(--color-bg-elevated)';
        let borderColor = 'var(--color-border)';
        let color = 'var(--color-text)';
        if (marked && isCorrectAnswer) {
          background = 'var(--color-success-bg)';
          borderColor = 'var(--color-success)';
          color = 'var(--color-success)';
        } else if (marked && isSelected) {
          background = 'var(--color-danger-bg)';
          borderColor = 'var(--color-danger)';
          color = 'var(--color-danger)';
        } else if (isSelected) {
          // Awaiting the server's verdict - acknowledge the tap without
          // claiming a result.
          borderColor = 'var(--color-text-muted)';
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
              opacity: isSelected && !marked ? 0.7 : 1,
            }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
