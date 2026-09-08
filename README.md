# HOI4 Focus Tree Designer

![](./public/og.png)

A lightweight, browser-based focus tree editor for *Hearts of Iron IV* modders. Build and rearrange focus trees on a draggable canvas, model prerequisite and mutually exclusive relationships, then export game-ready focus scripts and localisation files.

The editor runs entirely in the browser. Your draft stays on your device unless you export or import files yourself.

## Features

- Drag-and-drop focus tree canvas with zoom, pan, keyboard nudging, and grid snapping
- Find focuses by name or ID and jump directly to the matching node
- Multi-select batch duration, row/column arrangement, safe deletion, and selection day totals
- Expandable validation issues with direct links to the affected nodes or project settings
- Editable absolute coordinates alongside relative focus coordinates
- HOI4-style prerequisites: AND between groups, OR within a group
- Complete mutually exclusive groups with bidirectional relationship handling
- Live validation for IDs, coordinates, broken references, cycles, and deadlocks
- Import existing `.txt` focus scripts and `.yml` localisation files
- Preserve unmanaged per-focus script fields such as icons, availability, bypasses, AI weights, and completion effects during TXT round trips
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

## Import behavior

The importer edits focus IDs, coordinates, duration, prerequisites, mutually exclusive links, and localisation. Other fields inside each imported `focus = { ... }` block—including icons, conditions, AI weights, comments, and completion effects—remain attached to that node and are written back on export. File-level content outside the imported focus tree is not part of the visual project, so keeping a source backup is still recommended.

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
- 按名称 / ID 搜索并定位国策
- 多选批量修改天数、排成一行 / 一列、删除及所选天数统计；批量操作可一步撤销
- 展开全部校验问题，点击定位相关国策或项目设置
- 国策 ID、名称、描述、天数与绝对坐标编辑，以及相对坐标显示
- 前置条件、互斥关系与循环/死锁检查
- TXT 国策脚本与 YML 本地化文件导入导出
- TXT 往返编辑时保留每个国策内的图标、条件、AI 权重、注释与完成效果等非编辑字段
- 浏览器本地自动保存、撤销、重做与代码预览
- 中文和英文界面，以及多语言本地化导出

导入后，编辑器只重建国策 ID、坐标、天数、前置与互斥等可视化字段；每个 `focus = { ... }` 内的图标、条件、AI 权重、注释和完成效果等其他内容会随节点保留，并在导出时写回。文件中位于所导入国策树之外的内容不属于可视化项目，因此仍建议保留原文件备份。

本项目是社区制作的 Mod 工具，与 Paradox Interactive 无隶属或官方认可关系。

## Editing shortcuts / 编辑快捷键

| Action / 操作 | Shortcut / 快捷键 |
| --- | --- |
| Pan the canvas / 平移画布 | Left-drag blank canvas / 空白处左键拖动 |
| Box selection / 框选 | Ctrl / Cmd + left-drag / 左键拖动 |
| Add or remove one node / 增减单个选择 | Shift + click / 点击 |
| Select all / 全选 | Ctrl / Cmd + A |
| Find a focus / 查找国策 | Ctrl / Cmd + F; Enter locates the first result / Enter 定位首项 |
| Move selection / 移动所选节点 | Arrow keys / 方向键; Shift moves 2 units / Shift 移动 2 格 |
| Delete selection / 删除所选节点 | Delete / Backspace |
| Undo / 撤销 | Ctrl / Cmd + Z |
| Redo / 重做 | Ctrl / Cmd + Shift + Z, or Ctrl / Cmd + Y |
| Save draft / 保存草稿 | Ctrl / Cmd + S |
| Clear selection / 取消选择 | Escape |

Move and delete shortcuts apply only while the canvas or a node has keyboard focus. Text fields keep native text editing and undo. A batch operation creates one undo step. Row/column arrangement keeps spatial order with a spacing of 2 units, using the last clicked node's row or column; other nodes stay in place. Selection duration includes mutually exclusive nodes and is not a playable route duration.

移动和删除快捷键仅在画布或节点获得键盘焦点时生效，输入框保留原生文字编辑和撤销。每次批量操作只产生一条撤销记录。排成一行 / 一列时，保持空间顺序，使用最后点击节点所在的行 / 列，间隔 2 格；其他节点保持原位。所选天数包含互斥国策，不代表可游玩路线的完成时间。单节点属性内可展开查看保留的原始效果与条件脚本。
