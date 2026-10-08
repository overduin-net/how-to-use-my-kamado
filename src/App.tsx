import { useState } from 'react';
import { DISHES } from './data/dishes';
import { DEFAULT_KAMADO_ID, KAMADOS } from './data/kamados';
import { buildPlan } from './engine/planner';
import { CookMode } from './screens/CookMode';
import { PlanView } from './screens/PlanView';
import { Details, DishPicker, KamadoPicker } from './screens/Setup';
import type { CookPlan, Dish, KamadoModel } from './types';

type Screen = 'home' | 'kamado' | 'dish' | 'details' | 'plan' | 'cook';
const SCREENS: Screen[] = ['home', 'kamado', 'dish', 'details', 'plan', 'cook'];

/** Deep link for demos: ?demo=plan or ?demo=cook jumps straight in with pulled pork. */
function demoStart() {
  const param = new URLSearchParams(window.location.search).get('demo') as Screen | null;
  const screen = param && SCREENS.includes(param) ? param : 'home';
  const kamado = KAMADOS.find((k) => k.id === DEFAULT_KAMADO_ID)!;
  const dish = DISHES[0];
  const eatAt = new Date();
  eatAt.setDate(eatAt.getDate() + 1);
  eatAt.setHours(18, 30, 0, 0);
  return { screen, kamado, dish, plan: buildPlan(kamado, dish, dish.defaultWeightKg, eatAt) };
}

export default function App() {
  const [initial] = useState(demoStart);
  const [screen, setScreen] = useState<Screen>(initial.screen);
  const [kamado, setKamado] = useState<KamadoModel>(initial.kamado);
  const [dish, setDish] = useState<Dish | null>(initial.dish);
  const [plan, setPlan] = useState<CookPlan | null>(initial.plan);
  const [cookRun, setCookRun] = useState(0);

  const back: Partial<Record<Screen, Screen>> = { kamado: 'home', dish: 'kamado', details: 'dish', plan: 'details' };

  return (
    <div className="app">
      <div className="embers" aria-hidden>
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} style={{ left: `${(i * 53) % 100}%`, animationDelay: `${(i * 0.7) % 9}s`, animationDuration: `${7 + (i % 5)}s` }} />
        ))}
      </div>
      {screen !== 'home' && screen !== 'cook' && (
        <nav className="topnav">
          <button className="logo" onClick={() => setScreen('home')}>🔥 Low & Slow</button>
          {back[screen] && <button className="btn ghost small" onClick={() => setScreen(back[screen]!)}>← Terug</button>}
        </nav>
      )}

      {screen === 'home' && (
        <section className="hero">
          <div className="hero-glow" />
          <p className="eyebrow">Je kamado-copiloot</p>
          <h1 className="hero-title">Low & Slow</h1>
          <p className="hero-sub">Je hebt een kamado van €1200 gekocht… en je pulled pork is droog.<br />Low & Slow vertelt je precies wat je moet doen, stap voor stap, graad voor graad.</p>
          <button className="btn primary big" onClick={() => setScreen('kamado')}>Start met koken →</button>
          <div className="hero-features">
            <span>🧱 Advies per kamadomodel</span>
            <span>⏰ Terugplannen vanaf etenstijd</span>
            <span>📡 Live temperatuurcoach</span>
            <span>✨ AI-chef</span>
          </div>
        </section>
      )}

      {screen === 'kamado' && <KamadoPicker selected={kamado} onPick={(k) => { setKamado(k); setScreen('dish'); }} />}
      {screen === 'dish' && <DishPicker kamado={kamado} onPick={(d) => { setDish(d); setScreen('details'); }} />}
      {screen === 'details' && dish && (
        <Details kamado={kamado} dish={dish} onPlan={(w, eatAt) => { setPlan(buildPlan(kamado, dish, w, eatAt)); setScreen('plan'); }} />
      )}
      {screen === 'plan' && plan && <PlanView plan={plan} onStart={() => { setCookRun((r) => r + 1); setScreen('cook'); }} />}
      {screen === 'cook' && plan && <CookMode key={cookRun} plan={plan} onExit={() => setScreen('plan')} />}
    </div>
  );
}
