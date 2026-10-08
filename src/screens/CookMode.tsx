import { useEffect, useReducer, useRef, useState } from 'react';
import { KamadoDiagram } from '../components/KamadoDiagram';
import { TempChart } from '../components/TempChart';
import { describeVents } from '../data/kamados';
import { formatClock } from '../engine/planner';
import { CookSession, type SessionEvent } from '../engine/session';
import { chime, notify, requestNotifications, setVoiceEnabled, speak } from '../lib/announce';
import type { Advice, CookPlan } from '../types';
import { triggerLabel } from './PlanView';

const SPEEDS = [60, 600, 1200, 2400];
const TICK_MS = 100;

interface FeedItem {
  id: number;
  clock: string;
  advice: Advice;
}

function firstSentence(text: string) {
  const m = text.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : text).trim();
}

export function CookMode({ plan, onExit }: { plan: CookPlan; onExit: () => void }) {
  const sessionRef = useRef<CookSession>();
  if (!sessionRef.current) sessionRef.current = new CookSession(plan, true);
  const session = sessionRef.current;
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1200);
  const [voice, setVoice] = useState(true);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [spotlight, setSpotlight] = useState<Advice | null>(null);
  const holdUntil = useRef(0);
  const feedId = useRef(0);

  const clockAt = (t: number) => formatClock(new Date(plan.lightAt.getTime() + t * 60_000));

  useEffect(() => {
    void requestNotifications();
    speak(`Daar gaan we. ${plan.steps[0].title}.`);
  }, [plan]);

  useEffect(() => setVoiceEnabled(voice), [voice]);

  useEffect(() => {
    const handle = (events: SessionEvent[]) => {
      for (const e of events) {
        if (e.kind === 'step') {
          chime('step');
          speak(`Stap ${e.step.index + 1}. ${e.step.title}. ${firstSentence(e.step.instruction)}`);
          notify(`Stap ${e.step.index + 1}: ${e.step.title}`, e.step.instruction);
          holdUntil.current = Date.now() + 1800;
        } else if (e.kind === 'advice') {
          const urgent = e.advice.level === 'alert' || e.advice.level === 'warn';
          chime(urgent ? 'alert' : 'step');
          if (e.advice.speak) speak(e.advice.speak);
          notify(e.advice.title, e.advice.text);
          setFeed((f) => [{ id: feedId.current++, clock: clockAt(e.t), advice: e.advice }, ...f].slice(0, 6));
          setSpotlight(e.advice);
          holdUntil.current = Date.now() + (e.advice.key.startsWith('almost') ? 1500 : 4200);
        } else if (e.kind === 'finished') {
          chime('done');
          speak(`Je ${plan.dish.name} is klaar. Eet smakelijk!`);
          notify('Klaar!', `Je ${plan.dish.name} is klaar. Eet smakelijk!`);
        }
      }
    };
    const id = window.setInterval(() => {
      if (!running || session.finished) return;
      if (Date.now() < holdUntil.current) return rerender();
      setSpotlight(null);
      handle(session.tick((speed * TICK_MS) / 1000 / 60));
      rerender();
    }, TICK_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, speed, session]);

  const step = session.step;
  const last = session.history[session.history.length - 1];
  const pit = last?.pit ?? session.sim.state.pit;
  const core = last && !Number.isNaN(last.core) ? last.core : undefined;
  const vents = session.vents;
  const diagram = {
    ...step.diagram,
    lidOpen: session.sim.state.lidOpen,
    meat: session.wrapped && step.diagram.meat === 'raw' ? ('wrapped' as const) : step.diagram.meat,
  };
  const elapsed = session.t - session.stepStartT;
  const progress =
    step.trigger.type === 'core' && core !== undefined
      ? Math.min(1, Math.max(0, (core - 6) / (step.trigger.value - 6)))
      : step.trigger.type === 'pit'
        ? Math.min(1, Math.max(0, (pit - 18) / (step.trigger.value - 18)))
        : Math.min(1, elapsed / step.durationMin);
  const pitDelta = step.pitTarget ? pit - step.pitTarget : 0;
  const pitState = !step.pitTarget ? '' : Math.abs(pitDelta) <= 10 ? 'ok' : pitDelta > 0 ? 'hot' : 'cold';

  return (
    <section className="screen cook">
      <header className="cook-bar">
        <button className="btn ghost small" onClick={onExit}>← Plan</button>
        <div className="cook-title">
          <span>{plan.dish.emoji} {plan.dish.name}</span>
          <span className="dim">{plan.kamado.brand} {plan.kamado.name}</span>
        </div>
        <div className="sim-clock" title="Gesimuleerde tijd">
          <span className="live-dot" /> {clockAt(session.t)}
        </div>
        <div className="controls">
          <button className="btn small" onClick={() => setRunning((r) => !r)}>{running ? '⏸' : '▶'}</button>
          {SPEEDS.map((s) => (
            <button key={s} className={`btn small ${speed === s ? 'on' : ''}`} onClick={() => setSpeed(s)}>{s}×</button>
          ))}
          <button className={`btn small ${voice ? 'on' : ''}`} onClick={() => setVoice((v) => !v)}>{voice ? '🔊' : '🔇'}</button>
          <button className={`btn small ${session.autopilot ? 'on' : ''}`} onClick={() => { session.autopilot = !session.autopilot; rerender(); }} title="Virtuele kok volgt het advies">
            🤖 Autopilot
          </button>
        </div>
      </header>

      <div className="cook-grid">
        <div className="gauges">
          <div className={`gauge ${pitState}`}>
            <span className="gauge-label">Rooster</span>
            <span className="gauge-value">{Math.round(pit)}°</span>
            <span className="gauge-target">{step.pitTarget ? `doel ${step.pitTarget}°` : '—'}</span>
          </div>
          <div className="gauge core">
            <span className="gauge-label">Kern</span>
            <span className="gauge-value">{core !== undefined ? `${Math.round(core)}°` : '—'}</span>
            <span className="gauge-target">{step.coreTarget ? `doel ${step.coreTarget}°` : plan.dish.usesProbe ? 'probe klaar' : 'geen probe nodig'}</span>
          </div>
          <div className="probe-status">
            <span className="live-dot" /> Low & Slow Probe (simulatie) · verbonden
          </div>
          <div className="vent-panel">
            <p className="eyebrow">Schuiven</p>
            <label>
              <span>Onder · {vents.bottomCm} cm</span>
              <input type="range" min={0} max={10} step={0.5} value={vents.bottomCm} onChange={(e) => { session.setVents({ ...vents, bottomCm: Number(e.target.value) }); rerender(); }} />
            </label>
            <label>
              <span>Boven · {Math.round(vents.top * 100)}%</span>
              <input type="range" min={0} max={1} step={0.05} value={vents.top} onChange={(e) => { session.setVents({ ...vents, top: Number(e.target.value) }); rerender(); }} />
            </label>
            <p className="vent-advice">Advies: {describeVents(plan.kamado, step.vents)}</p>
          </div>
        </div>

        <div className="center-col">
          <div className="chart-card">
            <div className="chart-legend">
              <span className="lg pit">Rooster</span>
              <span className="lg core">Kern</span>
              <span className="lg target">Doel</span>
            </div>
            <TempChart history={session.history} pitTarget={step.pitTarget} coreTarget={step.coreTarget} />
          </div>
          <div className="current-step" key={step.index}>
            <div className="cs-head">
              <span className="eyebrow">Stap {step.index + 1}/{plan.steps.length} · {triggerLabel(step)}</span>
              <button className="btn ghost small" onClick={() => { session.advance(); rerender(); }}>Volgende →</button>
            </div>
            <h2>{step.title}</h2>
            <p>{step.instruction}</p>
            <div className="progress"><span style={{ width: `${progress * 100}%` }} /></div>
          </div>
          <ol className="step-strip">
            {plan.steps.map((s) => (
              <li key={s.index} className={s.index === step.index ? 'active' : s.index < step.index ? 'past' : ''} title={s.title} />
            ))}
          </ol>
        </div>

        <div className="right-col">
          <KamadoDiagram kamado={plan.kamado} diagram={diagram} vents={vents} pitTemp={pit} compact />
          <div className="feed">
            {feed.length === 0 && <p className="dim">De coach houdt alles in de gaten…</p>}
            {feed.map((f) => (
              <div key={f.id} className={`feed-item ${f.advice.level}`}>
                <span className="feed-clock">{f.clock}</span>
                <b>{f.advice.title}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      {spotlight && (
        <div className={`spotlight ${spotlight.level}`} key={spotlight.key}>
          <div className="spot-icon">{spotlight.level === 'alert' ? '⚠️' : spotlight.level === 'warn' ? '🌡️' : spotlight.level === 'good' ? '✅' : '💡'}</div>
          <div>
            <p className="spot-title">{spotlight.title}</p>
            <p className="spot-text">{spotlight.text}</p>
            {!session.autopilot && spotlight.vents && (
              <button className="btn small primary" onClick={() => { session.setVents(spotlight.vents!); rerender(); }}>Pas schuiven aan</button>
            )}
            {!session.autopilot && spotlight.action === 'wrap' && (
              <button className="btn small primary" onClick={() => { session.wrap(); rerender(); }}>Ingepakt ✓</button>
            )}
          </div>
        </div>
      )}

      {session.finished && (
        <div className="finished">
          <div className="confetti">{Array.from({ length: 40 }).map((_, i) => <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 10) * 0.15}s` }} />)}</div>
          <div className="finished-card">
            <div className="finished-emoji">{plan.dish.emoji}</div>
            <h1>Je {plan.dish.name.toLowerCase()} is klaar!</h1>
            <p>Low & Slow heeft je {feedId.current} keer gecoacht. Eet smakelijk 🔥</p>
            <button className="btn primary" onClick={onExit}>Terug naar het plan</button>
          </div>
        </div>
      )}
    </section>
  );
}
