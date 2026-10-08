import type { Advice, CookPlan, PlanStep, Reading, VentSetting } from '../types';
import { coach } from './coach';
import { coreTimeConstant, KamadoSimulator } from './simulator';

export type SessionEvent =
  | { kind: 'advice'; advice: Advice; t: number }
  | { kind: 'step'; step: PlanStep; t: number }
  | { kind: 'finished'; t: number };

const SUBSTEP_MIN = 0.5;
const ADVICE_COOLDOWN_MIN = 60;
const LID_OPEN_MIN = 2;
const BEGINNER_HEATUP_VENTS: VentSetting = { bottomCm: 6, top: 0.7 };

interface PendingAction {
  at: number;
  run: () => void;
}

/** Drives one cook: simulated probe, coach and (optionally) a virtual cook following the advice. */
export class CookSession {
  readonly sim: KamadoSimulator;
  t = 0;
  stepIndex = 0;
  stepStartT = 0;
  history: Reading[] = [];
  advice: Advice | null = null;
  finished = false;
  lastLidOpenT?: number;
  private pending: PendingAction[] = [];
  private seenKeys = new Set<string>();
  private lastByType = new Map<string, number>();
  private nextSampleT = 0;
  private lastCore = NaN;

  constructor(readonly plan: CookPlan, public autopilot = true) {
    const coreSteps = plan.steps.filter((s) => s.trigger.type === 'core');
    const plannedCore = coreSteps.reduce((sum, s) => sum + s.durationMin, 0);
    const pitTemp = coreSteps[0]?.pitTarget ?? 120;
    const finalCore = coreSteps[coreSteps.length - 1]?.coreTarget ?? 60;
    const hasStall = plan.steps.some((s) => s.stallPossible);
    this.sim = new KamadoSimulator(plan.kamado, coreTimeConstant(plannedCore || 60, pitTemp, finalCore, hasStall));
    this.enterStep(0);
  }

  get step() {
    return this.plan.steps[this.stepIndex];
  }

  get vents() {
    return this.sim.state.vents;
  }

  get wrapped() {
    return this.sim.state.wrapped;
  }

  setVents(v: VentSetting) {
    this.sim.state.vents = { ...v };
  }

  wrap() {
    this.sim.state.wrapped = true;
  }

  /** Manually skip to the next step (presenter control). */
  advance(events: SessionEvent[] = []) {
    if (this.stepIndex >= this.plan.steps.length - 1) {
      this.finished = true;
      events.push({ kind: 'finished', t: this.t });
      return events;
    }
    this.enterStep(this.stepIndex + 1);
    events.push({ kind: 'step', step: this.step, t: this.t });
    return events;
  }

  private enterStep(index: number) {
    this.stepIndex = index;
    this.stepStartT = this.t;
    const step = this.step;
    const s = this.sim.state;
    s.coalsLit = step.diagram.coals !== 'off';
    if (step.diagram.meat === 'wrapped') s.wrapped = true;
    if (step.diagram.meat === 'done' || step.diagram.meat === 'none') {
      if (s.meatOn) this.lastCore = s.core;
      s.meatOn = false;
    } else if (!s.meatOn) {
      s.meatOn = true;
      if (Number.isNaN(this.lastCore)) s.core = 6;
    }
    if (this.autopilot) {
      const isFirstHeatUp = step.trigger.type === 'pit' && step.trigger.value < 200 && !this.plan.steps.slice(0, index).some((p) => p.trigger.type === 'pit');
      // The virtual beginner opens too far on the first heat-up: the coach has to catch it.
      this.setVents(isFirstHeatUp ? BEGINNER_HEATUP_VENTS : step.vents);
    }
  }

  tick(dtMin: number): SessionEvent[] {
    const events: SessionEvent[] = [];
    if (this.finished) return events;
    const end = this.t + dtMin;
    while (this.t < end && !this.finished) {
      this.t += SUBSTEP_MIN;
      this.runPending();
      this.updateLid();
      this.sim.step(SUBSTEP_MIN);
      if (this.t >= this.nextSampleT) {
        const r = this.sim.read();
        this.history.push({ t: this.t, pit: r.pit, core: this.sim.state.meatOn ? r.core : NaN });
        this.nextSampleT = this.t + 1;
        this.evaluate(events);
      }
    }
    return events;
  }

  private updateLid() {
    const s = this.sim.state;
    const d = this.step.diagram;
    const shouldBeOpen = d.lidOpen && (d.coals === 'lit' || d.meat === 'done' || this.t - this.stepStartT < LID_OPEN_MIN);
    if (s.lidOpen && !shouldBeOpen) this.lastLidOpenT = this.t;
    s.lidOpen = shouldBeOpen;
  }

  private runPending() {
    const due = this.pending.filter((p) => p.at <= this.t);
    this.pending = this.pending.filter((p) => p.at > this.t);
    due.forEach((p) => p.run());
  }

  private evaluate(events: SessionEvent[]) {
    const advice = coach({
      kamado: this.plan.kamado,
      step: this.step,
      history: this.history,
      stepStartT: this.stepStartT,
      vents: this.vents,
      wrapped: this.wrapped,
      lastLidOpenT: this.lastLidOpenT,
      isFinalCoreStep: !this.plan.steps.slice(this.stepIndex + 1).some((s) => s.trigger.type === 'core'),
    });
    if (!advice || this.seenKeys.has(advice.key)) return;

    const type = advice.key.split('-')[0];
    const last = this.lastByType.get(type);
    if (advice.action !== 'advance' && last !== undefined && this.t - last < ADVICE_COOLDOWN_MIN) return;
    this.seenKeys.add(advice.key);
    this.lastByType.set(type, this.t);

    if (advice.action === 'advance') {
      this.advance(events);
      return;
    }
    this.advice = advice;
    events.push({ kind: 'advice', advice, t: this.t });

    if (this.autopilot) {
      if (advice.vents) {
        const v = advice.vents;
        this.pending.push({ at: this.t + 4, run: () => this.setVents(v) });
      }
      if (advice.action === 'wrap') this.pending.push({ at: this.t + 8, run: () => this.wrap() });
    }
  }
}
