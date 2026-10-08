import { describe, expect, it } from 'vitest';
import { DISHES } from '../data/dishes';
import { KAMADOS } from '../data/kamados';
import { buildPlan } from './planner';
import { CookSession, type SessionEvent } from './session';

const eatAt = new Date('2026-10-10T18:30:00');

function runToEnd(dishId: string, kamadoId = 'kj-classic') {
  const dish = DISHES.find((d) => d.id === dishId)!;
  const kamado = KAMADOS.find((k) => k.id === kamadoId)!;
  const session = new CookSession(buildPlan(kamado, dish, dish.defaultWeightKg, eatAt));
  const events: SessionEvent[] = [];
  for (let i = 0; i < 2000 && !session.finished; i++) events.push(...session.tick(2));
  return { session, events };
}

describe('buildPlan', () => {
  it('schedules backwards from the eating time', () => {
    const dish = DISHES[0];
    const plan = buildPlan(KAMADOS[0], dish, 2.5, eatAt);
    expect(plan.lightAt.getTime() + plan.totalMin * 60_000).toBe(eatAt.getTime());
    expect(plan.steps[0].startAt.getTime()).toBe(plan.lightAt.getTime());
    expect(plan.steps.every((s) => !s.instruction.includes('{'))).toBe(true);
  });
});

describe('CookSession autopilot', () => {
  it('cooks pulled pork to the end and shows the coach highlights', () => {
    const { session, events } = runToEnd('pulled-pork');
    const keys = events.filter((e) => e.kind === 'advice').map((e) => (e.kind === 'advice' ? e.advice.key : ''));
    console.log('pulled pork sim minutes', session.t, keys);
    expect(session.finished).toBe(true);
    expect(keys.some((k) => k.startsWith('overshoot'))).toBe(true);
    expect(keys.some((k) => k.startsWith('lid'))).toBe(true);
    expect(keys.some((k) => k.startsWith('stall'))).toBe(true);
  });

  it.each(DISHES.map((d) => d.id))('finishes %s', (id) => {
    const { session } = runToEnd(id);
    console.log(id, 'sim minutes', session.t, 'planned', session.plan.totalMin);
    expect(session.finished).toBe(true);
  });
});
