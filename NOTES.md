# Phase 1 — Make it run

**How I found them:** traced each user flow end to end (join → see dots →
request/accept → chat → video → hang up → close tab) through client, API and
DB, then confirmed with two headless Chrome sessions with mocked geolocation.

## Bugs fixed

1. **Ghost dots never disappeared** (the reported bug) — `app/api/poll/route.ts`
   - **Cause:** the heartbeat was `updateMany({ where: {} })`, so *every* poll
     refreshed `lastSeen` for *every* user. While any tab was open, nobody went
     stale, and closed tabs stayed on the map.
   - **Fix:** heartbeat only the caller: `where: { id }`. The existing 15 s
     `STALE_MS` reaper now removes dead dots.

2. **Chat messages never arrived** — `lib/webrtc.ts`
   - **Cause:** the sender sent `{ t: "msg" }`, but the receiver only accepts
     `{ t: "chat" }`.
   - **Fix:** send `{ t: "chat" }`.

3. **Users stuck "busy" after hanging up** — `app/api/signal/route.ts`
   - **Cause:** `accept` marks both users busy, but only `decline` cleared it.
     Hang up, cancel and request timeout all send `end`, which did nothing on
     the server. After one chat both users were unreachable forever (every new
     request was auto-declined).
   - **Fix:** `end` frees both users, same as `decline`.

4. **WebRTC connections could fail to form** — `lib/webrtc.ts`
   - **Cause:** ICE candidates arriving before the offer/answer are queued, but
     the queue was flushed *before* `setRemoteDescription`. Every
     `addIceCandidate` threw (silently caught) and the candidates were lost.
     Signals are sent as parallel fetches, so ICE often beats the SDP.
   - **Fix:** flush the queue *after* `setRemoteDescription`.

5. **Chat didn't end when the partner closed the tab** — `app/page.tsx`
   - **Cause:** `/api/leave` deletes the leaver's row *and* its pending signals,
     so no `end` ever reaches the partner. The partner sat in a dead chat and
     stayed busy.
   - **Fix:** on each poll, if the current peer is no longer online, send `end`
     (frees our busy flag) and tear down. This also covers crashed tabs once they
     go stale, and pending requests.

6. **Network failure left both users busy** — `app/page.tsx`
   - **Cause:** on `connectionState === "failed"` the client tore down locally
     but never told the server.
   - **Fix:** send `end` before tearing down.

7. **Late accept stranded the accepter** — `app/page.tsx`
   - **Cause:** if A cancels (or times out) just as B accepts, A ignores the
     `accept`, but the server has already marked both busy. B was stuck on
     "Connecting…" and both stayed busy.
   - **Fix:** if an `accept` arrives when we aren't waiting for one, reply `end`.

8. **Missing Mapbox token failed silently** — `app/components/WorldMap.tsx`
   - **Cause:** `TOKEN` fell back to a hard-coded fake token, so the
     "set NEXT_PUBLIC_MAPBOX_TOKEN" hint never showed; the map just stayed blank.
   - **Fix:** removed the fallback; the hint now shows when the env var is
     missing.

## Not a bug, but worth knowing

- The map used to open zoomed in on you (zoom 4), so peers thousands of km
  away (e.g. Tokyo vs. the Philippines in DevTools Sensors) were on the map but
  off-screen. Phase 2 now starts on the whole globe and flies in to zoom 3.

## Known limits (not fixed)

- A tab hidden for 5+ minutes can be throttled to one poll per minute, gets
  reaped, and won't reappear until it's reloaded (the heartbeat only updates an
  existing row).
- STUN only, no TURN (out of scope per the README).

# Phase 2 — Make it good

**Direction:** the tagline is "a living globe of anonymous strangers," so the
globe is the hero and everything else floats over it. Dark only, one green
accent, frosted-glass panels, and motion that means something (a heartbeat
means "someone is here"). No new dependencies: Mapbox, Tailwind v4 and plain
CSS cover it.

## What changed

1. **Visual foundation** — `app/globals.css`
   - Fixed a quiet bug: `body { font-family: Arial }` overrode the Geist font
     the layout already loads.
   - Dark only: removed the unused light-mode variables. The night globe *is*
     the brand.
   - Added a `glass` utility (blur, thin border, soft shadow) shared by every
     floating surface: notices, prompts and the online counter.

