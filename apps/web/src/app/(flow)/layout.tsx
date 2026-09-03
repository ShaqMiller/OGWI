import { DynamicIsland } from '@/components/flow/DynamicIsland';

/**
 * The Flow: inside a Topic. Chrome stripped to a minimal top strip plus the
 * Dynamic Island (Doc 2 A2). This is the other of the two worlds - contrast
 * with (platform)/layout.tsx's normal navigation.
 *
 * Exam mode does NOT use this layout - it has its own, structurally
 * separate shell at (flow)/exam/[examId]/layout.tsx that never imports
 * DynamicIsland.
 */
export default function FlowLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid #ddd',
        }}
      >
        <span>✕</span>
        <span>Topic name</span>
        <DynamicIsland />
      </header>
      <main style={{ padding: '1rem' }}>{children}</main>
    </div>
  );
}
