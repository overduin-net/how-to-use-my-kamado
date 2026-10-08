# 🔥 Low & Slow – je kamado-copiloot

Kies je kamado en je gerecht, en Low & Slow maakt een foutloos stappenplan: welk rooster op welke hoogte, deflector erin of eruit, welke schuifstand, en hoe laat je moet aansteken om op tijd te eten. Tijdens het koken volgt een (gesimuleerde) draadloze temperatuurmeter alles live. De coach waarschuwt je voordat het misgaat.

## Starten

```bash
npm install
npm run dev        # opent http://localhost:5173
```

**AI-chef (optioneel):** zet `ANTHROPIC_API_KEY` als omgevingsvariabele *voordat* je `npm run dev` start. De key blijft op de server (Vite-middleware `/api/chef`) en komt nooit in de browser. Zonder key toont de app "offline" en werken de ingebouwde recepten gewoon.

```powershell
$env:ANTHROPIC_API_KEY = "<jouw key>"; npm run dev
```

**Snelkoppelingen voor de demo:**
- `http://localhost:5173/?demo=plan` opent direct het pulled-pork-plan.
- `http://localhost:5173/?demo=cook` start direct de kookmodus.

## Demoscript (±90 seconden)

| Tijd | Scherm | Wat je zegt |
|---|---|---|
| 0:00 | **Home** | "Je hebt een kamado van €1200 gekocht… en je pulled pork is droog. Daarom Low & Slow." → *Start met koken* |
| 0:10 | **Kamado kiezen** | Beweeg over de kaarten: de doorsnede rechts verandert per model. "Elk advies is specifiek voor jouw kamado." → klik *Kamado Joe* |
| 0:20 | **Gerecht** | Klik *Pulled pork*. Wijs kort naar de AI-chef: "Elk gerecht kan." |
| 0:25 | **Etenstijd** | Sleep het gewicht en wijs naar de grote klok: "Low & Slow rekent terug: om 06:35 aansteken." → *Maak mijn kookplan* |
| 0:35 | **Plan** | Klik *▶ Doorloop het plan*: het deksel gaat open, de deflector schuift erin en de schuiven draaien mee. "Je ziet wat je moet doen." → *🔥 Start koken* |
| 0:45 | **Kookmodus** (1200×, autopilot) | Laat het lopen. De coach pauzeert de simulatie zelf bij elk moment: **"Je schiet door!"** (een kamado koelt traag af), **temperatuurdip na deksel open** ("niet bijsturen"), **stall gedetecteerd**. Daarna wordt het vlees zichtbaar ingepakt in folie. Bij 93° kern: confetti en "Eet smakelijk". |
| 1:25 | Afsluiter | "De meter is nu gesimuleerd, maar de koppeling is een plug-in: een echte meter klikt erin." |

Tips: zet het geluid aan (gesproken coach in het Nederlands, als Windows een Nederlandse stem heeft). Is de kookmodus te snel of te traag, wissel dan tussen 600× en 2400×.

## Architectuur

```
src/
  data/kamados.ts      modellen: deflector, schuifnamen, roosterniveaus, schuifstanden per temperatuurband
  data/dishes.ts       6 gerechten als fases (doel-rooster/kerntemperatuur, trigger, doorsnede-status)
  engine/planner.ts    kamado + gerecht + gewicht + etenstijd → plan met tijden, teruggerekend
  engine/simulator.ts  thermisch model (vuur → koepel → kern, inclusief stall)
  engine/coach.ts      metingen + stap → advies (doorschieten voorspellen, deksel-dip, te heet/koud, stall)
  engine/session.ts    knoopt alles aan elkaar, plus de "autopilot"-kok die het advies opvolgt
  screens/, components/ UI (React), KamadoDiagram = geanimeerde SVG-doorsnede
server/chef.ts         AI-chef: Claude (claude-opus-5-5) met structured output → zelfde Dish-formaat
```

Tests: `npm test` laat elk gerecht in de simulator tot het einde doorlopen.

## Kanttekeningen

- Schuifstanden, roosterniveaus en kerntemperaturen zijn **richtlijnen** voor een demo. Ze zijn niet geverifieerd bij de fabrikanten en ook niet tegen een officiële voedselveiligheidsbron.
- De temperatuurmeter is gesimuleerd. Een echte meter vraagt per merk een eigen adapter (Bluetooth-protocol of cloud-API). Dat is nog niet gebouwd.