2. **The globe is the first thing you see** — `WorldMap.tsx`, `EntryGate.tsx`,
   `page.tsx`
   - Globe projection with atmosphere and stars instead of a flat map.
   - The map renders from the first paint, and the entry screen sits *over* a
     slowly spinning globe instead of on a blank page. On "Enter Pulse" the
     camera flies down to you, so the first five seconds tell the whole story.
   - Starting from the whole world also makes distant peers discoverable (see
     the Phase 1 note above).
   - The spin stops as soon as the user grabs the map and is off for
     `prefers-reduced-motion`; Mapbox also skips the fly-in animation there.

3. **Dots that feel alive** — `WorldMap.tsx`, `globals.css`
   - One accent colour for everyone instead of random hues, which read as
     noise. Each dot has a heartbeat ripple with a random delay, so the globe
     shimmers instead of blinking in unison.
   - Dots pop in when someone joins, and show a "Say hi" label on hover or
     keyboard focus.
   - Busy users turn grey, stop pulsing and read "In a chat", so it's clear
     *before* clicking that they can't connect.
   - Your own position is a white "YOU" beacon instead of a 📍 emoji, so it's
     distinct from the people you can tap.
   - Accessibility: Mapbox overwrites marker elements with `role="img"` and
     "Map marker"; restored `role="button"` and real labels. Ripples are off
     under reduced motion.
   - Moved the online counter to the top-left with a live indicator; it had
     been covered by the Mapbox logo. It's hidden on the entry screen, where
     "0 online" would be misleading.

4. **Connecting feels like an event** — `ConnectionPrompt.tsx`, `Countdown.tsx`,
   `WorldMap.tsx`, `page.tsx`
   - The 30 s request timeout already existed but was invisible. It's now a
     draining ring on *both* sides, so the requester knows how long to wait
     and the recipient knows how long they have.
   - Incoming requests (and video requests) arrive as a slide-in card instead
     of a full-screen modal; the globe stays usable. Accept is focused, Esc
     declines.
   - The linked peer's dot pulses faster, a glowing line joins the two dots,
     and the camera frames both ends once. "You're talking to someone in Cebu"
     is the moment the product is about, so it gets the motion.

5. **Chat** — `ChatPanel.tsx`
   - A floating glass card on desktop and a bottom sheet on mobile, instead of
     a full-height slab, so the globe and the connection line stay in view.
   - Header with a gradient avatar and live status ("Opening a private line…" →
     "Connected · peer-to-peer").
   - Empty state with three tap-to-send icebreakers: the hardest part of talking
     to a stranger is the first message.
   - Bubbles rise in; the input auto-focuses on connect; 44 px controls.

6. **Video** — `VideoPanel.tsx`
   - On desktop the call sits beside the chat instead of covering it, so you
     can keep texting. Full screen on mobile.
   - Mute and camera-off buttons. They toggle `track.enabled`, so there's no
     renegotiation, and they're exposed with `aria-pressed`.
   - Mirrored self view, and a "Waiting for their camera…" state: over HTTP
     polling the remote video takes ~5–7 s to arrive.

7. **Mobile and accessibility** — `layout.tsx`, `globals.css`, all panels
   - `viewport-fit=cover`, dark `color-scheme` and a theme colour matching the
     globe; top- and bottom-pinned UI respects safe-area insets (notch, home
     bar).
   - Map dots get a 44 px hit area on touch screens without looking bigger.
   - Screen readers: notices are `role="status"`, chat is `role="log"` with
     `aria-live`, prompts are `alertdialog`s, icon buttons have labels.
   - All motion (spin, ripples, slide-ins) is off under
     `prefers-reduced-motion`.

**Verified:** typecheck, lint and `next build` pass. Screenshots on desktop
(1280×800) and mobile (390×844) of every state: entry, live map, hover,
requesting, incoming, connected, chat, video. Two-user headless Chrome runs of
the full flow (request → accept → chat both ways → video with fake camera →
tab close → "Stranger disconnected") pass on both viewport sizes.

## Deliberately skipped

- Animation library (e.g. framer-motion): CSS covers it, so no new dependency.
- Usernames, avatars or profiles: they contradict the anonymous premise.
- Light mode or a theme toggle, dot clustering, sounds, an onboarding tour.
- Typing indicator: needs a new data-channel message type; low value.
- Fade-out when a dot leaves: it still disappears instantly.
- Great-circle arcs: the connection line is straight in map space, and a link
  across the Pacific date line frames the long way round (marked `shortcut:`
  in `WorldMap.tsx`).

