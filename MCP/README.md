# Lookin MCP

An MCP (Model Context Protocol) server for Lookin. It lets an MCP client inspect an iOS app that has LookinServer integrated, using the same Peertalk protocol as the Lookin macOS app.

This package lives inside the Lookin repository and is intended to be built from source.

## Prerequisites

Your iOS app must integrate [LookinServer](https://github.com/QMUI/LookinServer) in Debug builds.

```ruby
pod 'LookinServer', :configurations => ['Debug']
```

Swift projects can use:

```ruby
pod 'LookinServer', :subspecs => ['Swift'], :configurations => ['Debug']
```

Swift Package Manager:

```text
https://github.com/QMUI/LookinServer/
```

## Build

```bash
cd Lookin/MCP
npm install
npm run build
```

## Configure an MCP Client

Use the built `dist/index.js` file:

```json
{
  "mcpServers": {
    "lookin": {
      "command": "node",
      "args": [
        "/absolute/path/to/Lookin/MCP/dist/index.js"
      ]
    }
  }
}
```

For local development without a build step:

```json
{
  "mcpServers": {
    "lookin": {
      "command": "npx",
      "args": [
        "tsx",
        "/absolute/path/to/Lookin/MCP/src/index.ts"
      ]
    }
  }
}
```

## Tools

`lookin_list_devices`

Lists booted iOS simulators and USB-connected iOS devices.

`lookin_list_apps`

Scans the LookinServer port ranges and lists running inspectable apps. The response includes the `portKey` needed for connection.

`lookin_connect_app`

Connects to one app by `portKey`.

`lookin_get_hierarchy`

Returns the connected app's UI hierarchy. Each node includes `oid`, `className`, `frame`, and `children`. Pass an `oid` to the attribute or screenshot tools.

`lookin_get_attributes`

Returns grouped attributes for a node by `oid`.

`lookin_get_screenshot`

Returns a base64 PNG/JPEG screenshot for a node by `oid`. If `oid` is omitted, the server picks a visible screenshot target from the hierarchy.

## Typical Flow

```text
lookin_list_devices -> lookin_list_apps -> lookin_connect_app -> lookin_get_hierarchy -> lookin_get_attributes / lookin_get_screenshot
```

## Notes

Simulator apps are reached through `127.0.0.1:47164-47169`.

USB device apps are reached through usbmuxd on ports `47175-47179`.

The implementation was written for this repository using the Lookin client protocol in `LookinClient/Connection`, with [xiaoxiaowesley/lookin-mcp-peertalk](https://github.com/xiaoxiaowesley/lookin-mcp-peertalk) as a reference.
