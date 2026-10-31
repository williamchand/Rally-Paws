# Rally — Product Vision and Requirements

**Working name:** RallyPaws (placeholder)  
**Product:** A social activity platform where people play, improve at their own pace, share sessions with friends, and grow a customizable companion pet.  
**Current prototype:** React + TypeScript web app (PWA) with a FastAPI backend  
**Business model:** Freemium, with a paid subscription as the primary revenue stream.

> **Pitch in one sentence:** RallyPaws makes every kind of play count—from a faster run or a better golf round to chess practice and esports—by turning personal progress and shared activity into a social game you want to return to.

## 1. The opportunity

Fitness apps often center on a narrow set of workouts or competitive leaderboards. RallyPaws is built around a broader daily ritual: play a sport, record the result, notice personal improvement, share it with friends, and use earned experience to grow a pet. Physical activities, mind sports, esports, and everyday movement can live in one app while retaining distinct records and fair comparisons.

This document describes the product vision and planned requirements, not a claim that every feature is implemented. The current repository is a React + TypeScript web app (PWA) with a FastAPI backend; native Android and Health Connect work remain future roadmap items. The first release should prove a focused habit loop before attempting a full 600-activity catalog.

## 2. Product principles

1. **Personal bests matter.** A faster pace, new chess rating high, improved golf score, or practice streak can feel rewarding without beating another person.
2. **Every activity has its own scorecard.** Do not compare unlike activities by one universal score or calorie count.
3. **Progress is welcoming.** XP rewards participation, consistency, learning, and personal milestones—not only winning, intensity, or hours logged.
4. **A pet celebrates healthy habits.** It should not shame users for rest days or make users feel they must exercise every day.
5. **Health data stays user-controlled.** Ask for specific permissions, explain the benefit, and make disconnecting or deleting data understandable.
6. **Health guidance and advertising stay distinct.** Sponsorships are labeled and do not determine health recommendations.

## 3. Core user loop

1. **Open into the AI home.** The first screen is a welcoming chat with personalized recommendations and clear quick actions.
2. **Pick or discover an activity.** Ask the AI, choose a recommendation, find a friend’s game, or explore a nearby venue.
3. **Track or log it.** Start a phone session, sync an opted-in watch record, or enter a result manually through chat or a form.
4. **See what improved.** Compare against the user’s own past records and surface a relevant milestone.
5. **Share selectively.** Post a designed activity card to friends or a sport community.
6. **Earn XP and care for a pet.** Unlock cosmetics, animations, rooms, toys, and profile flair.
7. **Plan what’s next.** The AI coach suggests a realistic next session or lets the user build a schedule through chat.

### First screen: chat plus recommendations

Make the initial landing screen a chat-first **Today** experience, inspired by the supplied conversational UI reference. The chat should be the primary way to ask for help, while recommendation cards and one-tap actions make the app useful before a user types anything.

- Welcome the user and summarize only opted-in context, such as today’s activity or their selected goal.
- Show a small set of relevant recommendations: a suggested session, a friend’s upcoming game, a nearby venue, a recovery suggestion, or a personal-best challenge.
- Keep quick actions visible: **Log activity**, **Start workout**, **Sync watch**, and **Plan my week**.
- Let a user say “I just played tennis for an hour” and have the AI prepare a tennis session form with duration and optional score. It can fill known fields but should let the user review and confirm before saving.
- For live workouts, the AI can open the appropriate in-app tracking screen or invoke a `start_workout` action. Android permission dialogs, GPS recording, and background tracking remain native app experiences; the model should not fabricate that a session has started.
- Once saved, show the activity card, calorie source/estimate label, XP earned, and pet progress in the chat.
- Recommendations must state why they appear, offer dismiss/refresh controls, and clearly label sponsored results.

Recommended bottom navigation: **Today** (AI chat/home), **Explore** (sports and venues), **Activity** (history and records), **Friends** (feed and challenges), **You** (profile, pet, settings). Keep the chat composer accessible and support both text and clear action chips.

### Example: running

Record a run with distance, elapsed time, pace, route (optional), and perceived effort. Celebrate a personal-best pace or longest distance, then share a card and earn XP. GPS-derived pace can work with a phone; a smartwatch is optional.

### Other scorecards

