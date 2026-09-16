/**
 * test/test-device-attribution.ts — regression test for device attribution.
 *
 * Prerequisite: at least one booted simulator running an app that links
 * LookinServer. With two or more simulators booted the test additionally
 * covers the ambiguous case.
 *
 * Run:
 *   npx tsx test/test-device-attribution.ts
 *
 * Covers the behaviour that used to be missing:
 *   1. Pure parsing of a simulator UDID out of a process command line.
 *   2. Every simulator app reported by listApps() carries a non-empty `udid`
 *      that also appears in listDevices() — so a caller can tell two
 *      simultaneous simulators apart.
 *   3. autoConnect() binds only when exactly one app answers; with several it
 *      refuses instead of silently reading an arbitrary device.
 *   4. connectApp() marks exactly one app `isConnected`, and that is the
 *      portKey getHierarchy() reads from.
 */

import { LookinClient } from "../src/client.js";
import {
  udidFromProcessCommand,
  resolveSimulatorUdid,
} from "../src/connection/simulator-resolver.js";

let stepNum = 0;
function step(title: string): void {
  stepNum++;
  console.log(`\n[step ${stepNum}] ${title}`);
}
function ok(msg: string): void {
  console.log(`   ✓ ${msg}`);
}
function info(msg: string): void {
  console.log(`   · ${msg}`);
}
function fail(msg: string): never {
  console.error(`   ✗ ${msg}`);
  process.exit(1);
}
function assert(cond: unknown, msg: string): void {
  if (!cond) fail(msg);
  ok(msg);
}

const UDID = "EBF544C7-6C31-42DF-B5A8-E4117D174353";

async function main(): Promise<void> {
  const client = new LookinClient();

  try {
    // ── Step 1 — pure parsing ───────────────────────────────
    step("Parse a simulator UDID out of a process command line");
    assert(
      udidFromProcessCommand(
        `/Users/dev/Library/Developer/CoreSimulator/Devices/${UDID}/data/Containers/Bundle/Application/ABC/MyApp.app/MyApp`
      ) === UDID,
      "extracts the UDID from a simulator app path"
    );
    assert(
      udidFromProcessCommand("/usr/libexec/CoreSimulator/SimulatorTrampoline") === "",
      "returns empty for a non-simulator command"
    );
    assert(udidFromProcessCommand("") === "", "returns empty for an empty command");
    assert(
      udidFromProcessCommand(
        "/Applications/Some.app/Some --flag /CoreSimulator/Devices/not-a-udid/data"
      ) === "",
      "rejects a malformed device path"
    );
    assert(
      (await resolveSimulatorUdid(1)) === "",
      "returns empty for a port with no listener"
    );

    // ── Step 2 — listApps carries a resolvable UDID ─────────
    step("listApps attributes every app to a real device");
    const devices = await client.listDevices();
    const simUdids = new Map(
      devices.filter((d) => d.type === "simulator").map((d) => [d.udid, d.name])
    );
    info(`booted simulators: ${[...simUdids].map(([u, n]) => `${n}=${u.slice(0, 8)}…`).join(", ") || "none"}`);

    const apps = await client.listApps();
    info(`apps with LookinServer: ${apps.map((a) => `${a.portKey}(${a.deviceDescription ?? "?"})`).join(", ") || "none"}`);

    if (apps.length === 0) {
      console.log("\nNo simulator app is running LookinServer — nothing further to check.");
      console.log("Start a Debug build of an app with LookinServer on a booted simulator and re-run.");
      return;
    }

    for (const app of apps) {
      if (!app.portKey.startsWith("sim:")) continue;
      assert(
        app.udid.length > 0,
        `${app.portKey} reports a non-empty udid (${app.udid || "EMPTY"})`
      );
      assert(
        simUdids.has(app.udid),
        `${app.portKey} udid matches a booted simulator in list_devices`
      );
    }

    const resolvedNames = apps
      .filter((a) => a.udid)
      .map((a) => `${a.portKey} → ${simUdids.get(a.udid) ?? "?"}`);
    assert(
      new Set(apps.filter((a) => a.udid).map((a) => a.udid)).size === apps.filter((a) => a.udid).length,
      "no two apps claim the same device UDID"
    );
    info(resolvedNames.join(" | "));

    // ── Step 3 — autoConnect refuses to guess ───────────────
    step("autoConnect only binds an unambiguous target");
    let autoConnectError: Error | null = null;
    try {
      await client.autoConnect();
    } catch (e) {
      autoConnectError = e as Error;
    }

    if (apps.length > 1) {
      assert(autoConnectError !== null, "refuses to auto-connect while several apps answer");
      assert(
        client.getActivePortKey() === null,
        "stays unconnected so no read can hit the wrong device"
      );
      assert(
        /ambiguous/i.test(autoConnectError!.message),
        "explains that the choice is ambiguous"
      );
      info(autoConnectError!.message);
    } else {
      assert(autoConnectError === null, "auto-connects when a single app answers");
      assert(
        client.getActivePortKey() === apps[0].portKey,
        "binds the only available app"
      );
    }

    // ── Step 4 — explicit connect is authoritative ──────────
    step("connectApp marks exactly one app connected, and reads follow it");
    const target = apps[0];
    await client.connectApp(target.portKey);
    assert(
      client.getActivePortKey() === target.portKey,
      `active portKey is ${target.portKey}`
    );

    const after = await client.listApps();
    const connected = after.filter((a) => a.isConnected);
    assert(connected.length === 1, "exactly one app is marked isConnected");
    assert(
      connected[0].portKey === target.portKey,
      `isConnected marks ${target.portKey}`
    );

    const hierarchy = await client.getHierarchy();
    assert(
      hierarchy.appName.length > 0,
      `hierarchy reads from an app named "${hierarchy.appName}"`
    );

    console.log("\nAll steps passed ✓");
  } finally {
    await client.shutdown();
  }
}

main().catch((err) => {
  console.error("\nFatal:", err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
