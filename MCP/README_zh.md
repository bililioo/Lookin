# Lookin MCP

这是 Lookin 的 MCP (Model Context Protocol) 服务。它通过 Lookin macOS 客户端同款 Peertalk 协议直连集成了 LookinServer 的 iOS App，让 MCP 客户端可以用工具调用读取 UI 层级、属性和截图。

这个包放在 Lookin 仓库内，按源码构建使用。

## 前置条件

iOS App 需要在 Debug 配置下集成 [LookinServer](https://github.com/QMUI/LookinServer)。

```ruby
pod 'LookinServer', :configurations => ['Debug']
```

Swift 项目可以使用：

```ruby
pod 'LookinServer', :subspecs => ['Swift'], :configurations => ['Debug']
```

Swift Package Manager：

```text
https://github.com/QMUI/LookinServer/
```

## 构建

```bash
cd Lookin/MCP
npm install
npm run build
```

## 配置 MCP 客户端

使用构建后的 `dist/index.js`：

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

开发模式可以不构建：

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

扫描 LookinServer 端口范围，列出可检查的运行中 App。返回值包含连接所需的 `portKey`。

`lookin_connect_app`

通过 `portKey` 连接指定 App。

`lookin_get_hierarchy`

返回已连接 App 的 UI 层级。节点包含 `oid`、`className`、`frame`、`children` 等字段。`oid` 可以继续传给属性和截图工具。

`lookin_get_attributes`

通过 `oid` 返回节点的分组属性。

`lookin_get_screenshot`

通过 `oid` 返回节点截图，格式为 base64 PNG/JPEG。不传 `oid` 时，会从层级里选择一个可见截图目标。

## 常用流程

```text
lookin_list_devices -> lookin_list_apps -> lookin_connect_app -> lookin_get_hierarchy -> lookin_get_attributes / lookin_get_screenshot
```

## 说明

模拟器 App 通过 `127.0.0.1:47164-47169` 连接。

USB 真机 App 通过 usbmuxd 连接 `47175-47179` 端口。

实现参考了本仓库 `LookinClient/Connection` 里的 Lookin 客户端协议，并参考 [xiaoxiaowesley/lookin-mcp-peertalk](https://github.com/xiaoxiaowesley/lookin-mcp-peertalk)。
