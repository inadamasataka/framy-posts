// Posts the next item of queue.json to Threads through the official Threads API (graph.threads.net).
//
//   node scripts/post.mjs                 post one item if a slot is due (what the workflow runs)
//   node scripts/post.mjs --dry-run       show what would happen, post nothing
//   node scripts/post.mjs --now 2026-11-02T14:05:00Z   pretend it is this time (for testing)
//   node scripts/post.mjs --id B1 --force post this exact item right now, ignoring the slots
//
// Needs THREADS_TOKEN (environment variable / GitHub secret) and, for items with media,
// MEDIA_BASE_URL (the public URL the clips/ folder is served from, e.g. https://<user>.github.io/framy-posts/).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

const DRY = flag("--dry-run");
const now = opt("--now") ? new Date(opt("--now")) : new Date();
const read = (f) => JSON.parse(readFileSync(join(root, f), "utf8"));
const queue = read("queue.json");
const schedule = read("schedule.json");
const state = read("state.json");

const GRAPH = process.env.THREADS_API_BASE ?? "https://graph.threads.com/v1.0"; // the override is only for testing against a fake server
const MAX_TEXT_BYTES = 500; // Threads counts emoji by UTF-8 bytes in some places; keep a margin below the 500 limit

function dueNow() {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const passed = schedule.slotsUtc.filter((s) => {
    const [h, m] = s.split(":").map(Number);
    return new Date(dayStart.getTime() + (h * 60 + m) * 60000) <= now;
  }).length;
  const postedToday = state.posted.filter((p) => new Date(p.at) >= dayStart).length;
  return { passed, postedToday, due: postedToday < passed };
}

function nextItem() {
  const forced = opt("--id");
  if (forced) return queue.find((q) => q.id === forced);
  const done = new Set(state.posted.map((p) => p.id));
  return queue.find((q) => !done.has(q.id) && !q.hold);
}

async function api(method, path, params) {
  const url = new URL(`${GRAPH}/${path}`);
  const body = new URLSearchParams({ ...params, access_token: process.env.THREADS_TOKEN });
  const res = method === "GET" ? await fetch(`${url}?${body}`) : await fetch(url, { method, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`${method} ${path} failed: ${JSON.stringify(json.error ?? json)}`);
  return json;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function publish(item) {
  const user = "me"; // "me" is whoever the token belongs to, so there is no user id to mistype
  const params = { text: item.text };
  if (item.media) {
    const base = process.env.MEDIA_BASE_URL;
    if (!base) throw new Error("MEDIA_BASE_URL is not set");
    params.media_type = item.media.type; // VIDEO or IMAGE
    params[item.media.type === "VIDEO" ? "video_url" : "image_url"] = new URL(item.media.file, base.endsWith("/") ? base : `${base}/`).href;
  } else params.media_type = "TEXT";

  const container = await api("POST", `${user}/threads`, params);
  // Threads fetches the media and needs a moment before the container can be published
  for (let i = 0; i < 40; i++) {
    await sleep(item.media ? 10000 : 3000);
    const s = await api("GET", container.id, { fields: "status,error_message" });
    if (s.status === "FINISHED") break;
    if (s.status === "ERROR" || s.status === "EXPIRED") throw new Error(`container ${s.status}: ${s.error_message ?? ""}`);
    if (i === 39) throw new Error("container did not finish in time");
  }
  return api("POST", `${user}/threads_publish`, { creation_id: container.id });
}

const { passed, postedToday, due } = dueNow();
const item = nextItem();
console.log(`now ${now.toISOString()} | slots passed today ${passed} | posted today ${postedToday} | due ${due}`);
if (!item) {
  console.log("Queue is empty (or only held items are left).");
  process.exit(0);
}
if (!flag("--force") && !due) {
  console.log("Nothing due. Next up:", item.id);
  process.exit(0);
}
if (Buffer.byteLength(item.text, "utf8") > MAX_TEXT_BYTES + 200) console.warn(`warning: ${item.id} is long (${Buffer.byteLength(item.text, "utf8")} bytes)`);

console.log(`${DRY ? "[dry run] would post" : "posting"} ${item.id}${item.media ? ` (+ ${item.media.file})` : ""}:\n${item.text}\n`);
if (DRY) process.exit(0);

try {
  const res = await publish(item);
  state.posted.push({ id: item.id, at: new Date().toISOString(), threadId: res.id });
  writeFileSync(join(root, "state.json"), JSON.stringify(state, null, 2) + "\n");
  console.log("posted, id", res.id);
} catch (e) {
  const msg = String(e.message ?? e);
  console.error(msg);
  console.log(`::error title=Threads post failed (${item.id})::${msg.replace(/[\r\n]+/g, " ")}`); // shows up in the run summary, readable without opening the log
  process.exit(1); // the post stays in the queue; the next run tries again
}