| Activity | Useful records and personal progress |
|---|---|
| Golf | Course, tee, strokes, handicap (if supplied), putts, fairways, personal round records |
| Tennis | Opponent (optional), sets, games, match result, practice duration, serve or rally goals |
| Football / soccer | Match or practice, goals, assists, result, duration, team participation |
| Volleyball | Sets, points, result, position, practice goals |
| Chess | Time control, result, rating (manual or linked where available), puzzles, study sessions |
| Esports | Game, mode, match result, rank (manual or supported integration), practice goals |
| Gym / strength | Exercises, sets, reps, load, personal records, session duration |
| Flexible activity | Activity name, duration, effort, notes, and optional custom fields |

The first version can ship with detailed templates for a short list—running, walking, gym/strength, football, tennis, golf, volleyball, cycling, swimming, and chess—plus a flexible “other activity” logger. Expand templates from real demand.

## 4. Catalog strategy: 600+ activities

Treat “600+” as a discoverable catalog of sport, exercise, recreation, esports, chess, and movement types—not 600 individually engineered integrations. No single universal, authoritative public dataset provides a complete and consistently scored 600-sport catalog.

- Maintain a first-party activity taxonomy with categories, aliases, localization, and stable IDs.
- Seed physical-activity names and intensity matches from the **2024 Adult Compendium of Physical Activities** where a valid match exists. It includes more than 1,100 activity entries across sports, conditioning, transport, household, occupational, and sedentary contexts.
- Use public sport lists and governing-body references to curate names and conventional scoring fields; record provenance and review dates. Do not imply endorsement by those organizations.
- Maintain esports titles and modes as a separate, curated catalog. Publisher APIs are optional integrations, not a universal source.
- Allow community suggestions and custom activity templates, with moderation and duplicate merging.
- Store aliases (e.g., football/soccer), category, physical/mind/esport classification, scoring schema, MET mapping (optional), XP policy, and source/version metadata.
- Build detailed scoring templates only for the highest-use activities. All remaining entries can use flexible session logging.

## 5. Android-first tracking and smartwatch calories

### Preferred source: Android Health Connect

Use **Health Connect** as the Android interoperability layer for user-authorized health and fitness records. Read relevant record types only after explaining the feature and requesting granular permission. The likely MVP data includes exercise sessions, active calories burned, steps, distance, and—only if needed—heart rate. Health Connect can make records from compatible apps/devices available, but availability depends on the user’s phone, watch, companion apps, sync state, permissions, and history.

Design for missing or delayed records: show the source, time window, and sync status; prevent duplicate workouts when a user logs manually and a synced record arrives; let users correct or remove an imported session. Never promise that every watch brand or model will sync identically.

### No-watch fallback: transparent estimate table

Use the **2024 Adult Compendium of Physical Activities** as the initial source for activity MET values. Match the user’s activity and intensity to a listed entry; collect duration and optionally user-entered body weight. Use a published, explainable formula rather than asking an LLM to invent a number:

```text
estimated gross kcal = MET × 3.5 × weight_kg ÷ 200 × duration_minutes
estimated active kcal ≈ (MET − 1) × 3.5 × weight_kg ÷ 200 × duration_minutes
```

The second formula subtracts resting energy approximately. If weight is unknown, show an estimate range using a default population range or omit the calorie number; disclose the assumption and let users opt out. MET-based values are population-level estimates, not individual measurements. Store the MET code, source version, chosen intensity, inputs, and whether calories are device-reported or estimated.

Example display: **“About 180–240 active kcal · estimated from activity, duration, and your selected profile weight.”** Prefer a range where uncertainty is material. Do not show false precision.

### Office-day and everyday movement

The Compendium includes occupational and sedentary activities, which can support rough estimates for logged work tasks or movement breaks. Do **not** claim to know calories burned merely because someone is at an office. Separate resting/baseline expenditure from active calories; do not add sedentary work METs on top of a full-day total in a way that double-counts resting energy. For the MVP, report steps, movement minutes, and breaks from available device records; label any task-based calorie estimate clearly and keep it optional.

### Non-physical activities

Chess and esports support session time, results, rank, goals, and skill progress. They do not get exercise calories or physical-activity XP multipliers by default. Celebrate them through their own achievements and balanced screen-break reminders.

