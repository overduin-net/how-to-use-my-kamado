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

const REPO_URL = 'https://github.com/overduin-net/how-to-use-my-kamado';
const NEW_ISSUE_URL = `${REPO_URL}/issues/new`;

/** Link to open a new GitHub issue, so visitors can report bugs or ideas. */
function GitHubIssueLink({ className }: { className?: string }) {
  return (
    <a
      href={NEW_ISSUE_URL}
      target="_blank"
      rel="noreferrer"
      className={className}
      title="Meld een probleem of idee op GitHub"
      aria-label="Meld een probleem of idee op GitHub"
    >
      <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor" aria-hidden>
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>
      </svg>
    </a>
  );
}

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
          <GitHubIssueLink className="github-link" />
        </nav>
      )}

      {screen === 'home' && (
        <section className="hero">
          <GitHubIssueLink className="github-link github-link-home" />
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
