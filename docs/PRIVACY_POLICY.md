# Rally privacy policy (DRAFT)

> **Draft for legal review.** It describes what the code in this repository does today. Replace the `[bracketed]` placeholders, have it reviewed for your launch market (health-related data, minors, GDPR/CCPA as applicable), host it at a public HTTPS URL and pass that URL to the build as `PRIVACY_URL`. Update it whenever data handling changes (for example when Health Connect is added).

Last updated: [date]. Operator: [company/person], contact: [privacy email].

## What Rally does
Rally is a sport and activity coach. You chat with an AI coach, log activities, and get estimates and suggested schedules. Calorie values are **estimates, not measurements**, and Rally does not give medical advice. Rally has no accounts. An optional Plus subscription unlocks extra pet looks and seasonal quests; core tracking stays free.

## Data we handle
| Data | Where it lives | Why |
|---|---|---|
| Preferences (interests, session length, low-impact, vegetarian) and optional body weight | On your phone. Weight is also sent with chat messages so estimates can be scaled. | Personalise suggestions and estimates |
| Activity history, XP, pet, quests, matches, bookings | On your phone. The server keeps no activity data. | Show progress on this device |
| Chat messages and any photo or calendar details you attach | Sent to Rally's server and forwarded to the configured model provider to generate a reply. Rally's logs do not record message text. | Produce coach replies |
| Match invite links you share | The invite details ride inside the link itself; anyone with the link can view them until the link expires. Rally's server never sees them. | Let friends open your invite |
| Workout GPS points (only if you enable GPS in the timer) | On your phone; only distance is used to prefill the draft. | Show live pace and distance |
| Random app-user id | On your phone; sent to Rally's server only to check your Plus entitlement. | Verify Plus without an account |
| Technical data | IP address is used for abuse rate limiting in memory and may appear in hosting-provider logs | Keep the service available |

Rally does **not** sell data or use health data for advertising. If you choose to attach a photo or selected calendar details to a coach message, that content is sent with the request for processing by Rally and its configured model provider. Rally does not connect to Health Connect or read contacts in this version. Rally never sees payment card data: purchases are handled by the store and RevenueCat.

## Third parties
- **Model provider:** the provider configured for this Rally deployment (Meta Muse Spark) processes chat content and any attached image to answer you. Its own terms and retention rules apply: [link to the provider's terms].
- **RevenueCat:** when Plus billing is configured, RevenueCat processes the random app-user id and purchase/entitlement state to verify your subscription. Its own terms and retention rules apply: [link to RevenueCat's terms]. In demo mode no billing calls are made.
- **Hosting:** [Render / your cloud] runs the server.

## Your choices
- **No account needed.** Preferences and activity history remain in browser storage. Coach requests are sent to Rally's server and the configured model provider; activity data is not synced anywhere.
- **Plus:** demo Plus can be cancelled on the welcome screen; a real subscription is managed in your store settings. Cancelling never deletes history or earned items.
- **Delete local data:** You tab, "Delete my local data".

## Retention
Local data stays until you delete it or uninstall. [State retention for hosting logs and backups.]

## Security
Traffic uses HTTPS. Use Rally only on a device and browser you trust. Confirmation of saved activities is checked by the server. No system is perfectly secure.

## Children
Rally is not directed at children under [13/16]. [Adjust for your market.]

## Changes and contact
We will update this page when practices change. Questions: [privacy email].
