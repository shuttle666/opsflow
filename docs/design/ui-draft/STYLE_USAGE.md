# draft 样式参考使用说明

这个目录用于把当前项目的前端视觉风格，作为你主项目的样式参考输入给 AI。

## 1. 目录内容

已放入的核心参考文件：

- tailwind.config.js
- src/index.css
- src/App.css
- src/components/layout/Layout.tsx
- src/components/layout/Sidebar.tsx
- src/components/layout/Header.tsx
- src/components/common/StatsCard.tsx
- src/components/dashboard/JobsSchedule.tsx
- src/components/dashboard/RecentActivity.tsx
- src/pages/Dashboard.tsx
- src/pages/SignIn.tsx

说明：

- 这些文件覆盖了设计令牌、全局样式、布局骨架、代表性组件、完整页面样本。
- 不包含 dist 打包产物，避免噪音。

## 2. 在主项目里如何使用

建议把这个 draft 目录当作 "风格源"，让 AI 在改造主项目页面前先读取这些文件。

推荐优先级：

1) 先读 tailwind.config.js、src/index.css、src/App.css
2) 再读 layout 目录下 3 个文件
3) 再读 common/dashboard 组件
4) 最后读 Dashboard.tsx、SignIn.tsx 看页面组合方式

## 3. 给 AI 的提示词模板

你可以在主项目里直接使用类似提示：

"请先参考 draft 目录中的样式文件，严格沿用其中的颜色、圆角、间距、阴影、排版层级和布局方式。优先对齐：
1. draft/tailwind.config.js
2. draft/src/index.css
3. draft/src/App.css
4. draft/src/components/layout/*
5. draft/src/components/common/StatsCard.tsx
6. draft/src/components/dashboard/*
7. draft/src/pages/Dashboard.tsx 与 SignIn.tsx
在不改变业务逻辑的前提下，只做 UI 样式和结构优化。"

## 4. 维护建议

- 当参考项目样式有更新时，只同步这些核心文件即可。
- 如果后续新增了高价值组件（例如表格、表单、弹窗），也建议复制到 draft/src/components 下。
- 保持文件路径稳定，便于 AI 长期复用同一套引用。
