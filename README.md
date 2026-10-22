# framy-posts

Scheduled Threads posting for the Framy account, through the official Threads API. Free to run (GitHub Actions + GitHub Pages).

```
queue.json          the posts, in order (text, optional video). "hold": true keeps one out of the rotation
schedule.json       the daily slots (UTC). Three a day by default
state.json          what has been posted (the workflow commits this)
clips/              the videos; GitHub Pages serves them so Threads can fetch them
scripts/post.mjs    posts the next item when a slot is due
scripts/token.mjs   token helper
drafts-v1.md        the same drafts in readable form, with the Instagram captions
```

Try it without posting anything:

```bash
node scripts/post.mjs --dry-run --now 2026-11-02T14:05:00Z
```

## One-time setup

1. **Meta app.** developers.facebook.com → create an app, add the **Threads API** use case, with the permissions `threads_basic` and `threads_content_publish`.
2. **Tester.** In the app's roles, add your Threads account as a **Threads tester**, then accept the invite in the Threads app (Settings → Account → Website permissions). While the app stays in development mode it can post only for testers, which is all we need.
3. **Token.** Generate a user token for the account in the Meta dashboard (it lasts about an hour), then on your Mac:
   ```bash
   node scripts/token.mjs exchange <APP_SECRET> <SHORT_LIVED_TOKEN>   # gives a 60-day token
   node scripts/token.mjs whoami <LONG_LIVED_TOKEN>                    # gives the numeric user id
   ```
4. **GitHub.** Create a public repository named `framy-posts` from this folder, then:
   - Settings → Pages → deploy from the `main` branch, root.
   - Settings → Secrets and variables → Actions: secrets `THREADS_USER_ID` and `THREADS_TOKEN`; variable `MEDIA_BASE_URL` = `https://<your-github-name>.github.io/framy-posts/`
5. **Test once** from the Actions tab (Run workflow) after setting `schedule.json` so a slot is due, or locally with `--id B1 --force`.

## Keeping it running

- The token lasts about 60 days. Every month or so run `node scripts/token.mjs refresh <TOKEN>` and update the `THREADS_TOKEN` secret.
- The Threads API allows 250 posts per 24 hours and 500 characters per post; this setup posts 3 a day.
- If a post fails, it stays at the front of the queue and the next run (30 minutes later) tries again.
- Never commit tokens. They live only in GitHub secrets.
