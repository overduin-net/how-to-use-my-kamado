import type { KamadoModel, VentSetting } from '../types';

// Openness (0-1) -> equilibrium dome temperature, roughly matching the vent maps.
const EQ_CURVE: [number, number][] = [
  [0, 25],
  [0.125, 115],
  [0.25, 162],
  [0.4, 200],
  [0.625, 262],
  [1, 400],
];

export function openness(v: VentSetting) {
  return 0.5 * Math.min(v.bottomCm / 10, 1) + 0.5 * Math.min(v.top, 1);
}

export function equilibriumTemp(v: VentSetting) {
  const o = openness(v);
  for (let i = 1; i < EQ_CURVE.length; i++) {
    const [x1, y1] = EQ_CURVE[i];
    const [x0, y0] = EQ_CURVE[i - 1];
    if (o <= x1) return y0 + ((o - x0) / (x1 - x0)) * (y1 - y0);
  }
  return EQ_CURVE[EQ_CURVE.length - 1][1];
}

export interface SimState {
  pit: number;
  fire: number;
  core: number;
  coalsLit: boolean;
  meatOn: boolean;
  wrapped: boolean;
  lidOpen: boolean;
  vents: VentSetting;
}

/**
 * Simple two-stage thermal model of a ceramic kamado: the fire chases the
 * vent-determined equilibrium, the dome chases the fire (and cools slowly),
 * the meat core chases the dome, slowed down by evaporative cooling (the stall).
 */
export class KamadoSimulator {
  state: SimState;
  private readonly mass: number;
  private litMinutes = 0;

  constructor(kamado: KamadoModel, private tauCore: number, private ambient = 18) {
    this.mass = kamado.thermalMass;
    this.state = {
      pit: ambient,
      fire: ambient,
      core: 6,
      coalsLit: false,
      meatOn: false,
      wrapped: false,
      lidOpen: true,
      vents: { bottomCm: 10, top: 1 },
    };
  }

  step(dtMin: number) {
    const s = this.state;
    if (s.coalsLit) this.litMinutes += dtMin;
    // Freshly lit charcoal needs time to catch: cap the fire while it spreads.
    const fireCap = 40 + 9 * this.litMinutes;
    const eq = s.coalsLit ? Math.min(equilibriumTemp(s.vents) * (s.lidOpen ? 1.2 : 1), fireCap) : this.ambient;
    const tauFire = 8 * this.mass;
    s.fire += ((eq - s.fire) / tauFire) * dtMin;

    if (s.lidOpen) {
      s.pit += ((Math.min(s.fire, 70) - s.pit) / 1.5) * dtMin;
    } else {
      const heating = s.fire > s.pit;
      const tauPit = (heating ? 6 : 16) * this.mass;
      s.pit += ((s.fire - s.pit) / tauPit) * dtMin;
    }

    if (s.meatOn) {
      const inStall = !s.wrapped && s.core > 63 && s.core < 77;
      const factor = inStall ? 0.1 : s.wrapped ? 1.25 : 1;
      s.core += ((s.pit - s.core) / this.tauCore) * factor * dtMin;
    }
  }

  /** Readings as a probe would report them, with a bit of sensor noise. */
  read() {
    const noise = () => (Math.random() - 0.5) * 0.6;
    return { pit: this.state.pit + noise(), core: this.state.meatOn ? this.state.core + noise() * 0.3 : NaN };
  }
}

/** Core time constant so that the simulated cook roughly matches the planned duration. */
export function coreTimeConstant(plannedMin: number, pitTemp: number, finalCore: number, hasStall: boolean) {
  const effective = hasStall ? plannedMin * 0.55 : plannedMin;
  const span = Math.log((pitTemp - 6) / Math.max(pitTemp - finalCore, 3));
  return Math.max(effective / span, 5);
}
