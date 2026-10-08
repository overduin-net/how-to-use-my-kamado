import type { DiagramState, KamadoModel, VentSetting } from '../types';

interface Props {
  kamado: KamadoModel;
  diagram: DiagramState;
  vents: VentSetting;
  pitTemp?: number;
  compact?: boolean;
}

const GRID_Y: Record<1 | 2 | 3, number> = { 1: 232, 2: 186, 3: 150 };
const MEAT_COLORS = { none: 'transparent', raw: '#c0604f', wrapped: '#cfd8dc', done: '#6d3420' };

/** Animated cross-section of a kamado showing deflector, grid level, vents, lid and food. */
export function KamadoDiagram({ kamado, diagram, vents, pitTemp, compact }: Props) {
  const gridY = GRID_Y[diagram.gridLevel];
  const hot = diagram.coals === 'hot';
  const lit = diagram.coals !== 'off';
  const bottomOpen = Math.min(vents.bottomCm / 10, 1);
  const topAngle = vents.top * 300;
  const meatOn = diagram.meat !== 'none';

  return (
    <svg className={`kamado-diagram ${compact ? 'compact' : ''}`} viewBox="-10 -70 350 430" role="img" aria-label="Doorsnede van de kamado">
      <defs>
        <radialGradient id="glow" cx="50%" cy="70%" r="60%">
          <stop offset="0%" stopColor="#ffb74d" stopOpacity={hot ? 0.9 : lit ? 0.5 : 0} />
          <stop offset="100%" stopColor="#ff5722" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="shell" x1="0" x2="1">
          <stop offset="0%" stopColor={kamado.color} stopOpacity="0.75" />
          <stop offset="50%" stopColor={kamado.color} />
          <stop offset="100%" stopColor={kamado.color} stopOpacity="0.6" />
        </linearGradient>
        <clipPath id="inside">
          <path d="M70 180 Q70 300 160 300 Q250 300 250 180 Z" />
        </clipPath>
      </defs>

      {/* Stand */}
      <rect x="95" y="318" width="130" height="10" rx="5" className="stand" />
      <rect x="110" y="326" width="10" height="26" className="stand" />
      <rect x="200" y="326" width="10" height="26" className="stand" />

      {/* Bowl */}
      <path d="M52 180 Q52 322 160 322 Q268 322 268 180 Z" fill="url(#shell)" />
      <path d="M70 180 Q70 300 160 300 Q250 300 250 180 Z" className="interior" />
      <ellipse cx="160" cy="230" rx="110" ry="90" fill="url(#glow)" clipPath="url(#inside)" className={lit ? 'glow-pulse' : ''} />

      {/* Dome (lid) */}
      <g className="dome" style={{ transform: diagram.lidOpen ? 'rotate(32deg)' : 'rotate(0deg)' }}>
        <path d="M52 178 Q52 40 160 40 Q268 40 268 178 Z" fill="url(#shell)" />
        <path d="M68 178 Q68 58 160 58 Q252 58 252 178 Z" className="interior" />
        <rect x="140" y="22" width="40" height="20" rx="6" className="vent-frame" />
        <g transform="translate(160 32)">
          <circle r="9" className="vent-hole" />
          <path d={`M0 0 L0 -9 A9 9 0 ${topAngle > 180 ? 1 : 0} 1 ${9 * Math.sin((topAngle * Math.PI) / 180)} ${-9 * Math.cos((topAngle * Math.PI) / 180)} Z`} className="vent-open" />
        </g>
        <text x="192" y="30" className="svg-label">{Math.round(vents.top * 100)}%</text>
        <rect x="262" y="150" width="30" height="8" rx="4" className="handle" />
      </g>

      {/* Fire box & coals */}
      <path d="M105 262 Q110 296 160 296 Q210 296 215 262 Z" className="firebox" />
      {Array.from({ length: 14 }).map((_, i) => (
        <circle
          key={i}
          cx={118 + (i % 7) * 14 + (i > 6 ? 7 : 0)}
          cy={i > 6 ? 268 : 280}
          r={7}
          className={`coal ${diagram.coals}`}
          style={{ animationDelay: `${(i * 137) % 900}ms` }}
        />
      ))}

      {/* Bottom vent (draft door) */}
      <g className="vent-bottom">
        <rect x="40" y="270" width="26" height="30" rx="3" className="vent-frame" />
        <rect x="44" y={274 + 22 * (1 - bottomOpen)} width="18" height={22 * bottomOpen} className="vent-hole" />
        {lit && bottomOpen > 0 && <path d="M18 286 h18" className="airflow" />}
        <text x="53" y="314" className="svg-label" textAnchor="middle">{vents.bottomCm} cm</text>
      </g>

      {/* Deflector */}
      <g className="deflector" style={{ transform: diagram.deflector ? 'translateX(0)' : 'translateX(-260px)', opacity: diagram.deflector ? 1 : 0 }}>
        <rect x="92" y="214" width="136" height="9" rx="4" className="deflector-plate" />
        <text x="160" y="240" className="svg-label small" textAnchor="middle">{kamado.deflectorName.split('(')[0].trim()}</text>
      </g>

      {/* Grid + food */}
      <g className="grid-group" style={{ transform: `translateY(${gridY - 186}px)` }}>
        <line x1="82" y1="186" x2="238" y2="186" className="grid-line" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <line key={i} x1={92 + i * 19} y1="183" x2={92 + i * 19} y2="189" className="grid-tick" />
        ))}
        {diagram.accessory === 'pizzastone' && <rect x="108" y="176" width="104" height="9" rx="4" className="pizzastone" />}
        {diagram.accessory === 'plank' && <rect x="118" y="178" width="84" height="7" rx="2" className="plank" />}
        <g className="meat" style={{ opacity: meatOn ? 1 : 0, transform: meatOn ? 'scale(1)' : 'scale(0.6)' }}>
          <ellipse cx="160" cy={diagram.accessory ? 166 : 170} rx="40" ry="16" fill={MEAT_COLORS[diagram.meat]} />
          {diagram.meat === 'wrapped' && <path d="M126 168 l10 -6 l8 7 l10 -7 l10 7 l10 -6 l8 6 l10 -5" className="foil" />}
          {diagram.meat === 'done' && (
            <g className="steam">
              <path d="M145 148 q-6 -10 0 -20 q6 -10 0 -20" />
              <path d="M165 146 q-6 -10 0 -20 q6 -10 0 -20" />
              <path d="M180 148 q-6 -10 0 -20 q6 -10 0 -20" />
            </g>
          )}
        </g>
        <text x="246" y="190" className="svg-label small">niv. {diagram.gridLevel}</text>
      </g>

      {/* Dome thermometer */}
        {pitTemp !== undefined && !Number.isNaN(pitTemp) && (
          <g transform="translate(36 52)">
            <circle r="24" className="dial" />
            <text y="6" textAnchor="middle" className="dial-text">{Math.round(pitTemp)}°</text>
          </g>
        )}
      {/* Smoke from the top vent */}
      {hot && !diagram.lidOpen && vents.top > 0 && (
        <g className="smoke">
          <path d="M160 18 q-8 -10 0 -18" />
          <path d="M166 14 q8 -10 0 -18" />
        </g>
      )}
    </svg>
  );
}
