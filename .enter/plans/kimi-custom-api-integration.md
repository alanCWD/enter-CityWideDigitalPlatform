# 接入自定义 Kimi K3 API（绕开内置 AI 网关）

## Context（背景）

项目里已有的两个 AI 后端函数（`app-builder-ai`、`app-code-gen`）都走 Enter 内置 AI 网关（`https://api.enter.pro/code/api/v1/ai/messages`），用平台统一发放的 `AI_API_TOKEN_5831877fc23c` 令牌计费。

用户现在要接入**自己在 Moonshot 平台申请的 Kimi K3 凭证**（自定义 Base URL + 自己的 API Key），不经过 Enter 网关、不用平台计费，直接由后端函数转发到用户自己的兼容 OpenAI 格式的端点。这是一个独立于现有两个函数的新集成，本轮先实现「流式聊天 + 长上下文」，工具调用/多模型路由留待后续迭代。

## 技术方案

### 1. 凭证存储（Enter Cloud Secrets）
使用 `supabase_add_secret` 工具新增两个密钥（用户自己的凭证，非 Stripe，非 Enter AI 网关令牌）：
- `KIMI_API_KEY` — Moonshot / 自定义端点的 API Key
- `KIMI_API_BASE_URL` — 用户自定义的 Base URL（如 `https://api.moonshot.ai/v1` 或自建代理地址），后端函数会拼接 `/chat/completions`

两者都在后端函数里通过 `Deno.env.get()` 读取，缺一即报错，不做静默兜底。

### 2. 新建后端函数 `supabase/functions/kimi-chat/index.ts`
- 独立于 `app-builder-ai` / `app-code-gen`，专门服务这个自定义 Kimi 集成。
- 请求体：`{ messages: {role, content}[], model?: string, max_tokens?: number, temperature?: number }`
  - `model` 默认值给一个占位（如 `"kimi-k3"`），允许前端覆盖，因为这是用户自己部署/代理的端点，模型名由用户的服务决定，不在 Enter 模型表里。
  - `max_tokens` 默认调大（如 8192）以支持长上下文场景。
- 用 `fetch` 转发到 `${KIMI_API_BASE_URL}/chat/completions`，`Authorization: Bearer ${KIMI_API_KEY}`，`stream: true`，走 OpenAI Chat Completions 协议（`choices[0].delta.content` 增量、`data: [DONE]` 结束）。
- 直接把上游的 SSE `response.body` 透传给前端（成功路径零转换，最大程度还原“长上下文”下的流式表现）。
- 失败路径：读取上游响应文本，尝试解析 OpenAI 风格的 `{error:{message,type}}`，包装成 `event: error\ndata: {...}\n\n` 返回，状态码原样透传，风格与仓库里现有函数一致。
- CORS 头沿用项目现有模式（`authorization, x-client-info, apikey, content-type`）。

### 3. 新建前端 Hook `src/hooks/useKimiChat.ts`
- 参考 `useCodeGen.ts` 的手写 `ReadableStream` 解析方式（而非 `fetchEventSource`），因为目标是用户自定义端点，返回内容类型/合规性不一定像 Enter 网关那么严格，手写 reader 更宽容。
- 维护 `messages`（role/content 数组，含流式中的 assistant 占位消息）、`isGenerating`、`error`。
- 解析 `chat.completion.chunk`：累加 `choices[0].delta.content`；遇到 `data: [DONE]` 或 `finish_reason` 结束流。
- 错误优先读取后端返回的 `error.message`，为空时用固定兜底文案（网络错误/服务不可用等）。
- 从 `@/integrations/supabase/client` 导入 `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` 调用 `/functions/v1/kimi-chat`（不改 `client.ts`）。

### 4. 新建前端页面 `src/pages/dashboard/KimiConsole.tsx`
- 一个独立的聊天/测试页面：消息气泡列表 + 输入框 + 发送/停止按钮 + 清空对话。
- 顶部说明区标注「使用你自己的 Kimi API Key（自定义端点），不经过内置 AI 网关计费」。
- 允许在页面上填写/覆盖 `model` 名称（文本输入，默认给一个占位值），因为端点和模型都是用户自定义的。
- UI 结构复用 `DashboardLayout` + `TopBar`，风格参照 `Builder.tsx` 的卡片布局，避免另起一套样式。

### 5. 路由与导航
- `src/router.tsx`：新增 `/dashboard/kimi` 路由，包在现有 `<Auth>` 包裹器里。
- `src/lib/agencies.ts`：在 `citywide`（主/内部工具向的 agency）导航项里加一条「Kimi AI」入口（新图标，如 `Bot` 或 `Sparkles`），放在 App Builder 附近。其余三个 agency（legacy_leaf / foodiio / oneprofile）不加，保持面向终端客户的导航干净。

## 需要复用的既有内容
- 后端函数错误信封 + CORS header 写法：`supabase/functions/app-builder-ai/index.ts`
- 手写 SSE reader 解析范式：`src/hooks/useCodeGen.ts`
- Supabase URL/Key 获取方式：`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`（已从 `client.ts` 导出）
- 导航/路由挂载方式：`src/router.tsx` + `src/lib/agencies.ts` + `Sidebar.tsx`（无需改 Sidebar 本身）

## Implementation checklist
- [ ] 用 `supabase_add_secret` 新增 `KIMI_API_KEY`
- [ ] 用 `supabase_add_secret` 新增 `KIMI_API_BASE_URL`
- [ ] 新建 `supabase/functions/kimi-chat/index.ts`：读取两个 secret，缺失即报错并返回 SSE error
- [ ] `kimi-chat` 转发到 `${KIMI_API_BASE_URL}/chat/completions`，`stream: true`，透传成功响应体
- [ ] `kimi-chat` 失败路径解析上游 OpenAI 风格错误并包装为 `event: error` SSE，状态码透传
- [ ] 新建 `src/hooks/useKimiChat.ts`：手写 reader 解析 `chat.completion.chunk`，处理 `[DONE]`、`finish_reason`、错误事件
- [ ] 新建 `src/pages/dashboard/KimiConsole.tsx`：聊天界面 + 可覆盖 model 名称输入 + 停止/清空
- [ ] `src/router.tsx` 新增 `/dashboard/kimi` 路由（`<Auth>` 包裹）
- [ ] `src/lib/agencies.ts` 的 `citywide` 导航加入「Kimi AI」入口

## Verification checklist
- [ ] 未配置任一 secret 时，调用 `kimi-chat` 返回明确的 SSE error（而不是 500 无信息）
- [ ] 配置正确 Key/Base URL 后，在 `/dashboard/kimi` 发送消息能看到流式输出逐字出现
- [ ] 上游返回错误（如 401/429）时，前端能展示后端透传的具体错误文案，而不是通用 "Request failed: xxx"
- [ ] 长输入（模拟长上下文，如粘贴长文本）请求不因 `max_tokens` 过小被截断
- [ ] 中途点击「停止」能正确 abort 请求，不留下卡死的 loading 状态
- [ ] 切换到其他三个 agency（legacy_leaf/foodiio/oneprofile）时侧边栏不出现「Kimi AI」入口，`citywide` 下正常出现且可跳转
- [ ] `pnpm run build` 与 lint 通过
