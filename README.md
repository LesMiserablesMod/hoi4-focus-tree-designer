# HOI4 国策树设计器

一个纯前端的 Hearts of Iron IV 国策树编辑器。支持拖拽画布、相对坐标、AND/OR 前置条件、完整互斥组，以及 TXT/YML 导入导出。

## 在线使用

GitHub Pages：<https://lesmiserablesmod.github.io/hoi4-focus-tree-designer/>

## 本地运行

```bash
npm ci
npm run dev
```

## 构建

```bash
npm run build
```

静态文件会生成到 `out/`。推送到 `main` 后，GitHub Actions 会自动部署到 GitHub Pages。
