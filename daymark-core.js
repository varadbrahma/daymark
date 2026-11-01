(function (root, factory) {
  const core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  else root.DaymarkCore = core;
})(globalThis, function () {
  "use strict";

  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  function timerRemaining(session, now = Date.now()) {
    if (!session) return 0;
    return Math.max(0, session.paused ? session.remainingMs : session.endsAt - now);
  }

  function timerElapsed(session, now = Date.now()) {
    if (!session) return 0;
    return Math.max(0, Math.min(session.durationMs, session.durationMs - timerRemaining(session, now)));
  }

  function syncOwnerStatus(activeOwnerId, userId) {
    if (!userId) return "signed-out";
    if (!activeOwnerId) return "unbound";
    return activeOwnerId === userId ? "allowed" : "blocked";
  }

  function canSyncAccount(configured, consented, activeOwnerId, userId) {
    return Boolean(configured && consented && userId && syncOwnerStatus(activeOwnerId, userId) !== "blocked");
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
    }
    return value;
  }

  function sameValue(left, right) {
    return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
  }

  function sameState(left, right) {
    if (!left || !right) return left === right;
    if (left.deleted !== right.deleted) return false;
    return left.deleted || sameValue(left.value, right.value);
  }

  function localState(data, key, baseRecord) {
    if (hasOwn(data, key)) return { deleted: false, value: data[key] };
    return baseRecord ? { deleted: true, value: null } : null;
  }

  function remoteState(record) {
    return record ? { deleted: record.deleted, value: record.value } : null;
  }

  function mergePlannerData(baseRecords, localData, remoteRows) {
    const remoteRecords = Object.fromEntries(remoteRows.map(row => [row.key, row]));
    const keys = new Set([
      ...Object.keys(baseRecords),
      ...Object.keys(localData),
      ...Object.keys(remoteRecords)
    ]);
    const mergedData = { ...localData };
    const remoteWrites = [];
    const conflicts = [];

    for (const key of keys) {
      const base = baseRecords[key] || null;
      const remote = remoteRecords[key] || null;
      const local = localState(localData, key, base);
      const remoteValue = remoteState(remote);
      const baseValue = remoteState(base);
      const localChanged = !sameState(local, baseValue);
      const remoteChanged = !sameState(remoteValue, baseValue)
        || (base && remote && base.revision !== remote.revision);

      if (localChanged && remoteChanged && !sameState(local, remoteValue)) {
        conflicts.push({ key, local, remote: remoteValue, remoteRecord: remote });
        continue;
      }

      const chosen = localChanged && !remoteChanged ? local : remoteValue;
      if (!sameState(chosen, remoteValue)) {
        remoteWrites.push({ key, state: chosen });
      }
      if (chosen && !chosen.deleted) mergedData[key] = chosen.value;
      else delete mergedData[key];
    }

    return { mergedData, remoteWrites, conflicts, remoteRecords };
  }

  return { canSyncAccount, mergePlannerData, sameValue, syncOwnerStatus, timerElapsed, timerRemaining };
});