## 6. AI agent and tools

The LLM is a conversational planner and explainer. It should call bounded app tools for verified calculations and user-authorized actions; it should not fabricate health data or directly control purchases.

| Tool | Purpose | Guardrail |
|---|---|---|
| `get_activity_summary` | Read permitted Health Connect records for a time range | Permission-gated; return source and freshness |
| `estimate_activity_energy` | Calculate MET estimate from catalog entry, duration, and optional weight | Deterministic formula; return assumptions and uncertainty |
| `create_activity_session` | Save manual or phone-tracked session | Confirm editable fields before saving |
| `start_workout` | Open or initialize the selected in-app workout tracker | The native app handles permission, GPS, background tracking, and visible active-session controls; confirm before starting if needed |
| `prepare_activity_log` | Convert chat details into a draft sport-specific activity form | Draft only; never save until the user reviews and confirms |
| `get_personal_records` | Retrieve comparable records for one activity | Compare like-for-like units and conditions |
| `build_training_schedule` | Draft a schedule from goals, availability, and activity preferences | User reviews; not medical advice |
| `update_calendar_event` | Add/change a session reminder | Confirm before external calendar write |
| `find_venues` | Search nearby venues by sport/facility | Location permission; identify source and stale data |
| `analyze_meal_photo` | Suggest food items and portions for user confirmation | Estimate only; user edits before nutrition calculation |
| `lookup_food_nutrients` | Retrieve nutrients for confirmed food items | Cite database/source; country coverage caveat |
| `award_xp` | Apply published XP rules after validated events | Server-side rules; idempotency and abuse checks |
| `get_pet_inventory` / `purchase_cosmetic` | Show owned items / initiate store purchase | Never spend XP or money without confirmation |

## 7. Healthy food and wellness

- Offer balanced meal ideas and vegetarian filters from the start.
- Use USDA FoodData Central as one structured nutrient source for MVP prototypes, while recognizing its branded-food and regional coverage limits; add regional databases as launch markets require.
- Photo recognition proposes foods and portions; the user confirms before saving nutrition data.
- Do not diagnose, prescribe, or imply that a sponsored product is medically recommended.
- Doctors, clinics, coaches, venues, food, and gear can have sponsored listings, but sponsorship labels and ranking rules must be visible.

## 8. Gamification and XP economy

### XP sources

- Completing a logged session
- Showing up consistently over a chosen period
- Beating a personal best or achieving a self-selected goal
- Completing a training-plan session or recovery habit
- Participating in a friend/team challenge
- Learning and practice milestones for chess/esports

### Rewards

Earned XP unlocks pet skins, outfits, colors, homes, toys, emotes, activity-card themes, profile frames, and seasonal collections. Do not sell competitive advantage or lock essential tracking behind cosmetics. Cosmetic paid bundles can complement, but not replace, earnable rewards. Rest days should not destroy streaks or pet progress.

Create sport-specific leaderboards and friend comparisons only where records are meaningfully comparable. Offer private-by-default activity/location controls and hide precise route endpoints.

## 9. Monetization: subscription first

### Free plan

- Activity logging and core sport scorecards
- Basic personal records and activity history
- Friend sharing and a limited set of community challenges
- Core pet growth and a starter set of earnable cosmetics
- Health Connect connection and basic imported activity view

### RallyPaws Plus (subscription)

- AI chat coach and adaptive multi-sport schedules
- Deeper trends, personal insights, and goal tracking
- Advanced planning, reminders, and schedule templates
- Expanded challenge creation and team tools
- Detailed activity history and exports
- More pet customization and seasonal quest lines
- Advanced nutrition logging and personalized meal planning

Keep users’ basic records and their earned items accessible even if they cancel. Use a free trial only if onboarding demonstrates paid value before asking for payment. Test monthly and annual packages with clear terms, renewal, cancellation, and restore-purchase flows.

### Additional revenue (in priority order)

1. **Subscription (primary):** recurring AI coach, planning, insights, and premium community utilities.
2. **Sponsored placements:** clearly labeled healthy food, venues, classes, equipment, coaches, and wellness services; never sell health data for ad targeting.
3. **Affiliate commerce:** optional gear/food links with disclosed commissions.
4. **Bookings and marketplace:** venue, class, coach, and event referrals or transaction fees.
5. **Cosmetic purchases:** optional pet/profile cosmetics that do not influence scoring.
6. **Teams and organizations:** paid programs for clubs, schools, employers, and leagues, with careful controls on employee health data.

