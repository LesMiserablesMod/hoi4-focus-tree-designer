# HOI4 Focus Tree Designer

![](public\og.png)

A lightweight, browser-based focus tree editor for *Hearts of Iron IV* modders. Build and rearrange focus trees on a draggable canvas, model prerequisite and mutually exclusive relationships, then export game-ready focus scripts and localisation files.

The editor runs entirely in the browser. Your draft stays on your device unless you export or import files yourself.

## Features

- Drag-and-drop focus tree canvas with zoom, pan, keyboard nudging, and grid snapping
- Absolute and relative focus coordinates
- HOI4-style prerequisites: AND between groups, OR within a group
- Complete mutually exclusive groups with bidirectional relationship handling
- Live validation for IDs, coordinates, broken references, cycles, and deadlocks
- Import existing `.txt` focus scripts and `.yml` localisation files
- Export focus scripts and UTF-8 BOM localisation files
- Local browser autosave, undo, redo, duplicate, and code preview
- Chinese and English interfaces
- Localisation export for English, French, German, Polish, Brazilian Portuguese, Russian, Spanish, Japanese, Simplified Chinese, and Korean

## Quick start

1. Open the online editor.
2. Select a focus to edit its ID, name, description, duration, and relationships.
3. Drag nodes to arrange the tree, or use relative coordinates for stable layouts.
4. Check the validation panel and resolve any reported errors.
5. Export the focus script and localisation file into your mod.

Typical output paths:

```text
common/national_focus/<focus_tree>.txt
localisation/<language>/<focus_tree>_l_<language>.yml
```

## Import limitations

The importer is intentionally focused on tree layout and relationships. It reads focus IDs, coordinates, prerequisites, mutually exclusive links, and localisation. Advanced effects, icons, comments, and unsupported script blocks are not preserved during a round trip, so keep a backup of the original mod files.

## Run locally

Requirements: Node.js 22 or newer.

```bash
npm ci
npm run dev
```

Then open the local address printed by Next.js.

## Build

```bash
npm run build
```

The static site is generated in `out/`. Pushes to `main` are deployed to GitHub Pages by GitHub Actions.

## 中文说明

HOI4 国策树设计器是一款纯前端、可在浏览器中使用的《钢铁雄心 IV》Mod 辅助工具。你可以在可拖拽画布上规划国策树，设置相对坐标、AND/OR 前置条件与完整互斥组，并导入或导出游戏使用的 TXT/YML 文件。

主要功能包括：

- 拖拽、缩放、平移与网格吸附
- 国策 ID、名称、描述、天数与坐标编辑
- 前置条件、互斥关系与循环/死锁检查
- TXT 国策脚本与 YML 本地化文件导入导出
- 浏览器本地自动保存、撤销、重做与代码预览
- 中文和英文界面，以及多语言本地化导出

请注意：导入器主要处理布局和关系，高级效果、图标、注释及暂不支持的脚本块不会在再次导出时保留。编辑现有 Mod 前，请先备份原文件。

本项目是社区制作的 Mod 工具，与 Paradox Interactive 无隶属或官方认可关系。
