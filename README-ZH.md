# NousResearch 模型面板

一个用于浏览和对比 [NousResearch 推理 API](https://inference-api.nousresearch.com) 可用模型的单页仪表板。

在线演示：**https://ftzahao.github.io/NousResearchModelsPanel/**

## 功能特性

- **模型浏览** — 可搜索/筛选的卡片，展示定价、上下文长度、模态和基准测试数据
- **数据分析图表** — 价格对比、智能指数 vs 编程指数散点图、上下文分布、提供商饼图
- **中英双语** — 中英文切换
- **深色/浅色主题** — 支持主题切换
- **自动刷新** — 每次加载自动从 NousResearch API 获取最新数据

## 技术栈

Bun + React 19 + Recharts + Tailwind CSS + Lucide Icons

## 本地开发

```bash
bun install
bun run dev
```

启动后访问 `http://localhost:8092`，支持热重载。

## 构建

```bash
bun run build
```

静态文件输出到 `docs/` 目录。

## 部署到 GitHub Pages

项目已配置 GitHub Actions 工作流（`.github/workflows/deploy.yml`），每次推送到 `main` 分支时自动构建和部署。

1. 在 GitHub 仓库进入 **Settings → Pages**
2. **Source** 选择 **GitHub Actions**
3. 推送到 `main` — 自动开始部署
