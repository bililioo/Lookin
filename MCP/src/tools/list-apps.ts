import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { LookinClient } from "../client.js";

export const listAppsTool: Tool = {
  name: "lookin_list_apps",
  description:
    "List all inspectable iOS apps running LookinServer. " +
    "Call this after list_devices to see available apps. " +
    "Each app carries its device `udid` (matching list_devices) and a `portKey`. " +
    "`isConnected` marks the app that get_hierarchy/get_attributes/get_screenshot " +
    "currently read from — with several simulators booted, confirm it or call " +
    "connect_app with the intended portKey before reading.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export async function handleListApps(client: LookinClient): Promise<string> {
  const apps = await client.listApps();
  const activePortKey = client.getActivePortKey();

  let hint: string;
  if (apps.length === 0) {
    hint =
      "No apps found with LookinServer running. Make sure your iOS app has LookinServer integrated and is in the foreground.";
  } else if (activePortKey === null) {
    hint =
      `${apps.length} app(s) found and none is connected. Call lookin_connect_app ` +
      "with the portKey of the app you want to inspect.";
  } else if (apps.length > 1) {
    hint =
      `${apps.length} app(s) found; reads currently come from ${activePortKey}. ` +
      "If that is not the intended device, call lookin_connect_app with another portKey.";
  } else {
    hint = "Found 1 app. Use lookin_connect_app with a portKey to connect.";
  }

  return JSON.stringify({ apps, activePortKey, hint }, null, 2);
}
