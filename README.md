# Meeting Room Booking

A booking interface for a single meeting room over a 09:00–18:00 working day.

- **Demo:** _link to be added after deploy_
- **Stack:** Nuxt 4 · Vue 3 · TypeScript (strict) · Nuxt UI 4 · TanStack Query · Valibot · `@internationalized/date` · Vitest

## Getting started

```bash
pnpm install
pnpm dev
```

The app starts on `http://localhost:3000`. Requires Node ≥ 22 and pnpm ≥ 10.

```bash
pnpm test        # 193 tests: domain, schemas, API handlers, utils, components
pnpm typecheck   # vue-tsc, strict — covers tests too
pnpm lint        # eslint --fix
pnpm build       # production build
```

Environment variables live in `.env.example`. There is exactly one setting:
`MOCK_LATENCY_MS` (artificial mock API delay, 250 ms by default so loading
states stay visible; `0` disables it).

## What is implemented

Every point of the brief is covered: picking a date, viewing, creating,
editing and deleting bookings, all eight business rules, and handling of
server-side conflicts.

### Architecture

```
shared/          code shared by client and server (the #shared alias)
  domain/        business rules, time handling, "now"
  schemas/       valibot schemas for parsing input
  types/         Booking, API error body
server/
  api/bookings/  GET · POST · PATCH · DELETE
  utils/         in-memory store, errors, artificial latency
app/
  api/           BookingsApi — the only place that knows about HTTP
  composables/   useBookings (TanStack Query), useNowContext
  components/    day timeline, form, day view
  utils/         timeline layout, time options, request payload, formatting
tests/
  unit/          pure functions (node environment)
  server/        API handlers through a real h3 router
  nuxt/          components (nuxt environment)
```

Three decisions everything else rests on:

**1. Business rules live in one place.** `shared/domain/booking-rules.ts`
exports a pure `validateBooking(draft, { bookings, now, ignoreId, originalStart })`
that returns a list of violations. Both the form (before submitting) and every
API handler (as the final authority) call it. The rules are not duplicated, so
client and server cannot drift apart in how they read them.

**2. Time is whole minutes since midnight.** `HH:mm` strings live only at the
boundaries: user input and the HTTP contract. Inside the domain `'09:30'` is
`570`, and every rule reduces to comparing numbers. Time zones and day
rollovers disappear from the business logic entirely.

**3. The room has one business time zone** (`Asia/Bishkek`). The "no booking in
the past" rule is checked on both sides; deriving it from each process's local
time would make "today" a different date on the host (UTC) and for the user
(UTC+6). Both sides convert the current moment through `nowContext()`.

### On the date library

Because of decision #2, calendar logic occupies only three places: date
validity, shifting by a day, and converting a moment into the business time
zone. Everything else — overlaps, durations, the slot grid, comparisons — is
integer arithmetic that no library can improve.

For those three places the choice is **`@internationalized/date`** rather than
dayjs or date-fns:

- it is already in the dependency tree as a dependency of Nuxt UI itself, so
  this is not a new vendor in the project but the same date library the UI kit
  runs on;
- `parseDate` is strict — it rejects `2026-02-31` and `2026-1-1` on its own, so
  no hand-written existence check is needed;
- there are no global side-effect plugins (`dayjs.extend`) to initialise before
  first use on both the client and the server;
- if the native `input[type=date]` is ever replaced with `UCalendar`, it takes
  exactly these types, so no conversion layer appears.

Cost: **4.3 kB gzip** after tree-shaking (measured with esbuild on the
functions actually used). Gain: 40 lines fewer and, more importantly, a
`clock.ts` that is obvious instead of assembling a date by hand out of
`Intl.DateTimeFormat.formatToParts`.

### Business rules

| Rule from the brief                    | Checked in          | Behaviour                              |
| -------------------------------------- | ------------------- | -------------------------------------- |
| 1. Within 09:00–18:00                  | domain              | 422 `OUTSIDE_WORK_DAY`                 |
| 2. `start < end`                       | domain              | 422 `START_NOT_BEFORE_END`             |
| 3. At least 30 minutes                 | domain              | 422 `TOO_SHORT`                        |
| 4. At most 2 hours                     | domain              | 422 `TOO_LONG`                         |
| 5. No overlaps                         | domain              | 409 `OVERLAP`                          |
| 5a. Touching boundaries is fine        | domain              | 10:00–11:00 and 11:00–12:00 both valid |
| 6. No booking in the past              | domain              | 422 `PAST_DATE` / `PAST_TIME`          |
| 7. A booking never clashes with itself | domain (`ignoreId`) | PATCH to the same interval succeeds    |
| 8. Server-side conflict                | handlers + UI       | see below                              |
| 15-minute step                         | domain              | 422 `UNALIGNED_TIME`                   |

The error priority is deliberate: input errors come first (422), and a clash
with someone else's booking (409) is reported only if the draft is valid on its
own. Otherwise a request for "14:00–14:15 in a taken slot" would answer "slot
taken" instead of the real reason — the booking is too short.

### Handling the 409 conflict

Rule 8 is reproducible by hand, with two browser tabs and no special mode:

1. Open the app in two tabs, both on the same date.
2. In tab B, book a free slot.
3. Switch to tab A — **do not reload** — and book the same slot.
4. Tab A still believes the slot is free, so the request goes out and the
   server answers 409.