# Phase 3 — Make it secure

**Root cause:** every user's id is broadcast to everyone by `/api/poll`, and
every endpoint trusted whatever id the caller sent. The id *was* the
credential, so anyone with DevTools could act as anyone. Each issue below was
reproduced with `curl` before the fix and re-tested after.

## Issues, ranked, and what I did

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | Critical | **Impersonation.** With a victim's public id you could read and drain their mailbox (their SDP/ICE, i.e. their real IP, defeating the location offset), send signals as them, move their dot, or kick them off the map. | Fixed |
| 2 | High | **Unauthorised signals.** Any user could send `accept` to two strangers and mark them busy (do it to everyone and every request auto-declines), end anyone's call, or push WebRTC offers to people they weren't connected to. | Fixed |
| 3 | High | **No rate limits.** Request spam at one person, or flooding the Signal table with 64 KB payloads. | Fixed |
| 4 | Medium | **Loose validation.** Any payload on any signal type; signals to yourself; the client threw on malformed peer payloads. | Fixed |
| 5 | Medium | **No security headers.** No CSP, and the app could be framed (clickjacking). | Fixed |
| 6 | Medium | **Unbounded poll cost.** 5 sequential DB round trips (~1.7 s), table-wide deletes on every poll, and every online user returned. | Fixed |
| 7 | Medium | **Location averaging.** Each session gets a fresh random offset around the same true point, so many sessions average out to near the real location. | Accepted |
| 8 | Low | **Your partner learns your IP.** Inherent to peer-to-peer WebRTC. | Documented |

## Fixes

1. **Session secrets** — `lib/session.ts`, all routes, `lib/api.ts`. Each tab
   holds a random secret and its public id is `sha256(secret)`. The server
   derives the caller from the secret (Bearer header; in the body for
   join/leave, since `sendBeacon` can't set headers) and ignores any
   client-sent id. No schema change needed.
2. **Connection state on the server** — `Presence.partnerId`. `accept` and
   `decline` only answer a real pending request; `offer`/`answer`/`ice` only
   flow between connected partners; `end` only works on your own link.
3. **Rate limits** — one request per 3 s per session (`Presence.lastRequestAt`),
   checked and written atomically, and at most 100 undelivered
   `offer`/`answer`/`ice` per sender. The client stops waiting
   immediately if a request is rejected.
4. **Validation** — `offer`/`answer`/`ice` must carry a JSON object within the
   size cap; other types must carry nothing; recipient must be a valid id and
   not yourself. The client ignores malformed payloads instead of throwing.
5. **Headers** — `next.config.ts`: CSP (only Mapbox hosts, `blob:` workers),
   `frame-ancestors 'none'`, `nosniff`, `no-referrer`, a `Permissions-Policy`
   limiting camera/mic/location to this site, no `X-Powered-By`.
6. **Poll** — independent queries in parallel, cleanup on ~20% of polls
   (peers are already filtered by `lastSeen`), peer list capped at 500.

## Not fixed, and why

- **Location averaging (7):** the requirements ask for both a 1–3 km offset
  and a *different* position every session. Together, those make averaging
  possible in principle. Fixing it means relaxing one (e.g. snap to a grid
  first, which breaks the strict 1–3 km). Needs a product decision.
- **IP visible to your partner (8):** hiding it needs a TURN relay, which is
  an external service (out of scope per the README).
- **Per-IP limits / fake-dot flooding:** needs a shared store or storing IPs;
  the first is an external service, the second conflicts with "no PII".

**Verified:** `bash scripts/security-check.sh` (needs `npm run dev`) probes
every fix: forged ids → 401, stranger accept/offer/end → 403, bad payloads →
400, parallel requests → only one passes, accepting a declined request → 403,
legitimate flow → 200. Full two-user browser flow (connect, chat, video,
disconnect) passes on desktop and mobile. CSP checked in the browser with no
violations. Typecheck, lint and `next build` pass.

**Deploying:** run `npx prisma db push` (adds two nullable columns). Tabs
still open on the old version will get 401s and need a reload.

**Found while testing:** this PC's clock is ~65 s behind, and local dev
shares the Neon database with the Vercel deployment. Vercel's cleanup deleted
local users as "stale" within seconds. It's not a production bug, but a
separate dev database (or Postgres `now()` for timestamps) would avoid it.
