# Lookin MCP

这是 Lookin 的 MCP (Model Context Protocol) 服务。它通过 Lookin macOS 客户端同款 Peertalk 协议直连集成了 LookinServer 的 iOS App，让 MCP 客户端可以用工具调用读取 UI 层级、属性和截图。

这个包放在 Lookin 仓库内，按源码构建使用。

## 前置条件

iOS App 需要在 Debug 配置下集成 [LookinServer](https://github.com/QMUI/LookinServer)。

如果需要 MCP 和 Lookin macOS App 同时连接同一个 iOS App，请使用支持多客户端连接的 LookinServer，例如：

```text
https://github.com/bililioo/LookinServer.git
```

分支：

```text
develop
```

集成或更新 LookinServer 后，需要重新编译并运行目标 iOS App。

```ruby
pod 'LookinServer', :configurations => ['Debug']
```

Swift 项目可以使用：

```ruby
pod 'LookinServer', :subspecs => ['Swift'], :configurations => ['Debug']
```

Swift Package Manager：

```text
https://github.com/bililioo/LookinServer.git
```

## 构建

```bash
cd Lookin/MCP
npm install
npm run build
```

构建产物是：

```text
Lookin/MCP/dist/index.js
```

## 配置 MCP 客户端

### Codex

推荐使用 Codex CLI 写入配置：

```bash
codex mcp add lookin -- node /absolute/path/to/Lookin/MCP/dist/index.js
```

如果之前已经配置过同名 MCP，先移除旧配置：

```bash
codex mcp remove lookin
codex mcp add lookin -- node /absolute/path/to/Lookin/MCP/dist/index.js
```

检查配置：

```bash
codex mcp get lookin
```

配置完成后，重启 Codex 或开启新线程，让新的 MCP server 生效。

### 通用 MCP 配置

也可以手动配置 MCP 客户端，使用构建后的 `dist/index.js`：

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

开发模式可以不构建，直接运行源码：

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

## 工具

`lookin_list_devices`

列出已启动的 iOS 模拟器和 USB 连接的 iOS 真机。

`lookin_list_apps`

扫描 LookinServer 端口范围，列出可检查的运行中 App。每个 App 返回：

- `portKey` — `lookin_connect_app` 接受的标识（如 `sim:47165`）。
- `udid` — 所属设备，与 `lookin_list_devices` 一致。模拟器和 USB 真机都会填充，因此同时启动多台模拟器时可以区分。仅在宿主机侧解析不可用时为 `""`。
- `isConnected` — 当前读操作真正作用于那个 App 时返回 `true`。
- `deviceDescription` — 设备名，便于阅读。

返回值顶层还有 `activePortKey`（未连接时为 `null`）。

`lookin_connect_app`

通过 `portKey` 连接指定 App。会先自行扫描通道，因此可以直接单独调用。

`lookin_get_hierarchy`

返回已连接 App 的 UI 层级。节点包含 `oid`、`className`、`frame`、`children` 等字段，返回值会标明数据来自哪个 `portKey`。`oid` 可以继续传给属性和截图工具。

`lookin_get_attributes`

通过 `oid` 返回节点的分组属性。

`lookin_get_screenshot`

通过 `oid` 返回节点截图，格式为 base64 PNG/JPEG。不传 `oid` 时，会从层级里选择一个可见截图目标。

## 常用流程

```text
lookin_list_devices -> lookin_list_apps -> lookin_connect_app -> lookin_get_hierarchy -> lookin_get_attributes / lookin_get_screenshot
```

## 同时启动多台模拟器

所有 LookinServer App 返回的 App 名和屏幕尺寸都一样，所以「是哪台模拟器应答的」本身不携带任何信息。两条规则保证读到的数据不会张冠李戴：

- 启动时**只有在恰好一个 App 应答的情况下**才自动连接。两个及以上时保持未连接，读操作会明确要求先选择，而不是返回任意一台模拟器的界面。
- `lookin_list_apps` 会给出每个 App 的设备 `udid` 并标出已连接的那个。读之前先确认 `activePortKey`，或者用目标 `portKey` 显式调用 `lookin_connect_app`。

端口到设备的归属，是通过占用监听 socket 的进程解析出来的（其 bundle 路径包含 `CoreSimulator/Devices/<UDID>/`）。该解析仅支持 macOS；不可用时 `udid` 退化为 `""`，其余功能不受影响。

## 测试

手动脚本，用 `tsx` 对着已启动的模拟器运行：

```bash
npx tsx test/test-e2e.ts                  # 与真实 App 的协议往返
npx tsx test/test-device-attribution.ts   # 设备归属与歧义保护
npx tsx test/test-connection.ts
npx tsx test/test-ping.ts
npx tsx test/test-unarchive.ts
```

## 说明

模拟器 App 通过 `127.0.0.1:47164-47169` 连接。

USB 真机 App 通过 usbmuxd 连接 `47175-47179` 端口。

MCP 本身不替代 LookinServer。目标 iOS App 必须处于运行状态，并且已经集成 Debug 版本的 LookinServer。

本服务走的是 LookinServer 自己的 Peertalk 协议，**不能**与那些扫描 `47190-47199` 端口、期望 `/status`、`/hierarchy`、`/properties` 的 HTTP 版 MCP 互换使用。后者会在本服务连接正常的情况下依然报「找不到 LookinServer」。请把 MCP 客户端指向本服务的 `dist/index.js`。

如果想和 Lookin macOS App 同时使用，请确保 iOS App 集成的是支持多客户端连接的 LookinServer。旧版 LookinServer 可能只保留最后一个连接，导致 Lookin App 和 MCP 互相挤掉。

实现参考了本仓库 `LookinClient/Connection` 里的 Lookin 客户端协议，并参考 [xiaoxiaowesley/lookin-mcp-peertalk](https://github.com/xiaoxiaowesley/lookin-mcp-peertalk)。
