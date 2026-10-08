import { describeVents } from '../data/kamados';
import type { Advice, KamadoModel, PlanStep, Reading, VentSetting } from '../types';

export interface CoachInput {
  kamado: KamadoModel;
  step: PlanStep;
  history: Reading[];
  stepStartT: number;
  vents: VentSetting;
  wrapped: boolean;
  /** True when this step's core target is the last one of the cook. */
  isFinalCoreStep?: boolean;
  /** Simulated minute of the last lid-open event, if any. */
  lastLidOpenT?: number;
}

/** Temperature change per minute over the trailing window (in simulated minutes). */
export function trend(history: Reading[], field: 'pit' | 'core', windowMin: number) {
  if (history.length < 2) return 0;
  const last = history[history.length - 1];
  let first = history[history.length - 2];
  for (let i = history.length - 1; i >= 0; i--) {
    first = history[i];
    if (last.t - history[i].t >= windowMin) break;
  }
  const dt = last.t - first.t;
  if (dt <= 0 || Number.isNaN(last[field]) || Number.isNaN(first[field])) return 0;
  return (last[field] - first[field]) / dt;
}

const openness = (v: VentSetting) => v.bottomCm / 10 + v.top;

/** Close to the recommended setting first; if already there, close a little further. */
function tighten(v: VentSetting, recommended: VentSetting): VentSetting {
  if (openness(v) > openness(recommended) + 0.02) return recommended;
  return { bottomCm: Math.max(0.5, v.bottomCm - 0.5), top: Math.max(0.05, Math.round((v.top - 0.05) * 20) / 20) };
}

/** Open to the recommended setting first; if already there, open a little further. */
function loosen(v: VentSetting, recommended: VentSetting): VentSetting {
  if (openness(v) < openness(recommended) - 0.02) return recommended;
  return { bottomCm: Math.min(10, v.bottomCm + 0.5), top: Math.min(1, Math.round((v.top + 0.05) * 20) / 20) };
}

const ventsDiffer = (a: VentSetting, b: VentSetting) => Math.abs(a.bottomCm - b.bottomCm) > 0.4 || Math.abs(a.top - b.top) > 0.04;

