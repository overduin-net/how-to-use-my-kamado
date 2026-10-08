import { useEffect, useState } from 'react';
import { KamadoDiagram } from '../components/KamadoDiagram';
import { describeVents } from '../data/kamados';
import { formatClock, formatDuration } from '../engine/planner';
import type { CookPlan, PlanStep } from '../types';

export function triggerLabel(step: PlanStep) {
  switch (step.trigger.type) {
    case 'pit':
      return `tot rooster ${step.trigger.value}°C`;
    case 'core':
      return `tot kern ${step.trigger.value}°C`;
    default:
      return formatDuration(step.durationMin);
  }
}

export function PlanView({ plan, onStart }: { plan: CookPlan; onStart: () => void }) {
  const [selected, setSelected] = useState(0);
  const [touring, setTouring] = useState(false);
  const step = plan.steps[selected];

  useEffect(() => {
    if (!touring) return;
    const id = window.setInterval(() => {
      setSelected((i) => {
        if (i >= plan.steps.length - 1) {
          setTouring(false);
          return i;
        }
        return i + 1;
      });
    }, 1400);
    return () => window.clearInterval(id);
  }, [touring, plan.steps.length]);

  return (
    <section className="screen plan">
      <header className="plan-header">
        <div>
          <p className="eyebrow">
            {plan.dish.emoji} {plan.dish.name} · {plan.weightKg.toFixed(1)} kg · {plan.kamado.brand} {plan.kamado.name}
            {plan.dish.aiGenerated && <span className="badge">✨ AI-chef</span>}
          </p>
          <h1>Jouw kookplan</h1>
        </div>
        <div className="plan-stats">
          <div><b>{formatClock(plan.lightAt)}</b><span>aansteken</span></div>
          <div><b>{formatDuration(plan.totalMin)}</b><span>totaal</span></div>
          <div><b>{formatClock(plan.eatAt)}</b><span>aan tafel</span></div>
        </div>
      </header>

      <div className="plan-body">
        <ol className="timeline">
          {plan.steps.map((s) => (
            <li key={s.index} className={s.index === selected ? 'active' : s.index < selected ? 'past' : ''}>
              <button onClick={() => { setTouring(false); setSelected(s.index); }}>
                <span className="tl-time">{formatClock(s.startAt)}</span>
                <span className="tl-dot" />
                <span className="tl-title">{s.title}</span>
                <span className="tl-trigger">{triggerLabel(s)}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="step-detail">
          <KamadoDiagram kamado={plan.kamado} diagram={step.diagram} vents={step.vents} />
          <div className="step-text" key={step.index}>
            <p className="eyebrow">Stap {step.index + 1} van {plan.steps.length} · {triggerLabel(step)}</p>
            <h2>{step.title}</h2>
            <p>{step.instruction}</p>
            <div className="chips">
              {step.pitTarget && <span className="chip pit">🌡️ Rooster {step.pitTarget}°C</span>}
              {step.coreTarget && <span className="chip core">🎯 Kern {step.coreTarget}°C</span>}
              <span className="chip">🪟 Rooster op niveau {step.diagram.gridLevel}</span>
              <span className="chip">{step.diagram.deflector ? '🧱 Deflector erin' : '🔥 Direct boven de kolen'}</span>
            </div>
            <p className="vents-line">💨 {describeVents(plan.kamado, step.vents)}</p>
            {step.tips.length > 0 && (
              <ul className="tips">
                {step.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <footer className="plan-actions">
        <button className="btn ghost" onClick={() => { setSelected(0); setTouring(true); }}>▶ Doorloop het plan</button>
        <button className="btn primary big" onClick={onStart}>🔥 Start koken</button>
      </footer>
    </section>
  );
}
