import { describeVents, ventsFor } from '../data/kamados';
import type { CookPlan, DiagramState, Dish, KamadoModel, PlanStep, Trigger, VentSetting } from '../types';

const FULL_OPEN: VentSetting = { bottomCm: 10, top: 1 };
const CLOSED: VentSetting = { bottomCm: 0, top: 0 };

const INITIAL_DIAGRAM: DiagramState = {
  coals: 'off',
  deflector: false,
  gridLevel: 2,
  meat: 'none',
  lidOpen: true,
};

function fill(text: string, kamado: KamadoModel, diagram: DiagramState, vents: VentSetting) {
  return text
    .replaceAll('{deflector}', kamado.deflectorName)
    .replaceAll('{grid}', `${diagram.gridLevel} (${kamado.gridLevels.find((g) => g.level === diagram.gridLevel)?.label ?? ''})`)
    .replaceAll('{vents}', describeVents(kamado, vents));
}

export function buildPlan(kamado: KamadoModel, dish: Dish, weightKg: number, eatAt: Date): CookPlan {
  let diagram = { ...INITIAL_DIAGRAM };
  let vents = FULL_OPEN;
  const drafts: Omit<PlanStep, 'startAt'>[] = dish.phases.map((phase, index) => {
    diagram = { ...diagram, ...phase.diagram };
    if (phase.pitTarget) vents = ventsFor(kamado, phase.pitTarget);
    else if (diagram.coals !== 'hot') vents = FULL_OPEN;

    const isLast = index === dish.phases.length - 1;
    const durationMin = Math.max(1, Math.round(phase.perKg ? phase.minutes * weightKg : phase.minutes));
    const trigger: Trigger =
      phase.trigger === 'pit' && phase.pitTarget
        ? { type: 'pit', value: phase.pitTarget }
        : phase.trigger === 'core' && phase.coreTarget
          ? { type: 'core', value: phase.coreTarget }
          : { type: phase.trigger === 'manual' ? 'manual' : 'time' };

    const tips = [...(phase.tips ?? [])];
    if (phase.pitTarget && index > 0) tips.push(`Schuifstand ${kamado.brand}: ${describeVents(kamado, vents)}.`);
    if (isLast && diagram.coals !== 'off') tips.push('Klaar? Sluit beide schuiven volledig: de kolen doven en je gebruikt ze de volgende keer opnieuw.');

    return {
      index,
      title: phase.title,
      instruction: fill(phase.instruction, kamado, diagram, vents),
      tips: tips.map((t) => fill(t, kamado, diagram, vents)),
      durationMin,
      pitTarget: phase.pitTarget,
      coreTarget: phase.coreTarget,
      trigger,
      vents: isLast && diagram.meat === 'done' ? CLOSED : vents,
      diagram: { ...diagram },
      stallPossible: !!phase.stallPossible,
      wrapOffer: !!phase.wrapOffer,
    };
  });

  const totalMin = drafts.reduce((sum, s) => sum + s.durationMin, 0);
  const lightAt = new Date(eatAt.getTime() - totalMin * 60_000);
  let cursor = lightAt.getTime();
  const steps = drafts.map((d) => {
    const step = { ...d, startAt: new Date(cursor) };
    cursor += d.durationMin * 60_000;
    return step;
  });

  return { kamado, dish, weightKg, eatAt, lightAt, totalMin, steps };
}

export function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} uur` : `${h} u ${m} min`;
}

export function formatClock(d: Date) {
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}
