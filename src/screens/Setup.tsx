import { useEffect, useMemo, useState } from 'react';
import { KamadoDiagram } from '../components/KamadoDiagram';
import { DISHES } from '../data/dishes';
import { KAMADOS } from '../data/kamados';
import { buildPlan, formatClock, formatDuration } from '../engine/planner';
import type { Dish, KamadoModel } from '../types';

export function KamadoPicker({ selected, onPick }: { selected: KamadoModel; onPick: (k: KamadoModel) => void }) {
  const [hover, setHover] = useState<KamadoModel>(selected);
  return (
    <section className="screen two-col">
      <div>
        <p className="eyebrow">Stap 1 van 3</p>
        <h1>Welke kamado heb je?</h1>
        <p className="lede">Elk model heeft eigen schuiven, deflectors en roosterhoogtes. Low & Slow past elk advies daarop aan.</p>
        <div className="card-grid">
          {KAMADOS.map((k) => (
            <button
              key={k.id}
              className={`pick-card ${k.id === selected.id ? 'active' : ''}`}
              onMouseEnter={() => setHover(k)}
              onFocus={() => setHover(k)}
              onClick={() => onPick(k)}
            >
              <span className="swatch" style={{ background: k.color }} />
              <span className="pick-brand">{k.brand}</span>
              <span className="pick-name">{k.name}</span>
              <span className="pick-sub">{k.tagline}</span>
            </button>
          ))}
        </div>
      </div>
      <aside className="diagram-panel">
        <KamadoDiagram kamado={hover} diagram={{ coals: 'hot', deflector: true, gridLevel: 2, meat: 'none', lidOpen: false }} vents={hover.ventMap[1].vents} />
        <ul className="spec-list">
          <li><b>Deflector</b>{hover.deflectorName}</li>
          <li><b>Bovenschuif</b>{hover.topVentName}</li>
          <li><b>Onderschuif</b>{hover.bottomVentName}</li>
        </ul>
      </aside>
    </section>
  );
}

export function DishPicker({ kamado, onPick }: { kamado: KamadoModel; onPick: (d: Dish) => void }) {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [chefOnline, setChefOnline] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/chef')
      .then((r) => r.json())
      .then((j) => setChefOnline(Boolean(j.available)))
      .catch(() => setChefOnline(false));
  }, []);

  async function askChef() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/chef', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request: prompt, kamadoName: `${kamado.brand} ${kamado.name}` }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Onbekende fout');
      onPick(json.dish as Dish);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'De AI-chef is even niet bereikbaar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="screen">
      <p className="eyebrow">Stap 2 van 3 · {kamado.brand} {kamado.name}</p>
      <h1>Wat ga je maken?</h1>
      <div className="dish-grid">
        {DISHES.map((d) => (
          <button key={d.id} className="dish-card" onClick={() => onPick(d)}>
            <span className="dish-emoji">{d.emoji}</span>
            <span className="dish-name">{d.name}</span>
            <span className="dish-desc">{d.description}</span>
            <span className="dish-meta">
              {'🔥'.repeat(d.difficulty)}
              <span className="dim">{'🔥'.repeat(3 - d.difficulty)}</span>
              {d.usesProbe && <span className="badge">kernthermometer</span>}
            </span>
          </button>
        ))}
      </div>
      <div className={`chef-box ${busy ? 'busy' : ''}`}>
        <div className="chef-title">
          <span className="chef-icon">✨</span> Of vraag de AI-chef
          {chefOnline === false && <span className="badge muted">offline: zet ANTHROPIC_API_KEY</span>}
        </div>
        <form
          className="chef-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && prompt.trim()) void askChef();
          }}
        >
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="bv. lamsschouder met rozemarijn en knoflook" disabled={busy || chefOnline === false} />
          <button className="btn primary" disabled={busy || !prompt.trim() || chefOnline === false}>
            {busy ? 'De chef denkt na…' : 'Maak mijn plan'}
          </button>
        </form>
        {busy && <div className="chef-progress"><span /></div>}
        {error && <p className="error">{error}</p>}
      </div>
    </section>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const pad2 = (n: number) => String(n).padStart(2, '0');

function defaultEatTime() {
  const d = new Date();
  d.setHours(18, 30, 0, 0);
  return d;
}

export function Details({ kamado, dish, onPlan }: { kamado: KamadoModel; dish: Dish; onPlan: (weight: number, eatAt: Date) => void }) {
  const [weight, setWeight] = useState(dish.defaultWeightKg);
  const [eatAt, setEatAt] = useState(defaultEatTime);
  const plan = useMemo(() => {
    const first = buildPlan(kamado, dish, weight, eatAt);
    if (first.lightAt.getTime() >= Date.now()) return first;
    // Not feasible today any more: plan for tomorrow.
    return buildPlan(kamado, dish, weight, new Date(eatAt.getTime() + 24 * 3600_000));
  }, [kamado, dish, weight, eatAt]);
  const tomorrow = plan.eatAt.getDate() !== new Date().getDate();
  const setEatTime = (h: number, m: number) => {
    const d = new Date(eatAt);
    d.setHours(h, m, 0, 0);
    setEatAt(d);
  };

  return (
    <section className="screen two-col">
      <div>
        <p className="eyebrow">Stap 3 van 3 · {dish.emoji} {dish.name}</p>
        <h1>Wanneer wil je eten?</h1>
        <label className="field">
          <span>Gewicht {dish.usesProbe ? 'van het vlees' : ''}</span>
          <div className="range-row">
            <input type="range" min={0.4} max={6} step={0.1} value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
            <output>{weight.toFixed(1)} kg</output>
          </div>
        </label>
        {/* Two selects instead of <input type="time">, whose 12/24h display follows the browser locale. */}
        <div className="field">
          <span>Etenstijd</span>
          <div className="time-select">
            <select aria-label="Uur" value={eatAt.getHours()} onChange={(e) => setEatTime(Number(e.target.value), eatAt.getMinutes())}>
              {HOURS.map((h) => <option key={h} value={h}>{pad2(h)}</option>)}
            </select>
            <span>:</span>
            <select aria-label="Minuten" value={eatAt.getMinutes()} onChange={(e) => setEatTime(eatAt.getHours(), Number(e.target.value))}>
              {MINUTES.map((m) => <option key={m} value={m}>{pad2(m)}</option>)}
            </select>
          </div>
        </div>
        <button className="btn primary big" onClick={() => onPlan(weight, plan.eatAt)}>
          Maak mijn kookplan →
        </button>
      </div>
      <aside className="countdown-card">
        <p className="eyebrow">Low & Slow rekent terug</p>
        <div className="big-time">{formatClock(plan.lightAt)}</div>
        <p className="countdown-sub">{tomorrow ? 'Morgen' : 'Vandaag'} je houtskool aansteken</p>
        <div className="countdown-row">
          <div><b>{formatDuration(plan.totalMin)}</b><span>totale tijd</span></div>
          <div><b>{plan.steps.length}</b><span>stappen</span></div>
          <div><b>{formatClock(plan.eatAt)}</b><span>aan tafel</span></div>
        </div>
      </aside>
    </section>
  );
}