/** Returns the single most relevant piece of advice for this moment, or null. */
export function coach(input: CoachInput): Advice | null {
  const { kamado, step, history, stepStartT, vents, wrapped, lastLidOpenT } = input;
  const now = history[history.length - 1];
  if (!now) return null;
  const elapsed = now.t - stepStartT;
  const pitTrend = trend(history, 'pit', 4);

  // 1. Step completion
  if (step.trigger.type === 'time' && elapsed >= step.durationMin) {
    return { key: `done-${step.index}`, level: 'good', title: 'Stap afgerond', text: step.title, action: 'advance' };
  }
  if (step.trigger.type === 'pit' && now.pit >= step.trigger.value - 3) {
    return {
      key: `done-${step.index}`,
      level: 'good',
      title: `${Math.round(now.pit)}°C bereikt`,
      text: 'Doeltemperatuur bereikt. Door naar de volgende stap.',
      speak: `De kamado is op ${step.trigger.value} graden.`,
      action: 'advance',
    };
  }
  if (step.trigger.type === 'core' && now.core >= step.trigger.value) {
    return {
      key: `done-${step.index}`,
      level: 'good',
      title: `Kern ${Math.round(now.core)}°C`,
      text: 'Kerntemperatuur bereikt!',
      speak: `De kerntemperatuur is ${step.trigger.value} graden.`,
      action: 'advance',
    };
  }

  // 2. Heat-up overshoot prediction: a kamado is slow to cool, so act early
  if (step.trigger.type === 'pit') {
    const target = step.trigger.value;
    const lookahead = 10 * (1 + kamado.overshoot);
    const projected = now.pit + Math.max(pitTrend, 0) * lookahead;
    if (projected > target + 15 && now.pit > target - 60 && ventsDiffer(vents, step.vents)) {
      return {
        key: `overshoot-${step.index}`,
        level: 'alert',
        title: 'Je schiet door!',
        text: `Op deze koers zit je straks op ±${Math.round(projected)}°C. Knijp nu al af naar: ${describeVents(kamado, step.vents)}. Een kamado afkoelen duurt veel langer dan opwarmen.`,
        speak: `Let op, je schiet door. Knijp de schuiven nu al af. Een kamado koelt heel traag af.`,
        vents: step.vents,
      };
    }
    if (elapsed > 15 && now.pit < target - 20 && pitTrend < 0.5) {
      const next = loosen(vents, step.vents);
      return {
        key: `slow-${step.index}-${Math.round(now.t / 20)}`,
        level: 'warn',
        title: 'Opwarmen gaat te traag',
        text: `De temperatuur klimt nauwelijks. Zet de schuiven verder open: ${describeVents(kamado, next)}.`,
        speak: 'Het opwarmen gaat te traag. Zet de schuiven verder open.',
        vents: next,
      };
    }
    return null;
  }

  // 3. Pit control during the cook
  if (step.pitTarget && step.diagram.coals === 'hot' && !step.diagram.lidOpen) {
    const target = step.pitTarget;
    const sinceLid = lastLidOpenT === undefined ? Infinity : now.t - lastLidOpenT;
    if (sinceLid < 20 && now.pit < target - 8) {
      return {
        key: `lid-${Math.round(lastLidOpenT ?? 0)}`,
        level: 'info',
        title: 'Temperatuurdip na deksel open',
        text: 'Normaal! Het deksel is open geweest. Niet aan de schuiven komen: de keramiek warmt de lucht binnen ~10 minuten weer op.',
        speak: 'Temperatuurdip gezien. Niet bijsturen, dit herstelt vanzelf.',
      };
    }
    if (now.pit > target + 15) {
      const next = tighten(vents, step.vents);
      return {
        key: `hot-${step.index}-${Math.round(now.t / 30)}`,
        level: 'warn',
        title: `Te heet: ${Math.round(now.pit)}°C`,
        text: `Knijp de schuiven af naar ${describeVents(kamado, next)} en wacht 10 minuten voor je opnieuw bijstuurt.`,
        speak: 'De kamado is te heet. Knijp de schuiven wat af.',
        vents: next,
      };
    }
    if (now.pit < target - 15 && pitTrend <= 0.1) {
      const next = loosen(vents, step.vents);
      return {
        key: `cold-${step.index}-${Math.round(now.t / 30)}`,
        level: 'warn',
        title: `Te koud: ${Math.round(now.pit)}°C`,
        text: `Zet de schuiven iets verder open: ${describeVents(kamado, next)}.`,
        speak: 'De temperatuur zakt. Zet de schuiven iets verder open.',
        vents: next,
      };
    }
  }

  // 4. Stall detection
  if (step.stallPossible && !wrapped && now.core > 62 && now.core < 78 && elapsed > 30) {
    const coreTrend = trend(history, 'core', 30);
    if (coreTrend < 0.05) {
      return {
        key: `stall-${step.index}`,
        level: 'info',
        title: 'Stall gedetecteerd 🧘',
        text: `De kern hangt al een tijdje rond ${Math.round(now.core)}°C. Dat is normaal: het vlees koelt zichzelf af door verdamping. Wil je sneller? Pak het in in butcher paper of folie.`,
        speak: 'Stall gedetecteerd. Dit is normaal. Wil je sneller klaar zijn, pak het vlees dan in.',
        action: 'wrap',
      };
    }
  }

  // 5. Almost done (final core target only, and only while the core is actually climbing)
  if (step.trigger.type === 'core' && input.isFinalCoreStep && now.core >= step.trigger.value - 4 && trend(history, 'core', 10) > 0.05) {
    return {
      key: `almost-${step.index}`,
      level: 'info',
      title: 'Bijna!',
      text: `Nog ${Math.max(1, Math.round(step.trigger.value - now.core))}°C te gaan. Leg alvast klaar wat je nodig hebt voor de volgende stap.`,
      speak: 'Bijna op temperatuur. Maak je klaar voor de volgende stap.',
    };
  }

  return null;
}