Do not “monetize everything” by interrupting workout flows or exploiting health anxieties. Trust is a product asset and a subscription retention driver.

## 10. RevenueCat implementation plan

Use RevenueCat to simplify Google Play subscription purchase state and entitlement checks. Suggested first configuration:

- Entitlement: `plus`
- Products: `rallypaws_plus_monthly`, `rallypaws_plus_annual` (Google Play products; localize pricing in Play)
- Offering: `default`
- Packages: monthly and annual
- Paywall: describe tangible Plus outcomes and show localized price, billing period, renewal/cancel terms, restore purchases, and privacy links.
- Gate Plus features by the `plus` entitlement, not by hard-coded product IDs.
- Start in RevenueCat Test Store/sandbox, then test Play license testers and real purchase/restore/cancellation scenarios before launch.
- Use RevenueCat analytics and experiments to measure trial/paywall conversion and retention; do not optimize on clicks alone.

RevenueCat is subscription infrastructure, not an investor, accelerator, or source of startup funding. If “pitch in RevenueCat” means preparing a pitch *for* RevenueCat, the public docs support product integration, not a pitch-submission program. The pitch below is therefore an investor/partner-ready startup narrative, with RevenueCat as the planned billing infrastructure.

## 11. Startup pitch

### Short pitch

**RallyPaws turns sport and play into a daily progress game.** People can track hundreds of activities—from golf and running to chess and esports—celebrate their own improvement, share results with friends, and grow a customizable pet with earned XP. Android Health Connect brings in activity and calorie records from compatible apps and watches; when no device record exists, transparent activity-based estimates fill the gap. A paid AI coach for planning and insights is the core business, with clearly labeled partner commerce and bookings as secondary revenue.

### Investor narrative

- **Problem:** Activity tracking is fragmented across sports, devices, scorecards, and social groups; many users need motivation that is not based only on elite performance.
- **Solution:** One social progress layer with sport-specific records, personal-best recognition, optional wearable sync, and a pet that makes consistency tangible.
- **Why now:** Android health-data interoperability and consumer AI make it practical to combine activity history with conversational planning, subject to user permission and platform rules.
- **Wedge:** Android-first, with a focused set of high-demand physical sports and mind/esports templates. Expand the catalog through configurable schemas rather than 600 bespoke integrations.
- **Business model:** Subscription first; partner listings, bookings, affiliates, cosmetics, and team programs expand revenue later.
- **Moat to build:** Cross-sport personal history, social graph, fair progression rules, trustworthy data provenance, and a beloved pet identity. These are hypotheses to validate, not established advantages.
- **Key metrics:** Activation (first logged activity), week-4 retention, sessions logged per active user, friend interactions, Plus conversion, paid retention/churn, wearable sync success, estimate correction rate, and safety/privacy complaints.
- **Validation milestones:** Prototype activity-to-pet loop; test Android Health Connect reads across devices; measure no-watch estimate comprehension; run a paid-plan demand test; launch pilot communities; then broaden sports and commerce.

### Risks and responses

| Risk | Response |
|---|---|
| 600-sport promise creates shallow support | Broad catalog with deep templates only for top activities; use flexible logs for the rest |
| Wearable records vary by vendor | Health Connect normalization, source labels, sync diagnostics, manual correction |
| Calorie estimates appear medical/precise | Range, provenance, uncertainty, user controls, no false precision |
| Gamification encourages overtraining | Reward personal consistency and recovery; avoid XP tied to excess volume |
| Ads undermine health trust | Clear labels, sponsored-content separation, no sale of sensitive health data |
| Social tracking exposes location | Private defaults, explicit sharing, route endpoint masking, delete/export controls |
| Health and nutrition policy complexity | Privacy-by-design, policy review before release, clear non-diagnostic scope |

## 12. Android MVP roadmap

### Phase 0 — Validate

- Interview recreational athletes, sport-club members, chess players, and esports players.
- Prototype session card → personal milestone → XP → pet reward.
- Test which sport scorecards are genuinely useful and what users would pay to plan/understand progress.

