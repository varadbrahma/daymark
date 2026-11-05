const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { Script } = require("node:vm");
const { join } = require("node:path");
const test = require("node:test");
const core = require("../daymark-core.js");

test("timer countdown respects running, paused, and completed states", () => {
  const running = { durationMs: 60_000, endsAt: 160_000, paused: false, remainingMs: 60_000 };
  assert.equal(core.timerRemaining(running, 115_000), 45_000);
  assert.equal(core.timerElapsed(running, 115_000), 15_000);
  const paused = { ...running, paused: true, remainingMs: 30_000 };
  assert.equal(core.timerRemaining(paused, 900_000), 30_000);
  assert.equal(core.timerElapsed(paused, 900_000), 30_000);
  assert.equal(core.timerRemaining(running, 170_000), 0);
  assert.equal(core.timerElapsed(running, 170_000), 60_000);
});

test("merge keeps unrelated local and remote edits", () => {
  const base = {
    "day:a": { key: "day:a", value: "before", deleted: false, revision: 1 },
    "day:b": { key: "day:b", value: "before", deleted: false, revision: 1 }
  };
  const merged = core.mergePlannerData(base, { "day:a": "local", "day:b": "before" }, [
    { key: "day:a", value: "before", deleted: false, revision: 1 },
    { key: "day:b", value: "remote", deleted: false, revision: 2 }
  ]);
  assert.deepEqual(merged.conflicts, []);
  assert.equal(merged.mergedData["day:a"], "local");
  assert.equal(merged.mergedData["day:b"], "remote");
  assert.deepEqual(merged.remoteWrites, [{ key: "day:a", state: { deleted: false, value: "local" } }]);
});

test("merge reports divergent edits instead of overwriting either side", () => {
  const base = { "diary:2026-01-01": { key: "diary:2026-01-01", value: "start", deleted: false, revision: 4 } };
  const merged = core.mergePlannerData(base, { "diary:2026-01-01": "offline edit" }, [
    { key: "diary:2026-01-01", value: "other device edit", deleted: false, revision: 5 }
  ]);
  assert.equal(merged.conflicts.length, 1);
  assert.equal(merged.conflicts[0].local.value, "offline edit");
  assert.equal(merged.conflicts[0].remote.value, "other device edit");
  assert.deepEqual(merged.remoteWrites, []);
});

test("merge reports deletion-versus-edit conflicts", () => {
  const base = { "plan:today": { key: "plan:today", value: "old", deleted: false, revision: 1 } };
  const merged = core.mergePlannerData(base, {}, [
    { key: "plan:today", value: "new", deleted: false, revision: 2 }
  ]);
  assert.equal(merged.conflicts.length, 1);
  assert.equal(merged.conflicts[0].local.deleted, true);
  assert.equal(merged.conflicts[0].remote.value, "new");
});

test("merge accepts the same edit made independently on both devices", () => {
  const base = { "settings:name": { key: "settings:name", value: "before", deleted: false, revision: 1 } };
  const merged = core.mergePlannerData(base, { "settings:name": "same" }, [
    { key: "settings:name", value: "same", deleted: false, revision: 2 }
  ]);
  assert.deepEqual(merged.conflicts, []);
  assert.equal(merged.mergedData["settings:name"], "same");
  assert.deepEqual(merged.remoteWrites, []);
});

test("sync is bound to the first account and blocks account switching", () => {
  assert.equal(core.syncOwnerStatus(null, "account-one"), "unbound");
  assert.equal(core.syncOwnerStatus("account-one", "account-one"), "allowed");
  assert.equal(core.syncOwnerStatus("account-one", "account-two"), "blocked");
  assert.equal(core.syncOwnerStatus("account-one", null), "signed-out");
});

test("sync cannot start without explicit consent", () => {
  assert.equal(core.canSyncAccount(true, false, null, "account-one"), false);
  assert.equal(core.canSyncAccount(true, true, null, "account-one"), true);
  assert.equal(core.canSyncAccount(true, true, "account-one", "account-two"), false);
  assert.equal(core.canSyncAccount(false, true, null, "account-one"), false);
});

test("planner inline JavaScript parses and sync migration enforces ownership", () => {
  const html = readFileSync(join(__dirname, "..", "index.html"), "utf8");
  const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(inlineScript, "app script exists");
  assert.doesNotThrow(() => new Script(inlineScript[1]), "app JavaScript parses");
  assert.match(html, /core\.canSyncAccount\(syncConfigured, hasSyncConsent\(\), currentSyncOwner\(\), authSession\?\.user\.id\)/);
  const signInStart = html.indexOf("async function signIn(createAccount)");
  const ownerCheck = html.indexOf("core.syncOwnerStatus(currentSyncOwner(), payload.user.id)", signInStart);
  const storeSession = html.indexOf("storeAuthSession({", signInStart);
  assert.ok(ownerCheck > signInStart && ownerCheck < storeSession, "a different account is rejected before its session is stored");
  assert.match(html, /if \(core\.canSyncAccount\(syncConfigured, hasSyncConsent\(\), currentSyncOwner\(\), authSession\?\.user\.id\)\) scheduleRemoteSync\(0\)/);
  assert.match(html, /account-sync table is not set up yet/);
  const focusRecordStart = html.indexOf("const record = {", html.indexOf("function finishPomodoro"));
  const focusRecordEnd = html.indexOf("\n            };", focusRecordStart);
  assert.ok(focusRecordStart > 0 && focusRecordEnd > focusRecordStart);
  assert.doesNotMatch(html.slice(focusRecordStart, focusRecordEnd), /focusTask|focusStep/);
  assert.match(html.slice(focusRecordStart, focusRecordEnd), /reflection: ""/);
  const migration = readFileSync(join(__dirname, "..", "supabase", "migrations", "20261101000000_daymark_sync.sql"), "utf8");
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /using\s*\(\(select auth\.uid\(\)\)\s*=\s*user_id\)/i);
  assert.match(migration, /with check\s*\(\(select auth\.uid\(\)\)\s*=\s*user_id\)/i);
  assert.doesNotMatch(html, /service_role/i);
});
