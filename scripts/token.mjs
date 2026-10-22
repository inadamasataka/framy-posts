// Token helper for the Threads API (run on your own Mac, never commit the output).
//
//   node scripts/token.mjs auth-url <APP_ID> <REDIRECT_URI>                         prints the URL to open in a browser to authorise the app
//   node scripts/token.mjs code <APP_ID> <APP_SECRET> <REDIRECT_URI> <CODE>         turns the ?code=... from the redirect into a 60-day token
//   node scripts/token.mjs refresh <LONG_LIVED_TOKEN>                               extends a long-lived token by another 60 days (it must be at least 24 hours old)
//   node scripts/token.mjs whoami <TOKEN>                                           prints the numeric Threads user id and username
//
//   node scripts/token.mjs login                                                    asks for everything step by step (the secret is typed hidden) and prints the 60-day token
//
// Use the Threads App ID / secret (App settings > Basic, the Threads one), not the Instagram or Facebook ones.
const HOSTS = ["https://graph.threads.com", "https://graph.threads.net"]; // the newer host first, the older one as a fallback
const [cmd, ...a] = process.argv.slice(2);

async function call(method, path, params) {
  let last;
  for (const host of HOSTS) {
    const q = new URLSearchParams(params);
    const res = method === "GET" ? await fetch(`${host}${path}?${q}`) : await fetch(`${host}${path}`, { method, body: q });
    const json = await res.json().catch(() => ({}));
    if (res.ok && !json.error) return json;
    last = json;
  }
  throw new Error(JSON.stringify(last));
}

import readline from "node:readline";
import { writeFileSync } from "node:fs";
const hide = []; // secrets to blank out of any error message that gets printed
function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    // while muted, nothing the user types or pastes is echoed (readline re-draws the whole line on a paste, so both the keys and the redraw are swallowed)
    const write = rl._writeToOutput.bind(rl);
    rl._writeToOutput = (str) => {
      if (!muted) write(str);
    };
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
    if (hidden) muted = true;
  });
}

async function exchange(appId, secret, redirect, rawCode) {
  const code = rawCode.replace(/#_$/, "").replace(/^.*[?&]code=/, "").replace(/[&#].*$/, ""); // accepts the whole redirected URL too
  const short = await call("POST", "/oauth/access_token", { client_id: appId, client_secret: secret, grant_type: "authorization_code", redirect_uri: redirect, code });
  const long = await call("GET", "/access_token", { grant_type: "th_exchange_token", client_secret: secret, access_token: short.access_token });
  return { user_id: String(short.user_id), access_token: long.access_token, expires_in_days: Math.round(long.expires_in / 86400) };
}

try {
  if (cmd === "login") {
    const appId = (await ask("Threads app ID [1628557148632112]: ")) || "1628557148632112";
    const redirect = (await ask("Redirect URL [https://inadamasataka.github.io/framy-posts/]: ")) || "https://inadamasataka.github.io/framy-posts/";
    const secret = await ask("Threads app secret (typing is hidden): ", { hidden: true });
    hide.push(secret);
    if (!/^[0-9a-f]{32}$/i.test(secret)) {
      console.log(`That does not look like a Threads app secret (32 letters/digits); what was entered is ${secret.length} characters long. Paste it once and try again.`);
      process.exit(1);
    }
    console.log("secret received (32 characters)");
    const url = await ask("Paste the whole address you were sent to after allowing the app: ");
    const r = await exchange(appId, secret, redirect, url);
    // the token is never printed: it goes straight to the clipboard, so a screenshot of this window cannot leak it
    const { spawnSync } = await import("node:child_process");
    const copied = spawnSync("pbcopy", { input: r.access_token }).status === 0;
    if (!copied) {
      writeFileSync(new URL("../.token.local", import.meta.url), r.access_token, { mode: 0o600 });
    }
    console.log("\nuser_id:", r.user_id, "\nvalid for about", r.expires_in_days, "days");
    console.log(copied ? "\nThe token is now on your clipboard (not shown). Paste it straight into the GitHub secret, then copy something else to clear it." : "\nCould not use the clipboard: the token was saved to .token.local (it is git-ignored). Open that file, copy it, then delete the file.");
  } else if (cmd === "auth-url") {
    const [appId, redirect] = a;
    console.log("https://threads.com/oauth/authorize?" + new URLSearchParams({ client_id: appId, redirect_uri: redirect, scope: "threads_basic,threads_content_publish", response_type: "code" }));
  } else if (cmd === "code") {
    const [appId, secret, redirect, rawCode] = a;
    console.log(JSON.stringify(await exchange(appId, secret, redirect, rawCode), null, 2));
  } else if (cmd === "refresh") {
    console.log(JSON.stringify(await call("GET", "/refresh_access_token", { grant_type: "th_refresh_token", access_token: a[0] }), null, 2));
  } else if (cmd === "whoami") {
    console.log(JSON.stringify(await call("GET", "/v1.0/me", { fields: "id,username", access_token: a[0] }), null, 2));
  } else {
    console.log("usage: auth-url <APP_ID> <REDIRECT_URI> | code <APP_ID> <APP_SECRET> <REDIRECT_URI> <CODE> | refresh <TOKEN> | whoami <TOKEN>");
  }
} catch (e) {
  let msg = String(e.message ?? e);
  for (const h of hide) if (h) msg = msg.split(h).join("***");
  console.error("failed:", msg);
  process.exit(1);
}
