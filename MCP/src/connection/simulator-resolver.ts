/**
 * simulator-resolver — map a LookinServer listening port on 127.0.0.1 back to
 * the booted iOS Simulator that owns it.
 *
 * LookinServer binds a port from 47164–47169 inside the simulator, and the
 * simulator shares the host network stack, so the port alone does not say
 * *which* simulator answered. When more than one simulator is booted that
 * ambiguity is real: every app reports the same `appName` and screen size, so
 * a caller cannot tell them apart.
 *
 * The owning process does carry the answer: the simulator's app bundle lives
 * under `~/Library/Developer/CoreSimulator/Devices/<UDID>/…`, and `ps` reports
 * that path for the process holding the listening socket. So:
 *
 *   1. `lsof -nP -iTCP:<port> -sTCP:LISTEN -t` → owning PID
 *   2. `ps -ww -o command= -p <pid>`          → path containing the UDID
 *
 * This is a macOS-only, best-effort lookup. Any failure degrades to an empty
 * string, which is exactly the pre-existing behaviour, so a locked-down host
 * loses the correlation without breaking the connection flow.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Strict CoreSimulator UDID: 8-4-4-4-12 hex. */
const UDID_IN_COMMAND =
  /\/CoreSimulator\/Devices\/([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})\//i;

const LSOF_TIMEOUT_MS = 5000;

/**
 * Extract a booted-simulator UDID from a process command line.
 * Returns "" when the command does not reference a CoreSimulator device.
 *
 * Exported separately from the process lookups so the parsing rule can be
 * tested without a live simulator.
 */
export function udidFromProcessCommand(command: string | undefined | null): string {
  const match = UDID_IN_COMMAND.exec(command ?? "");
  return match ? match[1] : "";
}

/** PIDs holding a LISTEN socket on `port`, or [] when nothing is listening. */
async function listenerPids(port: number): Promise<string[]> {
  try {
    const { stdout } = await run(
      "lsof",
      ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"],
      { timeout: LSOF_TIMEOUT_MS }
    );
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^\d+$/.test(line));
  } catch {
    // lsof exits non-zero when nothing matches; treat every failure as empty.
    return [];
  }
}

/** Command line of a process, or "" when it cannot be read. */
async function processCommand(pid: string): Promise<string> {
  try {
    const { stdout } = await run("ps", ["-ww", "-o", "command=", "-p", pid], {
      timeout: LSOF_TIMEOUT_MS,
    });
    return stdout.trim();
  } catch {
    return "";
  }
}

/**
 * Resolve the simulator UDID behind a LookinServer port.
 * Returns "" when the port is not held by a simulator app process.
 */
export async function resolveSimulatorUdid(port: number): Promise<string> {
  const pids = await listenerPids(port);
  for (const pid of pids) {
    const udid = udidFromProcessCommand(await processCommand(pid));
    if (udid) return udid;
  }
  return "";
}

/**
 * Cached variant. Port ownership only changes when an app relaunches, and a
 * resolve costs two subprocesses, so results are memoised per port. Failures
 * are cached too — retrying a missing simulator on every listing would add
 * latency for no benefit.
 */
export function createSimulatorUdidResolver(): (port: number) => Promise<string> {
  const cache = new Map<number, Promise<string>>();
  return (port: number) => {
    let pending = cache.get(port);
    if (!pending) {
      pending = resolveSimulatorUdid(port);
      cache.set(port, pending);
    }
    return pending;
  };
}
