/**
 * Option buttons for a question being sat under exam conditions.
 *
 * Deliberately NOT MultipleChoiceOptions. Every prop and branch in that
 * component exists to reveal the answer key, and passing it a permanent
 * `correctOptionIndex={null}` would be exactly the "conditional deep inside a
 * shared component" that (exam)/layout.tsx's own comment warns rots. There is
 * no prop here that could carry correctness, so no future edit can leak it by
 * accident.
 *
 * Selection stays changeable: Doc 2 A5 has Back/Next and select-then-confirm,
 * so a learner may revisit and change any answer until they submit.
 */
export function ExamOptions({
  options,
  selectedOption,
  onSelect,
}: {
  options: string[];
  selectedOption: number | null;
  onSelect: (index: number) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {options.map((option, index) => {
        const isSelected = selectedOption === index;

        return (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(index)}
            aria-pressed={isSelected}
            style={{
              textAlign: 'left',
              padding: '0.6rem 0.85rem',
              background: isSelected ? 'var(--color-bg-elevated)' : 'transparent',
              color: 'var(--color-text)',
              border: `1px solid ${isSelected ? 'var(--color-text)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
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
