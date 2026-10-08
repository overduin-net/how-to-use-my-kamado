export interface VentSetting {
  /** Bottom draft door opening in cm (0-10). */
  bottomCm: number;
  /** Top vent opening as fraction (0-1). */
  top: number;
}

export interface KamadoModel {
  id: string;
  brand: string;
  name: string;
  diameterCm: number;
  tagline: string;
  color: string;
  deflectorName: string;
  topVentName: string;
  bottomVentName: string;
  gridLevels: { level: 1 | 2 | 3; label: string }[];
  /** Thermal mass multiplier: higher = slower to heat and to cool. */
  thermalMass: number;
  /** How easily it overshoots (0-1). */
  overshoot: number;
  /** Vent settings per target temperature band, sorted by maxTemp. */
  ventMap: { maxTemp: number; vents: VentSetting }[];
  quirks: string[];
}

export type Trigger =
  | { type: 'time' }
  | { type: 'pit'; value: number }
  | { type: 'core'; value: number }
  | { type: 'manual' };

export interface DiagramState {
  coals: 'off' | 'lit' | 'hot';
  deflector: boolean;
  gridLevel: 1 | 2 | 3;
  meat: 'none' | 'raw' | 'wrapped' | 'done';
  lidOpen: boolean;
  accessory?: 'pizzastone' | 'plank';
}

export interface PhaseTemplate {
  title: string;
  instruction: string;
  tips?: string[];
  /** Fixed minutes, or minutes per kg when perKg is set. */
  minutes: number;
  perKg?: boolean;
  pitTarget?: number;
  coreTarget?: number;
  trigger: Trigger['type'];
  diagram: Partial<DiagramState>;
  /** Marks the phase where the meat may stall. */
  stallPossible?: boolean;
  /** Phase where the user should wrap the meat if it stalls. */
  wrapOffer?: boolean;
}

export interface Dish {
  id: string;
  name: string;
  emoji: string;
  difficulty: 1 | 2 | 3;
  description: string;
  defaultWeightKg: number;
  usesProbe: boolean;
  phases: PhaseTemplate[];
  aiGenerated?: boolean;
}

export interface PlanStep {
  index: number;
  title: string;
  instruction: string;
  tips: string[];
  durationMin: number;
  startAt: Date;
  pitTarget?: number;
  coreTarget?: number;
  trigger: Trigger;
  vents: VentSetting;
  diagram: DiagramState;
  stallPossible: boolean;
  wrapOffer: boolean;
}

export interface CookPlan {
  kamado: KamadoModel;
  dish: Dish;
  weightKg: number;
  eatAt: Date;
  lightAt: Date;
  totalMin: number;
  steps: PlanStep[];
}

export interface Reading {
  t: number; // simulated minutes since start
  pit: number;
  core: number;
}

export type AdviceLevel = 'info' | 'good' | 'warn' | 'alert';

export interface Advice {
  key: string;
  level: AdviceLevel;
  title: string;
  text: string;
  speak?: string;
  /** Recommended vent change the (auto)pilot can apply. */
  vents?: VentSetting;
  action?: 'advance' | 'wrap';
}