This works because `refetchOnWindowFocus` is deliberately turned **off** in
`app/plugins/vue-query.ts`. With it on, returning to tab A would quietly
refetch and repair the stale list, and the conflict could never be observed by
hand. Switching it off keeps tab A genuinely stale, which is exactly the
situation the rule describes.

What the UI does on a 409:

- the modal **stays open** and the typed data survives;
- an alert states exactly which booking the request clashes with;
- the "Start" field is marked with an error;
- the booking list is refetched — the booking from tab B is immediately
  visible both in the timeline and in the time dropdowns, where the slot
  becomes unavailable.

No conflict simulation is built into the app: the brief does not ask for one,
and a real stale tab demonstrates the same path more honestly than a synthetic
switch would.

### Interface states

Loading (skeleton), an empty day, a load error with a "Retry" button, form
submission (button and grid locked), delete confirmation, success toasts.
A past date, a finished working day and the "no free time left after this
start" case are all handled separately. Deleting a booking that is already gone
(404) is treated as success: the user's goal has been achieved.

A native `input[type=date]` reports an empty string while the date is only
partly typed, and keeps it if the field is cleared. So the raw input is stored
separately from the date the screen is built on: the day only switches on a
valid value, and an empty field neither breaks formatting nor loses the day
currently shown.

### Accessibility and responsiveness

- The timeline is a list of `<li>` items in chronological order, so keyboard
  traversal runs top to bottom with no manual `tabindex`.
- Every free slot is a real `<button>` with a meaningful `aria-label`
  ("Book from 14:15", "09:15 — time has passed", "17:45 — slot too short");
  unavailable slots are `disabled`.
- Booking actions are buttons whose `aria-label` includes the booking time.
- Modals, focus trapping and aria wiring come from Nuxt UI (Reka UI).
- Layout verified at 375 px and on desktop.

The form never offers something that cannot work: past and taken slots are
disabled, and the list of end times is capped by the maximum duration, the end
of the working day and the start of the next booking. This does not replace
validation — the domain and the server still re-check everything.

## About the backend

There is no real backend, exactly as the brief allows. There is a **mock API on
Nitro** (Nuxt's server side) with an in-memory store — that is, real HTTP, real
status codes and real server-side validation, but no database.

```
GET    /api/bookings?date=YYYY-MM-DD   → Booking[]
POST   /api/bookings                   → Booking (201)
PATCH  /api/bookings/:id               → Booking
DELETE /api/bookings/:id               → 204
POST   /api/dev/reset                  → reset to seed data (demo and e2e)
```

The error body is identical across all handlers:

```ts
{ code: 'OVERLAP' | 'TOO_SHORT' | 'NOT_FOUND' | …, message: string,
  violations?: Violation[], fields?: Record<string, string[]> }
```

MSW was deliberately not used: a service worker runs the "server" inside the
browser, which turns the story about a conflict arriving from the server into a
staged one. With Nitro it is a genuine network request with a genuine 409,
visible in DevTools.

**The network layer is separated from the UI.** Components know nothing about
`$fetch` — they work with the `BookingsApi` interface
(`app/api/bookingsApi.ts`). Moving to a real backend means another
implementation of the same interface (or another `fetcher` passed to the
`createHttpBookingsApi` factory); components do not change.

State lives in the process memory and resets to the seed data on restart. On
serverless hosting (Vercel) that means a cold start after an idle period
returns the seed — expected behaviour for a mock API.

## Decisions on ambiguous points

Clarified with the client:

- **There is one room.** The contract has no `roomId`, so the model was not
  complicated for it.
- **The grid step is 15 minutes**, with a 30-minute minimum duration.
- **A booking that already started can be edited and deleted.** Implemented as:
  editing is allowed while the start time does not move (`originalStart`);
  moving the start into the past, or pushing the whole booking into the past,
  is not. Deleting is not restricted by past time at all — removing a meeting
  that already happened is a valid action.
- **A booking without a title** is shown as "Untitled"; an empty string is
  normalised into an absent field rather than stored as `''`.

Decided independently:

- The display format is a **day timeline**: it visualises overlaps, occupancy
  and unavailable slots by itself, which makes the business logic visible.
- Date selection uses a native `<input type="date">`: keyboard accessible,
  familiar, and it avoids pulling in a calendar dependency for a single field.
- Status codes: 409 only for an overlap, 422 for other violations, 404 for a
  booking that does not exist.

## What I would do next

In descending order of value:

1. **Playwright browser e2e** on top of `/api/dev/reset`: the two-tab conflict
   scenario in particular is verified by hand today. The API handlers already
   have integration coverage (`tests/server`), so what is missing is the
   browser layer, not the server one.
2. **Optimistic updates** in the TanStack Query mutations — the UI currently
   waits for the server. With rollback on error this would make it feel
   noticeably faster.
3. **Drag-to-select an interval** on the timeline instead of clicking a slot.
4. **A week view** and multiple rooms — the model is deliberately single-room
   for now, but the domain layer is ready for it (adding `roomId` to the
   overlap filter is enough).
5. **i18n**: interface strings are currently inlined in the code.

## Time spent

Roughly 5 hours: domain layer with tests and the mock API ≈ 2 h, the interface
≈ 2 h, browser verification, types, lint and this README ≈ 1 h.

## Deploy

Nitro detects Vercel automatically — no extra configuration is needed: connect
the repository, build command `pnpm build`.
