# Changes — final dashboard (November 2026)

Built on the `feat/swipe-label` version of the dashboard. The original first version is kept on
the [`original-dashboard`](https://github.com/adam9798/argus-dashboard/tree/original-dashboard) branch.

## Added

### Discord alerts
- A server-side watcher checks each node every 2 seconds and posts one message per flagged event.
- Text only: node, class, zone, confidence, time and event number. No images.
- Retries with backoff; an alert that cannot be delivered is written to `data/alerts/dead-letter.jsonl`.
- Remembers what it sent, so a restart does not repeat alerts, and ignores events older than 15 minutes.
- Status card and **Send test alert** button under Settings.

### Node discovery
- Searches the local network at start-up, on a network change, when a node stops answering,
  and from the **Find nodes** button (Settings and sign-in screen).
- Nodes are matched by the name they report. An address that still answers is never replaced.

### Federated learning history
- A background saver records each training round without the Federated page being open.
- Rounds are shown as Running, Awaiting decision, Accepted, Rejected, Incomplete or Interrupted.
- **Accepted models** section per node, saved so it shows with a node switched off.
- Scripts to import the rounds a node saved before this version
  (`scripts/collect-fl-rounds.py`, `scripts/import-fl-rounds.mjs`).
- Rounds that recorded nothing about their training data are marked **unverified** and not charted.

## Redesigned

- New look on every page, with a collapsible sidebar on computers and a bottom bar on phones.
- **Overview:** summary cards, camera panels, temperature chart and alerts from all nodes.
- **Enlarge** button on each camera, using the same video stream.
- New **Settings** page. Staging mode moved under **Training tools** on the Overview.
- Animations, loading placeholders, and reduced motion for devices that ask for it.
- Readable thermal chart on phones.
- Works from other devices on the network in development mode.

## Security

- Session cookies are now signed and bound to one node. A cookie the dashboard did not issue is
  rejected; before, any cookie with the right name opened the console.
- Pages and API routes that accepted any session cookie now check the signature.
- Only nodes named in `ARGUS_NODES` can sign someone into the console.
- Clearer sign-in errors: wrong password, locked out (with the wait), or unreachable.

## Fixed

- Picking an offline or signed-out node on Alerts or Thermal returned to the sign-in screen.
  The page now says what is wrong and offers the sign-in in place.
- A node that was switched off asked for a sign-in instead of showing **Offline**.
- Training rounds were saved only while the Federated page was open.
- Two rounds from one node a few minutes apart were grouped as one run.
- A long round's earlier log entries could be overwritten by later reads.
- A damaged history file now falls back to its backup, and writes are flushed to disk.
- Saves from different parts of the server can no longer overwrite each other.

## Removed

- The **Live feed** page and its status strip. The Overview panels cover them.
- An unused offline test button.

## Not included

- Telegram alerts and a face-enrollment screen.
- A diagnostics page.
- The test-set charts stay empty until a test set is frozen on the Label page and models are scored.

## How it was checked

Type check, lint and a production build. Edge-case tests of the history rules, and an end-to-end
test of round saving with a simulated node. Sign-in with forged, edited and expired cookies.
Screenshots at computer and phone widths, and hand tests of sign-in, camera enlarging, the Discord
test alert, node search and offline handling.

Not yet exercised: a real training round with the automatic saver, and hand testing of labeling,
swipe and staging after the redesign.
