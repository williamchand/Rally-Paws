# Demo prompts: example, test cases, and tool → UI routing

Example prompt: **“check venue at jakarta”**. The coach is instructed to call
`find_venues` (a 5-club Jakarta demo dataset) and always say results are
sample data. Venue cards carry a **View** button that opens the club detail
(`Explore` tab, `venueId` param) with prefetched day/time.

## Test cases: “check venue at jakarta”

| # | Prompt | Expected tool args | Expected surface |
|---|--------|--------------------|------------------|
| 1 | check venue at jakarta | city=Jakarta | Venue card, 5 clubs |
| 2 | check padel venues in jakarta | sport=padel, city=Jakarta | Venue card, 2 clubs |
| 3 | tennis courts near me | query or sport=tennis | Venue card, 2 clubs |
| 4 | padel venues in bandung | sport=padel, city=Bandung | Empty card + retry hint |
| 5 | check venue at jakarta (no key) | none (chat disabled) | Model-key notice text |

Backend cases 1–4 are covered by `test_find_venues_*` in
`backend/tests/test_tools.py` (nearest-first order, alias handling,
no-match note, unfiltered list). Case 5 is the existing
`model_not_configured` reply. The tool reply never invents availability:
every venue card is labelled **Demo**, and booking stays simulated.

## Suggested mobile prompts (in-app chips)

Shown as a sticky horizontal scroll row above the composer; suggestion
chips show until the first message, action chips always. Every chip sends
a chat prompt; tool cards auto-present (draft/plan modals open, venues
jump to Explore with the club open). Without a model key each chip falls
back to its direct action (form or tab), so the demo works either way.

| Chip | Prompt → tool route |
|------|---------------------|
| Check padel venues in Jakarta | find_venues → venue card → Explore detail |
| Played tennis an hour yesterday evening | prepare_activity_log → draft modal → receipt |
| Calories in a 45-minute swim? | estimate_activity_energy → estimate modal |
| Plan my week | build_training_schedule → plan modal → Save |
| Book a court | find_venues → Explore detail (fallback: Explore tab) |
| Challenge a friend | reply + Friends tab fallback (no matchup tool) |
| Log activity / Start workout / Sync watch | prompt + form fallback |

## Tool → modal/detail routing (parameters)

| Tool result card | Action | Destination + params |
|------------------|--------|----------------------|
| activity_draft | Confirm and log | Receipt modal (draft, token, estimates) |
| schedule | Save | Pet view (You tab), plan card |
| venues | View | Explore tab, venueId → day/time pick |
| matchup create | Copy | URL fragment `#m=` invite link |
