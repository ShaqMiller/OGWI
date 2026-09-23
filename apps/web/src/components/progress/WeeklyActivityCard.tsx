'use client';

import { useState } from 'react';
import { useWeeklyActivity } from '@/hooks/progress/useWeeklyActivity';
import { Button } from '@/components/ui/Button';

const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const CHART_HEIGHT = 64;

const muted = { color: 'var(--color-text-muted)', fontSize: '0.85rem' };

function weekLabel(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * Doc 2 A10 part 2: "a 7-day chart of litres earned per day, weekly summary
 * (litres · sessions · topics), skimmable previous weeks; empty days simply
 * empty" - no zero labels, no nagging about the days nothing happened.
 */
export function WeeklyActivityCard({ qualificationSlug }: { qualificationSlug: string }) {
  const [weeksAgo, setWeeksAgo] = useState(0);
  const week = useWeeklyActivity(qualificationSlug, weeksAgo);

  const days = week.data?.days ?? [];
  const busiest = Math.max(1, ...days.map((day) => day.litres));

  return (
    <div style={{ marginTop: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-2)' }}>
        <strong style={{ fontSize: '0.9rem' }}>
          {week.data?.isCurrentWeek ? 'This week so far' : `Week of ${weekLabel(week.data?.weekStart ?? '')}`}
        </strong>
        <span style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button variant="secondary" onClick={() => setWeeksAgo((current) => current + 1)}>
            Earlier
          </Button>
          {weeksAgo > 0 && (
            <Button variant="secondary" onClick={() => setWeeksAgo((current) => Math.max(0, current - 1))}>
              Later
            </Button>
          )}
        </span>
      </div>

      {week.isLoading && <p style={muted}>Loading...</p>}

      {week.data && (
        <>
          <div
            role="img"
            aria-label={`Points earned each day: ${days
              .map((day, index) => `${DAY_INITIALS[index]} ${day.litres}`)
              .join(', ')}`}
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 'var(--space-2)',
              height: CHART_HEIGHT,
              margin: 'var(--space-3) 0 var(--space-1)',
            }}
          >
            {days.map((day, index) => (
              <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                <span style={{ ...muted, fontSize: '0.7rem', textAlign: 'center' }}>
                  {day.litres > 0 ? day.litres : ''}
                </span>
                <div
                  title={`${DAY_INITIALS[index]}: ${day.litres} points`}
                  style={{
                    height: `${(day.litres / busiest) * (CHART_HEIGHT - 18)}px`,
                    background: day.litres > 0 ? 'var(--color-primary)' : 'transparent',
                    borderRadius: 'var(--radius)',
                    minHeight: day.litres > 0 ? 3 : 0,
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {DAY_INITIALS.map((initial, index) => (
              <span key={index} style={{ ...muted, flex: 1, textAlign: 'center', fontSize: '0.7rem' }}>
                {initial}
              </span>
            ))}
          </div>

          <p style={{ ...muted, margin: 'var(--space-2) 0 0' }}>
            {week.data.totals.litres} points · {week.data.totals.answers} questions ·{' '}
            {week.data.totals.sessions} session{week.data.totals.sessions === 1 ? '' : 's'} ·{' '}
            {week.data.totals.topicsCompleted} topic{week.data.totals.topicsCompleted === 1 ? '' : 's'} finished
          </p>
        </>
      )}
    </div>
  );
}
