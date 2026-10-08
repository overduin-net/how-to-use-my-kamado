import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { Dish, PhaseTemplate } from '../src/types';

const PhaseSchema = z.object({
  title: z.string(),
  instruction: z.string(),
  tips: z.array(z.string()),
  minutes: z.number(),
  perKg: z.boolean(),
  pitTarget: z.number().nullable(),
  coreTarget: z.number().nullable(),
  trigger: z.enum(['time', 'pit', 'core']),
  coals: z.enum(['off', 'lit', 'hot']),
  deflector: z.boolean(),
  gridLevel: z.number(),
  meat: z.enum(['none', 'raw', 'wrapped', 'done']),
  lidOpen: z.boolean(),
  stallPossible: z.boolean(),
});

const DishSchema = z.object({
  name: z.string(),
  emoji: z.string(),
  difficulty: z.number(),
  description: z.string(),
  defaultWeightKg: z.number(),
  usesProbe: z.boolean(),
  phases: z.array(PhaseSchema),
});

const SYSTEM = `Je bent een ervaren kamado-pitmaster die beginners stap voor stap begeleidt.
Je maakt een kookplan voor een keramische kamado als een reeks fases. Schrijf alle tekst in het Nederlands, kort en concreet, gericht aan "je".

Regels voor de fases:
- Begin altijd met: houtskool aansteken (trigger "time", 10 min, coals "lit", lidOpen true), daarna rooster/deflector plaatsen (trigger "time", coals "lit"), daarna opwarmen (trigger "pit" met pitTarget, coals "hot", lidOpen false).
- Gebruik trigger "core" met coreTarget voor fases die eindigen op kerntemperatuur; zet dan perKg true en minutes = geschatte minuten per kg.
- Gebruik trigger "time" voor fases met vaste duur.
- Fases waarin vlees op het rooster ligt hebben meat "raw" (of "wrapped" als het ingepakt is); de laatste rust/serveerfase meat "done".
- deflector true voor indirect garen, false voor direct grillen/searen. gridLevel 1 (laag, searen), 2 (standaard) of 3 (hoog).
- Gebruik in instructies de placeholder {deflector} voor de naam van de deflector en {vents} voor de schuifstanden; de app vult die in per kamadomodel.
- stallPossible true alleen voor grote stukken vlees die lang low & slow garen.
- difficulty 1, 2 of 3. Gebruik gangbare veilige kerntemperaturen.
- Maximaal 9 fases.`;

function toDish(raw: z.infer<typeof DishSchema>): Dish {
  const phases: PhaseTemplate[] = raw.phases.map((p) => ({
    title: p.title,
    instruction: p.instruction,
    tips: p.tips,
    minutes: Math.max(1, p.minutes),
    perKg: p.perKg,
    pitTarget: p.pitTarget ?? undefined,
    coreTarget: p.coreTarget ?? undefined,
    trigger: p.trigger === 'pit' && !p.pitTarget ? 'time' : p.trigger === 'core' && !p.coreTarget ? 'time' : p.trigger,
    diagram: {
      coals: p.coals,
      deflector: p.deflector,
      gridLevel: (Math.min(3, Math.max(1, Math.round(p.gridLevel))) as 1 | 2 | 3),
      meat: p.meat,
      lidOpen: p.lidOpen,
    },
    stallPossible: p.stallPossible,
    wrapOffer: p.stallPossible,
  }));
  return {
    id: `ai-${Date.now()}`,
    name: raw.name,
    emoji: raw.emoji || '✨',
    difficulty: (Math.min(3, Math.max(1, Math.round(raw.difficulty))) as 1 | 2 | 3),
    description: raw.description,
    defaultWeightKg: raw.defaultWeightKg > 0 ? raw.defaultWeightKg : 1,
    usesProbe: raw.usesProbe,
    phases,
    aiGenerated: true,
  };
}

export async function generateDish(request: string, kamadoName: string): Promise<Dish> {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: 'user', content: `Kamado: ${kamadoName}\nGerecht: ${request}` }],
    output_config: { effort: 'low', format: zodOutputFormat(DishSchema) },
  });
  if (response.stop_reason === 'refusal') throw new Error('De chef weigerde dit verzoek.');
  if (!response.parsed_output) throw new Error('De chef gaf geen bruikbaar recept terug.');
  return toDish(response.parsed_output);
}

export function chefAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
