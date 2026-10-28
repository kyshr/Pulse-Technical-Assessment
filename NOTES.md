# Phase 1 — Make it run

**How I found them:** traced each user flow end to end (join → see dots →
request/accept → chat → video → hang up → close tab) through client, API and
DB, then confirmed with two headless Chrome sessions with mocked geolocation.

## Bugs fixed

1. **Ghost dots never disappeared** (the reported bug) — `app/api/poll/route.ts`
   - **Cause:** the heartbeat was `updateMany({ where: {} })`, so _every_ poll
     refreshed `lastSeen` for _every_ user. While any tab was open, nobody went
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
     the queue was flushed _before_ `setRemoteDescription`. Every
     `addIceCandidate` threw (silently caught) and the candidates were lost.
     Signals are sent as parallel fetches, so ICE often beats the SDP.
   - **Fix:** flush the queue _after_ `setRemoteDescription`.

5. **Chat didn't end when the partner closed the tab** — `app/page.tsx`
   - **Cause:** `/api/leave` deletes the leaver's row _and_ its pending signals,
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
   - Dark only: removed the unused light-mode variables. The night globe _is_
     the brand.
   - Added a `glass` utility (blur, thin border, soft shadow) shared by every
     floating surface: notices, prompts and the online counter.

2. **The globe is the first thing you see** — `WorldMap.tsx`, `EntryGate.tsx`,
   `page.tsx`
   - Globe projection with atmosphere and stars instead of a flat map.
   - The map renders from the first paint, and the entry screen sits _over_ a
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
     _before_ clicking that they can't connect.
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
     draining ring on _both_ sides, so the requester knows how long to wait
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
every endpoint trusted whatever id the caller sent. The id _was_ the
credential, so anyone with DevTools could act as anyone. Each issue below was
reproduced with `curl` before the fix and re-tested after.

## Issues, ranked, and what I did

| #   | Severity | Issue                                                                                                                                                                                                                         | Status     |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | Critical | **Impersonation.** With a victim's public id you could read and drain their mailbox (their SDP/ICE, i.e. their real IP, defeating the location offset), send signals as them, move their dot, or kick them off the map.       | Fixed      |
| 2   | High     | **Unauthorised signals.** Any user could send `accept` to two strangers and mark them busy (do it to everyone and every request auto-declines), end anyone's call, or push WebRTC offers to people they weren't connected to. | Fixed      |
| 3   | High     | **No rate limits.** Request spam at one person, or flooding the Signal table with 64 KB payloads.                                                                                                                             | Fixed      |
| 4   | Medium   | **Loose validation.** Any payload on any signal type; signals to yourself; the client threw on malformed peer payloads.                                                                                                       | Fixed      |
| 5   | Medium   | **No security headers.** No CSP, and the app could be framed (clickjacking).                                                                                                                                                  | Fixed      |
| 6   | Medium   | **Unbounded poll cost.** 5 sequential DB round trips (~1.7 s), table-wide deletes on every poll, and every online user returned.                                                                                              | Fixed      |
| 7   | Medium   | **Location averaging.** Each session gets a fresh random offset around the same true point, so many sessions average out to near the real location.                                                                           | Accepted   |
| 8   | Low      | **Your partner learns your IP.** Inherent to peer-to-peer WebRTC.                                                                                                                                                             | Documented |

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

# Phase 4 — Make it better: Safe Reveal

**The idea.** The known way anonymous video chat fails is a stranger flashing
explicit content the moment the camera opens. Pulse already promises "chat and
video never touch the server", so the safety feature keeps that promise: it
runs entirely in your browser.

## What I built

1. **Blur until revealed** — a stranger's video starts heavily blurred (audio
   on). You tap **Reveal** when you're ready and can re-blur any time from the
   video bar. Every new video stream starts blurred again.
2. **Leave & hide** — one tap (chat header, video bar, or the blur card) ends
   the call, removes that stranger's dot for the rest of the session and
   silently ignores their requests. They just see "No answer", so hiding
   can't provoke them.
3. **On-device explicit-content check** — once a second the stranger's frame
   is scored by `nsfwjs` (MobileNetV2 on TensorFlow.js). If Porn + Hentai
   ≥ 0.7, the video blurs again and the card says "Blurred automatically …
   checked on your device". No frame, score or request leaves the browser.

## Why this design

- **No new server surface.** All three run in the browser, so the Phase 3
  work stays valid and there's nothing new to rate-limit or abuse.
- **Defence in depth.** Blur-first protects even if the model misses or fails
  to load; the model catches what appears _after_ you reveal.
- **Cost kept off the first load.** The model (~3.4 MB) and TensorFlow.js are
  lazy-loaded only when a video starts. The first page load is unchanged.
  It works under the production CSP without `unsafe-eval`.
- **"Sexy" isn't flagged** (swimwear, shirtless): mostly false alarms.

## Trade-offs and limits

- The model is ~90% accurate. It can miss, and it can false-alarm. While a
  frame stays flagged, it keeps re-blurring, so explicit video can't be
  watched on Pulse even after a manual Reveal. That's a product choice for a
  stranger app.
- Hiding is per session only, because everyone's id changes on every visit.
  Persistent blocking would need a stable identity, which Pulse avoids on
  purpose.
- Scanning once a second costs some CPU/GPU on low-end phones.

**Verified:** Playwright with two browsers and fake cameras on desktop and
mobile. Video starts blurred, Reveal unblurs, Leave & hide removes the dot,
and the hidden stranger's next request never reaches you. The classifier runs
on the production build under the strict CSP (scores logged: the fake
camera's test pattern reads as Neutral/Drawing, Porn 0). A forced flag
re-blurs it. I didn't test real explicit content.
