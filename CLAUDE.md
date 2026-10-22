# framy-posts — notes for Claude Code (read this first)

This folder runs the social-media posting for **Framy**, an iPhone app (frame / mat / light simulator with real-size AR). The app is not on the App Store yet ("coming soon"). The app's code is in a separate repo (`frme`).

## What this repo does
- `queue.json`: the posts to publish, in order. `state.json`: what was already posted (the workflow commits it).
- `schedule.json`: three daily slots in UTC (14:00, 19:30, 23:00).
- `scripts/post.mjs`: posts the next item to **Threads** through the official Threads API, to `me` (the token's owner). `scripts/token.mjs`: token helper.
- `.github/workflows/post.yml`: GitHub Actions runs `post.mjs` every 30 minutes (GitHub often delays scheduled runs by hours). Secret `THREADS_TOKEN`, variable `MEDIA_BASE_URL` (GitHub Pages serves `clips/`).
- Threads account: `cyano_matsuchiyo`. Instagram is handled by the user by hand.
- `style-guide.md` (voice and look) and `drafts-v1.md`, `drafts-v2.md` (English post drafts) hold the content plan. Goal: 300 posts → 1000 followers; replies are NOT a goal; the tone is soft, first-person ("I think", "for me"), never declarative or salesy.

## Working rules the user has set
- Talk to the user in Japanese, plainly. Do not over-use the comma "、".
- Do only what is asked. Never install to a device, commit or push unless asked. The user pushes with **GitHub Desktop** (the command line has no GitHub login).
- Secrets: **never ask the user to paste a token, the app secret or a code into chat, and never print them.** The token helper puts the token on the clipboard so it can be pasted straight into GitHub → Settings → Secrets. If one leaks (for example in a screenshot), revoke it (Threads → Settings → Account → Website permissions) and issue a new one.
- Posting is public: do not change what goes out, or enable/disable the workflow, without the user's go-ahead. Posts already published cannot be edited from here.
- The user is not a programmer: give GitHub / Meta steps one at a time, naming the exact button, and wait for "できた".

## State on 2026-10-23
- Posted: B1 (intro + AR clip), F1. Next in the queue: C4, then the rest of `queue.json`.
- The long-lived Threads token was issued on 2026-10-22 and lasts about 60 days: **refresh before about 2026-12-20** (`node scripts/token.mjs refresh <token>` or a new `login`, then update the `THREADS_TOKEN` secret).
- Queue still contains question-style posts (C1–C6) that the user no longer wants. They should be replaced by the soft-voice drafts in `drafts-v2.md` (the user will say which).
- To do next: image card templates (white background, M PLUS Rounded 1c light, oak brown + star yellow, Framy pixel character as a small accent); image support in `post.mjs`; automatic token refresh; maybe move the schedule to an always-on Mac mini for accurate timing.

## Useful commands
```bash
node scripts/post.mjs --dry-run --now 2026-11-02T14:05:00Z   # preview, posts nothing
node scripts/post.mjs --id B1 --force                         # post one item now (needs THREADS_TOKEN, MEDIA_BASE_URL)
node scripts/token.mjs login                                  # asks step by step; token goes to the clipboard
```
Clips are in `clips/` (made from the user's screen recordings with a standalone ffmpeg; ffmpeg is not installed system-wide).
