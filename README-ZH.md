# NousResearch 模型面板

[English](README.md)

一个用于浏览和对比 [NousResearch 推理 API](https://inference-api.nousresearch.com) 可用模型的单页仪表板。

在线演示：**https://ftzahao.github.io/NousResearchModelsPanel/**

## 功能特性

- **模型浏览** — 可搜索/筛选的卡片，展示定价、上下文长度、模态和基准测试数据
- **多选筛选** — 支持同时选择多个提供商和模态，并提供推理模型、免费模型开关
- **数据分析图表** — 价格对比、智能指数 vs 编程指数散点图、上下文分布、提供商饼图
- **模型选择** — 全选当前结果、追加到已有选择、清空选择，并可弹窗查看已选模型
- **配置导出** — 将所选模型预览并下载为多种工具配置格式（见下表）
- **货币切换** — 价格支持 CNY/USD 显示，可使用实时汇率（open.er-api.com）或自定义汇率
- **中英双语** — 中英文切换
- **深色/浅色主题** — 支持主题切换
- **响应式适配** — 移动端友好布局
- **自动刷新** — 每次加载自动从 NousResearch API 获取最新数据

## 导出格式

勾选模型后，在导出菜单中选择格式。每种格式对应一个工具的配置结构，下载前均可预览：

| 格式                                      | 输出文件                            | 目标工具                                                          |
| ----------------------------------------- | ----------------------------------- | ----------------------------------------------------------------- |
| Codex 接入配置                            | `codex-config.toml` + `models.json` | Codex CLI 服务商配置 + 模型目录（已针对 CLI 0.154.0 实测验证）    |
| GitHub Copilot `gcmp.compatibleModels`    | `gcmp-compatible-models.json`       | Copilot GCMP 兼容模型条目                                         |
| GitHub Copilot `chatLanguageModels.json`  | `chatLanguageModels.json`           | Copilot 自定义端点提供商（`customendpoint` / `chat-completions`） |
| ZCode `v2/config.json` provider           | `zcode-providers.json`              | ZCode OpenAI 兼容提供商条目                                       |
| DeepSeek Harness `settings.yaml` provider | `dsh-llm-pi-ai.yaml`                | DeepSeek Harness `llm-pi-ai` 提供商（YAML）                       |

所有转换逻辑集中在 `src/model-export.ts`。ZCode 与 DeepSeek Harness 导出使用固定提供商 id（`nous`），重复导入时覆盖同一条目而非新增。

## 技术栈

Bun + React 19 + Recharts + Tailwind CSS v4（通过 `bun-plugin-tailwind` 本地编译）+ Lucide Icons + BigNumber.js + YAML

## 项目结构

- `index.ts` — Bun 服务器（8092 端口，热重载），提供带缓存的 `/api/models` 上游代理
- `index.html` — HTML 入口：Tailwind 样式表引用、主题 CSS 变量、响应式覆盖样式
- `src/root.tsx` — React 挂载入口
- `src/app.tsx` — 主 `App` 组件：状态、筛选/排序、选择逻辑、导出器注册
- `src/components/` — `Header`、`StatsGrid`/`StatCard`、`FilterBar`、`ModelCard`、`ExportToolbar`、`ExportPreviewModal`、`SelectedModelsModal`、`Footer`、`charts.tsx`
- `src/hooks/` — `useModels.ts`（模型获取）、`useCurrency.ts`（货币与汇率状态）
- `src/model-export.ts` — 模型选择 → 各导出格式的转换逻辑
- `src/model-export.test.ts` — 导出构造器测试（`bun test`）
- `src/contexts.tsx`、`src/i18n.ts`、`src/types.ts`、`src/utils.ts` — 主题/货币 Context、翻译、共享类型、工具函数
- `build.sh` — 静态构建脚本（将前端打包进 `docs/`）

## 本地开发

```bash
bun install
bun run dev
```

启动后访问 `http://localhost:8092`，支持热重载。

## 测试与类型检查

```bash
bun test
bun run typecheck
```

## 构建

```bash
bun run build
```

执行 `build.sh`，通过 `build.ts`（`Bun.build` + `bun-plugin-tailwind`）将 `index.html`、`src/root.tsx` 与 Tailwind CSS 打包为静态资源输出到 `docs/`。`docs/` 输出已被 gitignore，由 CI 构建，不提交到仓库。

## 部署到 GitHub Pages

项目已配置 GitHub Actions 工作流（`.github/workflows/deploy.yml`），每次推送到 `main` 分支时自动构建和部署。

1. 在 GitHub 仓库进入 **Settings → Pages**
2. **Source** 选择 **GitHub Actions**
3. 推送到 `main` — 自动开始部署
