/**
 * AppRegistry — fans out `LookinRequestType.App` to every active channel
 * and aggregates the per-channel `LookinAppInfo` into an inspectable list.
 *
 * One LookinServer port maps to exactly one running iOS app (a process can
 * only bind to a single port in the 47164–47169 / 47175–47179 ranges), so
 * each portKey maps to exactly one `InspectableApp`.
 */

import { ConnectionManager } from "./manager.js";
import { LookinRequestType } from "../peertalk/frame-types.js";
import type { LookinAppInfo } from "../peertalk/schemas/LookinAppInfo.js";

export interface InspectableApp {
  /** Stable channel identifier, e.g. "sim:47164" or "usb:<udid>:47175". */
  portKey: string;
  /**
   * Device UDID, matching the `udid` from `lookin_list_devices`. Populated for
   * simulators as well as USB devices; stays "" only when the host-side lookup
   * is unavailable.
   */
  udid: string;
  appName: string;
  bundleId: string;
  deviceDescription: string;
  screenWidth: number;
  screenHeight: number;
  screenScale: number;
  /** True if the underlying channel is still registered with ConnectionManager. */
  isActive: boolean;
  /**
   * True for the single portKey the client is currently reading from. Filled in
   * by `LookinClient`, which owns the active-connection state — with several
   * simulators booted, every app otherwise looks alike.
   */
  isConnected?: boolean;
}

export interface AppRegistryOptions {
  /**
   * Map a portKey to a device UDID.
   *
   * LookinClient supplies this so simulator channels resolve to their booted
   * simulator; see `connection/simulator-resolver.ts`. If omitted, the UDID is
   * extracted from `usb:<udid>:<port>` portKeys and is empty for `sim:<port>`.
   */
  resolveUdid?: (portKey: string) => string;
}

export class AppRegistry {
  constructor(
    private readonly connectionManager: ConnectionManager,
    private readonly options: AppRegistryOptions = {}
  ) {}

  /**
   * Send `LookinRequestType.App` to every active channel concurrently and
   * collect the results. Channels that fail (timeout, version mismatch,
   * background, etc.) are silently skipped.
   */
  async listApps(): Promise<InspectableApp[]> {
    const portKeys = this.connectionManager.getActivePortKeys();
    const tasks = portKeys.map((portKey) =>
      this.fetchApp(portKey)
        .then((info) => (info ? this.toInspectableApp(portKey, info) : null))
        .catch(() => null)
    );
    const results = await Promise.allSettled(tasks);
    const out: InspectableApp[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) out.push(r.value);
    }
    return out;
  }

  /**
   * Fetch the `LookinAppInfo` for a single channel and lift it into the
   * public `InspectableApp` shape. Returns null on any failure.
   */
  async getApp(portKey: string): Promise<InspectableApp | null> {
    try {
      const info = await this.fetchApp(portKey);
      if (!info) return null;
      return this.toInspectableApp(portKey, info);
    } catch {
      return null;
    }
  }

  // ────────────────────────────────────────────────────────

  private async fetchApp(portKey: string): Promise<LookinAppInfo | null> {
    const data = await this.connectionManager.request(
      portKey,
      LookinRequestType.App,
      { needImages: true, local: [] }
    );
    // Some servers wrap the result in NSArray, some return a single object.
    if (Array.isArray(data)) {
      // For multi-frame responses we get back an array of chunks; the App
      // request is single-frame in practice but be defensive.
      for (const item of data) {
        if (item && typeof item === "object" && "appName" in item) {
          return item as LookinAppInfo;
        }
      }
      return null;
    }
    if (data && typeof data === "object" && "appName" in data) {
      return data as LookinAppInfo;
    }
    return null;
  }

  private toInspectableApp(portKey: string, info: LookinAppInfo): InspectableApp {
    return {
      portKey,
      udid: this.resolveUdid(portKey),
      appName: info.appName ?? "",
      bundleId: info.appBundleIdentifier ?? "",
      deviceDescription: info.deviceDescription ?? "",
      screenWidth: info.screenWidth,
      screenHeight: info.screenHeight,
      screenScale: info.screenScale,
      isActive: this.connectionManager.getChannel(portKey) !== undefined,
    };
  }

  private resolveUdid(portKey: string): string {
    if (this.options.resolveUdid) {
      try {
        return this.options.resolveUdid(portKey) ?? "";
      } catch {
        return "";
      }
    }
    // Default extraction: "usb:<udid>:<port>" → "<udid>".
    if (portKey.startsWith("usb:")) {
      const rest = portKey.slice("usb:".length);
      const lastColon = rest.lastIndexOf(":");
      return lastColon > 0 ? rest.slice(0, lastColon) : rest;
    }
    return "";
  }
}
