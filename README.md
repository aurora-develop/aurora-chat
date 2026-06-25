# Aurora Chat

一个为 [Aurora](https://github.com/xxxxx/aurora) 后端服务打造的现代化 Web 前端，采用极简未来主义设计风格，参考 Apple 与 ChatGPT 的视觉语言。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite)

## 功能特性

- 💬 **聊天对话**：支持 SSE 流式响应、Markdown 渲染、代码高亮、文件上传问答
- 🖼️ **图片生成**：文生图、改图、图生图，支持 URL / Base64 返回
- 🔊 **语音功能**：文字转语音（TTS）、语音转文字（STT）、音频翻译
- ⚙️ **灵活认证**：支持直接输入 Access Token，或通过 Refresh / Session Token 换取
- 🌓 **深色模式**：自动跟随系统偏好，支持浅色 / 深色 / 跟随系统
- 📱 **响应式布局**：桌面端可折叠侧边栏，移动端抽屉式导航
- ⚡ **代码分割**：按路由懒加载，首屏加载更快

## 技术栈

- React 18 + TypeScript
- Vite 6
- Tailwind CSS
- Zustand（状态管理）
- lucide-react（图标）
- react-markdown + highlight.js（Markdown 与代码高亮）

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm 或 npm
- Aurora 后端服务运行在本地的 `http://localhost:8080`

### 安装依赖

```bash
cd D:\Node\new
pnpm install
# 或 npm install
```

### 开发运行

```bash
pnpm dev
# 或 npm run dev
```

打开浏览器访问 `http://localhost:3000`

### 生产构建

```bash
pnpm build
# 或 npm run build
```

构建产物位于 `dist/` 目录。

## 配置说明

### 后端地址

默认代理到本地 `http://localhost:8080`。如需修改，编辑 `vite.config.ts`：

```ts
server: {
  proxy: {
    '/api': {
      target: 'http://your-server:8080',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, '')
    }
  }
}
```

### API 基础地址

前端通过环境变量配置 API 基础地址（默认 `http://localhost:8080`）：

```env
VITE_API_BASE_URL=http://localhost:8080
```

创建 `.env` 文件并写入上述内容即可。

## 使用指南

1. 启动 Aurora 后端服务
2. 启动前端开发服务器
3. 浏览器打开 `http://localhost:3000`
4. 进入 **设置** 页面
5. 选择以下任一方式设置 Token：
   - **直接输入 Access Token**：粘贴 `access_token`、服务 key 或 device id
   - **Refresh Token**：输入 `refresh_token` 自动换取
   - **Session Token**：输入 `__Secure-next-auth.session-token` 自动换取
6. 返回聊天页面开始使用

## 支持的 Token 类型

| Token 类型 | 支持功能 |
|-----------|---------|
| 服务访问 key | 普通聊天 |
| ChatGPT access_token | 全部功能（聊天、文件、图片、语音） |
| UUID 免费 device id | 仅普通聊天 |

## 注意事项

- 文件上传、图片生成、TTS 等功能需要真实的 ChatGPT `access_token`
- 免费 UUID 账号仅支持普通聊天
- 后端服务需正确配置 CORS，Aurora 默认已启用

## License

MIT