### Phase 1 — MVP

- Android onboarding, profiles, friends, activity feed, and chat-first Today home
- AI recommendations with explanations and quick actions; chat-to-activity draft and confirmation flow
- 8–12 deep templates plus flexible activity logging
- Phone-based GPS run/walk/cycle tracking where appropriate
- Health Connect consent and import for supported activity, active calories, steps, and distance
- No-watch MET estimator using Compendium mappings and transparent ranges
- Personal records, XP ledger, pet growth, earnable cosmetics
- Basic Plus subscription through Google Play and RevenueCat
- Data export/delete, privacy settings, and clear source/estimate labels

### Phase 2 — Retention

- AI schedule chat and adaptive goals
- Team and friend challenges
- Chess/esports achievements and optional integrations where permitted
- Food photo logging with confirmation and vegetarian suggestions
- RevenueCat paywall experiments and subscription analytics

### Phase 3 — Expansion

- Broader 600+ activity taxonomy and localization
- Venue discovery, classes, coaches, bookings
- Sponsorships and affiliate offers with strict labeling
- iOS and additional wearable/platform integrations after Android validation

## 13. Data source register

| Data need | Starting source | Use and limits |
|---|---|---|
| Android watch/app exercise, active calories, steps, distance | [Android Health Connect data types](https://developer.android.com/health-and-fitness/health-connect/data-types) and [aggregate data](https://developer.android.com/health-and-fitness/health-connect/aggregate-data) | Permissioned Android interoperability; depends on connected apps/devices and user sync |
| Android workout session details | [Health Connect workout experiences](https://developer.android.com/health-and-fitness/health-connect/experiences/workouts) | Session record model; route/location is especially sensitive and should be optional |
| No-watch activity calories, including sports and occupational activities | [2024 Adult Compendium PDF](https://pacompendium.com/wp-content/uploads/2024/03/1_2024-adult-compendium_1_2024.pdf) and [Compendium website](https://pacompendium.com/) | MET-based population estimates; match activity/intensity carefully; not individual measurement |
| Food nutrients | [USDA FoodData Central API guide](https://fdc.nal.usda.gov/api-guide/) | Searchable structured food data; supplement for regional coverage and keep photo quantities user-confirmed |
| Venues / facilities | [OpenStreetMap](https://www.openstreetmap.org/) and [Overpass API documentation](https://dev.overpass-api.de/overpass-doc/en/) | Community-mapped coverage varies; comply with ODbL, attribution, caching, and service usage rules |
| Subscription access | [RevenueCat entitlements](https://www.revenuecat.com/docs/getting-started/entitlements), [products and offerings](https://www.revenuecat.com/docs/projects/configuring-products) | Entitlement-based feature access and configurable offerings; store pricing/availability still matters |
| Health-data app publishing requirements | [Google Play Health Connect publishing guide](https://developer.android.com/health-and-fitness/health-connect/publish) and [Google Play permissions/policy](https://support.google.com/googleplay/android-developer/answer/16558241) | Review current policies, declarations, privacy disclosures, and permitted use before launch |

**Catalog note:** There is no single dependable public source for all 600 sports, esports, activity aliases, rules, and scoring schemas. Maintain a curated internal catalog with source attribution and user-submitted extensions; use public references as seed material, not as an assumed complete API.

## 14. Decisions to validate before build

- Initial launch country and languages (affects food data, venues, pricing, and sport popularity)
- Exact MVP sports based on target-user interviews
- Whether route maps and public activity feed are enabled at launch
- Subscription price and trial strategy through willingness-to-pay tests
- Health Connect record access scope and retention policy
- Brand name and pet character direction

---

*This is a product and startup planning document, not medical advice or a revenue forecast. Validate calorie estimates, data rights, platform policies, pricing, and market demand before launch.*

## 15. Detailed product requirements and acceptance criteria

### Onboarding and chat-first Today
- Open new sessions to a coach conversation with recommendations already visible.
- Collect preferences progressively; make optional profile fields skippable.
- Give a “why this recommendation?” explanation, dismiss, refresh, and alternate action.
- Chat supports text first; voice/photo inputs are later additions.
- Acceptance: a new user can ask for a short activity suggestion, change it, and start/log the selected activity without navigating away from Coach.

### Activity actions and live tracking
- Natural-language activity mention creates a draft form with extracted sport, duration, time and score when present.
- Draft must remain editable and unsaved until the user taps confirm.
- Starting GPS or live tracking opens a visible native in-app session, requests Android permissions in context, and shows active/paused/stopped state.
- Acceptance: saying “I played tennis for an hour” yields a tennis draft; no session is saved until confirmation. AI must not claim GPS tracking started unless the app reports a successful start.

### Data provenance and calories
- Each value is explicitly typed as measured/imported, user-entered, sensor-derived, or estimated.
- Store the source identifier, timestamp, units, method/version, inputs, uncertainty, and deduplication key.
- Display gross and active energy as different measures; do not add resting energy twice.
- If an estimate lacks a suitable activity mapping or profile input, provide a range or omit the number instead of inventing precision.
- Acceptance: users can see and correct the source and inputs behind an energy value.

### AI and tool execution
- Model can request only registered tools with validated JSON schema and user-scoped authorization.
- Backend rechecks permissions and ownership for every call. Treat model arguments and MCP results as untrusted.
- Write tools return drafts; confirmation token and action summary are required before persistence.
- Make calls idempotent where retries could duplicate an activity or XP.
- Keep API keys server-side. Limit context sent to the model to fields needed for the current request.
- Acceptance: unauthorized, malformed, stale, or out-of-range tool requests fail safely and leave user data unchanged.

### Social and safety
- Sharing, friend discovery, location and leaderboards are opt-in.
- Provide audience preview, block/report/mute, route endpoint masking, and deletion controls.
- XP rewards participation and suitable personal milestones; cap abuse and do not reward extreme volume.
- Acceptance: users can use the app privately, disable competition, and delete a share.

### Subscription and commerce
- Coach basics and core manual logging are available without a subscription; paid features emphasize deeper personalization and insights.
- Restore purchases, clear price/period/renewal terms, cancellation path and active entitlement state.
- Show sponsored status on food, doctor, coach, equipment, and venue placements. Sponsor ranking does not override safety or user filters.
- Acceptance: subscription cancellation does not erase historical activities or earned items.

## 16. Meta Muse Spark implementation plan

Use Meta Model API with Muse Spark for conversational intent, typed tool selection, image understanding where enabled, and structured recommendation cards. Follow the current official API documentation; model IDs, access and limits may change.

1. Chat request goes from Flutter to an authenticated Rally backend. Do not call Meta with a long-lived secret from the app.
2. Backend sends only relevant profile/context and registered tool schemas.
3. Muse Spark returns either a reply or a tool request.
4. Backend validates schema, user scope, permissions, rate limit and safety policy.
5. Deterministic service runs calculations/search or creates a draft.
6. Tool result is returned to Muse Spark for a natural-language explanation.
7. Flutter renders a typed result card and confirmation affordance. User confirmation is required for writes.
8. Record tool success/failure, latency, model ID, consent and confirmation state without retaining unnecessary sensitive message content.

MVP tools: prepare_activity_log, estimate_activity_energy, get_activity_summary, get_personal_records, build_training_schedule, find_venues. Add analyze_meal_photo and lookup_food_nutrients after a nutrition provider and correction UX are ready. Add per-user MCP connectors after a security and consent review; never share one user's connector credentials with another user.

## 17. Data and market validation

Do not invent TAM/SAM/SOM, traction, CAC, LTV, retention or subscription pricing in a pitch. Before an investor version claims market size:
- Choose launch country, primary user and initial activity wedge.
- Collect current category/revenue/usage sources for that geography.
- Interview users and quantify how they currently track activities and what they would pay for.
- Run a prototype test and report sample size, recruitment method and observed behavior.
- Run a pricing or paid concierge experiment; separate stated interest from purchase behavior.
- Record source, date, method and uncertainty for every external market claim.

## 18. Architecture and service boundaries

- Flutter Android client owns navigation, permissions, activity UI, local draft state, offline status and confirmation.
- Backend owns identity, storage, model calls, tool authorization, deterministic calculations, XP ledger, catalog and subscription webhook processing.
- Meta Model API adapter is replaceable behind an internal interface.
- Health Connect adapter normalizes permissioned sources while preserving origin.
- MCP connector registry stores per-user references/scopes securely and supports revoke/audit; external tools are disabled by default.
- Nutrition and venue providers are adapters with attribution, freshness and market coverage checks.
- RevenueCat is a billing integration; core feature authorization reads a provider-neutral entitlement model.
- Avoid writing health or activity data directly from an LLM response.

## 19. Release acceptance checklist

- Chat and recommendations are the first-run landing experience.
- At least one end-to-end physical sport demo and a cognitive activity example work.
- User can enter without a watch and understand an estimated value.
- User can connect/deny/revoke Health Connect permission without losing core utility.
- Duplicate records and data source labels are handled.
- AI tools are registered, scoped, validated, observable and confirmation-gated for writes.
- Activity, calorie, nutrition and sponsored claims are appropriately labeled.
- Account export/deletion, privacy disclosures, billing terms and accessibility have been reviewed for the launch market.
- The demo/pitch labels roadmap and hypotheses clearly; it does not imply 600 detailed sports, adoption, partnerships or revenue are already delivered.

## 20. Updated source register for AI and app implementation

- [Meta Model API overview](https://dev.meta.ai/docs/overview) — API base, authentication and current model capability.
- [Muse Spark tool/function calling](https://dev.meta.ai/docs/cookbook/tool-function-calling) — request/execute/return tool loop.
- [Muse Spark structured output](https://dev.meta.ai/docs/cookbook/structured-output) — schema-shaped recommendation responses.
- [Flutter MIT workout tracker reference](https://github.com/brandonp2412/Flex) — possible UI/data-flow reference; current baseline is original starter code, not a fork.
- [Flutter Health Connect bridge candidate](https://github.com/marcos-abreu/connect_kit) — candidate integration to evaluate for maintenance, permissions and license before adoption.

---

*This PRD includes the product discussion to date. Product claims, launch scope, market size, pricing, data rights and compliance still require validation. It is not medical advice or a revenue forecast.*

## 21. Social discovery and shareable activity stories

The community layer should combine the utility of a sport tracker with the visual, lightweight sharing behavior people enjoy in lifestyle communities. Support photo/video activity posts, short captions, sport tags, personal milestones, friend reactions, and share cards that can be exported to other social platforms. This is product inspiration, not a claim of partnership or permission to reuse another platform's brand, interface, or content. Keep activity posts private or friends-only by default, let users choose audience and location detail, and moderate public discovery before enabling it broadly. Participation should not require posting.

## 22. Match records, matchups and shareable links

Rally supports both a planned matchup and a completed result. A match is a structured activity session with a sport-specific scorecard, participants/teams, venue (optional), start time, format and status.

### Match lifecycle
1. User creates a matchup: choose sport, singles/doubles/team format, participants, optional time/venue and scoring format.
2. Rally creates an invite link. Friends open it to view the invitation and join/respond; joining requires an account or a lightweight web guest flow selected for the launch design.
3. Participants record the result using the sport's score template. A captain or both sides may submit; disputed results remain pending review.
4. Rally displays a result card with the recorded score, outcome, personal progress and optional rating change.
5. User selects recipients and shares a private link or exports a visual card. Public discovery is a separate opt-in.

### Score and rating rules
- **Tennis:** sets/games, singles/doubles, result, optional opponent and personal match history.
- **Volleyball:** sets and points, teams, player participation and result.
- **Esports:** title, game mode, teams/players, map or round scores, result, rank/rating if self-entered or from an authorized provider.
- **Chess:** time control, result, opponent, rating and source; distinguish self-entered from linked/verified rating.
- **Golf and other sports:** use the relevant scorecard and unit conventions.
- Keep rankings/rating formulas documented and versioned. Do not label self-entered scores or rating changes as verified.

### Share URL requirements
- Create an unguessable opaque token, not a sequential user or match ID.
- Support invite URLs before a match and result URLs after completion. Expiration, audience, revoke and regenerate controls are required.
- Default to invite-only or friends-only access. The owner chooses what fields appear; hide contact details, exact home/work locations, private notes and health/calorie data by default.
- Use Android share sheet to send the URL. Deep link into the app when installed and provide a safe web preview/fallback when not installed, subject to launch scope.
- Allow participants to request correction/report a disputed result. Keep audit history for edits and show when a score is self-reported.
- Never expose a participant's full profile or activity history just because they opened a match link.

### Acceptance criteria
- A user can create and share a tennis, volleyball or esports matchup with the right score fields.
- A recipient can open the invite, understand sport/time/format and respond without seeing unrelated private data.
- Completed result produces a shareable summary with permission controls and distinct self-reported/verified labels.
- Owner can revoke the link; a revoked/expired link no longer reveals match details.

## 23. AI-generated calorie estimates and AI-derived catalog data

Product direction from the founder: use AI to generate calorie estimates and to help create broad activity metadata. The product must label these values as AI-generated estimates rather than measurements or verified facts.

- AI may interpret a user-described activity, effort, duration, workout details, or permitted photo/video context and return an estimated energy value plus the assumptions it used.
- When available, ground the prompt with source-backed activity reference data, health-device records, and user-confirmed inputs. AI-generated catalog entries and calorie metadata remain drafts until reviewed for launch use.
- Keep a deterministic/reference calculation as a comparison, quality-control signal and fallback; the user-facing estimate may come from the AI path when enabled.
- Store model/provider/version, context fields used, estimate timestamp, reference dataset/version when used, confidence band, and user correction. Never label model confidence as clinical certainty.
- Do not invent a precise answer when required data is missing. Ask a follow-up, return a range, or say the estimate is unavailable.
- Device-measured active energy takes precedence when valid and consented; display AI estimates separately so users can compare rather than silently overwrite measurements.
- For office movement, estimate only a described/observed activity (for example walking break or standing task); do not infer extra active energy from “at work” alone.
- Chess and esports can use AI to create practice, session and progress metadata, but not exercise-calorie claims by default.

## 24. Calendar connection and activity capture

Calendar is both a planning surface and a possible source of activity drafts. Rally may read the user's selected calendar events, suggest that a past/future event represents a match or workout, and turn it into a sport-specific activity record after review.

### Calendar tools
- `read_calendar_events(date_range, calendars_selected)` — read only calendars the user selected; return title, start/end, optional location and event reference. Do not send unrelated event descriptions to the model.
- `draft_activity_from_calendar(event_reference, sport_candidate, score_fields)` — prepare an editable record from a selected calendar event. The event title/time are clues, not proof the activity happened.
- `create_calendar_event(title, start, end, location, attendees)` — schedule an activity or match only after confirmation; attendee invitations are a separate confirmation.
- `update_calendar_event(event_reference, changes)` and `delete_calendar_event(event_reference)` — confirm the exact change before execution.
- `sync_calendar_activity(activity_id, event_reference)` — link an already confirmed activity to its calendar event and prevent duplicate imports.

### User flow and requirements
1. User explicitly connects a calendar or selects a local Android calendar, then chooses which calendars and permissions to grant.
2. Chat can ask “What sport is on my calendar this weekend?” or “Did I play volleyball yesterday?”
3. Rally returns matching events with dates and calendar source. An event is never automatically treated as a completed workout.
4. If the user asks to log it, Rally prepares a draft with sport, duration, time, opponent/participants and any score the user supplies. Missing results remain blank.
5. User reviews and confirms the activity record. If the event is upcoming, Rally can instead offer to set a reminder or start a match invite.
6. If a calendar write is requested, show title/time/calendar/attendees and confirm before adding or changing it.

Use the least-permission Android calendar access or an approved calendar provider flow appropriate to the target device. Explain read versus write permission separately. Store provider IDs securely, support disconnect/revoke, and do not infer health details from unrelated calendar entries. Calendar access is optional; manual logging remains available.

### Acceptance criteria
- User can select a calendar and ask Rally to find an activity or matchup in a chosen date range.
- Only selected event fields are shown to the AI and user; unrelated events are excluded.
- A past event yields a draft only, and no calories/score/activity are asserted without user input or an authorized source.
- The user confirms before a calendar entry becomes a saved activity or any calendar write occurs.
- Duplicate calendar, Health Connect and manual records can be linked/merged without double-counting.
- User can disconnect calendar access and revoke/share links independently.

Calendar provider integration, OAuth/Android permissions, deep links and conflict handling are MVP or post-hackathon implementation work; the current demo starter does not yet read the device calendar.

