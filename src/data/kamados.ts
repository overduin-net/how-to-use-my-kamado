import type { KamadoModel } from '../types';

// Guideline values for a demo coach, not manufacturer-verified specs.
export const KAMADOS: KamadoModel[] = [
  {
    id: 'kj-classic',
    brand: 'Kamado Joe',
    name: 'Classic Joe',
    diameterCm: 46,
    tagline: 'De rode allrounder met het Divide & Conquer-systeem',
    color: '#c8102e',
    deflectorName: 'Divide & Conquer heat deflectors',
    topVentName: 'Kontrol Tower (bovenschuif)',
    bottomVentName: 'onderschuif (trekgat)',
    gridLevels: [
      { level: 1, label: 'Laag – vlak boven de kolen (searen)' },
      { level: 2, label: 'Midden – standaard roosterhoogte' },
      { level: 3, label: 'Hoog – bovenste rek (indirect)' },
    ],
    thermalMass: 1.0,
    overshoot: 0.7,
    ventMap: [
      { maxTemp: 125, vents: { bottomCm: 1, top: 0.15 } },
      { maxTemp: 160, vents: { bottomCm: 2, top: 0.3 } },
      { maxTemp: 185, vents: { bottomCm: 2.5, top: 0.4 } },
      { maxTemp: 200, vents: { bottomCm: 3, top: 0.5 } },
      { maxTemp: 260, vents: { bottomCm: 5, top: 0.75 } },
      { maxTemp: 400, vents: { bottomCm: 10, top: 1 } },
    ],
    quirks: [
      'De Kontrol Tower reageert precies: draai in kleine stapjes.',
      'Deflectors in de onderste stand van het Divide & Conquer-rek voor indirect garen.',
    ],
  },
  {
    id: 'bge-large',
    brand: 'Big Green Egg',
    name: 'Large',
    diameterCm: 46,
    tagline: 'Het iconische groene ei',
    color: '#2e7d32',
    deflectorName: 'ConvEGGtor (plaatsteen)',
    topVentName: 'rEGGulator (bovenkap)',
    bottomVentName: 'onderschuif',
    gridLevels: [
      { level: 1, label: 'Laag – op de vuurring' },
      { level: 2, label: 'Midden – standaard rooster' },
      { level: 3, label: 'Hoog – verhoogd rooster' },
    ],
    thermalMass: 1.1,
    overshoot: 0.6,
    ventMap: [
      { maxTemp: 125, vents: { bottomCm: 1, top: 0.15 } },
      { maxTemp: 160, vents: { bottomCm: 2, top: 0.25 } },
      { maxTemp: 185, vents: { bottomCm: 2.5, top: 0.4 } },
      { maxTemp: 200, vents: { bottomCm: 3, top: 0.5 } },
      { maxTemp: 260, vents: { bottomCm: 5, top: 0.8 } },
      { maxTemp: 400, vents: { bottomCm: 10, top: 1 } },
    ],
    quirks: [
      'Leg de ConvEGGtor met de pootjes omhoog en het rooster erbovenop.',
      'Het ei is zwaar keramiek: eenmaal te heet blijft hij lang te heet.',
    ],
  },
  {
    id: 'monolith-classic',
    brand: 'Monolith',
    name: 'Classic',
    diameterCm: 46,
    tagline: 'Duits degelijk met slimme schuiven',
    color: '#37474f',
    deflectorName: 'deflectorsteen',
    topVentName: 'bovenschuif',
    bottomVentName: 'onderschuif',
    gridLevels: [
      { level: 1, label: 'Laag – vlak boven de kolen' },
      { level: 2, label: 'Midden – standaard rooster' },
      { level: 3, label: 'Hoog – met verhoging' },
    ],
    thermalMass: 1.05,
    overshoot: 0.55,
    ventMap: [
      { maxTemp: 125, vents: { bottomCm: 1, top: 0.15 } },
      { maxTemp: 160, vents: { bottomCm: 2, top: 0.3 } },
      { maxTemp: 185, vents: { bottomCm: 2.5, top: 0.4 } },
      { maxTemp: 200, vents: { bottomCm: 3.5, top: 0.5 } },
      { maxTemp: 260, vents: { bottomCm: 5, top: 0.75 } },
      { maxTemp: 400, vents: { bottomCm: 10, top: 1 } },
    ],
    quirks: ['Deflectorsteen op de draagbeugel, rooster daarboven.'],
  },
  {
    id: 'generic',
    brand: 'Overig',
    name: 'Generieke kamado',
    diameterCm: 47,
    tagline: 'Elke keramische kamado werkt volgens hetzelfde principe',
    color: '#8d6e63',
    deflectorName: 'deflectorsteen / plaatsteen',
    topVentName: 'bovenschuif',
    bottomVentName: 'onderschuif',
    gridLevels: [
      { level: 1, label: 'Laag' },
      { level: 2, label: 'Midden' },
      { level: 3, label: 'Hoog' },
    ],
    thermalMass: 1.0,
    overshoot: 0.6,
    ventMap: [
      { maxTemp: 125, vents: { bottomCm: 1, top: 0.15 } },
      { maxTemp: 160, vents: { bottomCm: 2, top: 0.3 } },
      { maxTemp: 185, vents: { bottomCm: 2.5, top: 0.4 } },
      { maxTemp: 200, vents: { bottomCm: 3, top: 0.5 } },
      { maxTemp: 260, vents: { bottomCm: 5, top: 0.75 } },
      { maxTemp: 400, vents: { bottomCm: 10, top: 1 } },
    ],
    quirks: ['Bijsturen gaat altijd langzaam: wacht 10 minuten na elke aanpassing.'],
  },
];

export const DEFAULT_KAMADO_ID = 'kj-classic';

export function ventsFor(kamado: KamadoModel, targetTemp: number) {
  const band = kamado.ventMap.find((b) => targetTemp <= b.maxTemp) ?? kamado.ventMap[kamado.ventMap.length - 1];
  return band.vents;
}

export function describeVents(kamado: KamadoModel, v: { bottomCm: number; top: number }) {
  const topPct = Math.round(v.top * 100);
  return `${kamado.bottomVentName} ${v.bottomCm} cm open · ${kamado.topVentName} ${topPct}% open`;
}
