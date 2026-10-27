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

- The map opens zoomed in on you (zoom 4). Peers thousands of km away (e.g.
  Tokyo vs. the Philippines in DevTools Sensors) are on the map, just
  off-screen. Zoom out, or check the "N online" counter.

## Known limits (not fixed)

- A tab hidden for 5+ minutes can be throttled to one poll per minute, gets
  reaped, and won't reappear until it's reloaded (the heartbeat only updates an
  existing row).
- STUN only, no TURN (out of scope per the README).
