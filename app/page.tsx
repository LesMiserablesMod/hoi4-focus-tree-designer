"use client";

import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  Clipboard,
  Compass,
  Copy,
  Download,
  FileCode2,
  FileText,
  Focus,
  Github,
  Languages,
  Link2,
  LocateFixed,
  Map as MapIcon,
  Maximize2,
  Minus,
  Monitor,
  Moon,
  MousePointer2,
  Plus,
  Redo2,
  Save,
  Search,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
  Settings2,
  Sun,
  Trash2,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Image from "next/image";
import {
  ChangeEvent,
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  buildForcedCompletionMap,
  buildFocusRelationLines,
  completeMutualGroups,
  normalizeFocusRelations,
  prerequisiteBackupAfterManualEdit,
  prerequisiteGroupsAreFullyMutual,
  restoreAutoMergedPrerequisiteGroups,
  synchronizeMutualPairs,
} from "./focus-relations";
import {
  findAvailableNodePosition,
  GRID_X,
  GRID_Y,
  NODE_H,
  NODE_W,
} from "./canvas-layout";
import {
  renderImportedTree,
  renameFocusReferences,
  renderFocusScriptBlock,
} from "./hoi4-script";

import { readFocusTree, uniqueFocusId, reservedFocusIds, decodeLocalisation, type SourceValues } from "./focus-file";

import { arrangeSelection, findFocuses, removeSelection, setSelectionDays } from "./editor-actions";

type FocusNode = {
  uid: string;
  id: string;
  name: string;
  description: string;
  days: number;
  absX: number;
  absY: number;
  prerequisiteGroups: string[][];
  prerequisiteGroupsBeforeMutualMerge?: string[][];
  mutuallyExclusiveUids: string[];
  relativeToUid: string | null;
  artwork: number;
  /** Focus fields that the visual editor does not manage, retained on import. */
  scriptExtras?: string;
  sourceId?: string;
  sourceValues?: SourceValues;
};

type UiLanguage = "zh-CN" | "en";
type ThemeMode = "light" | "dark" | "system";

const DEFAULT_UI_LANGUAGE: UiLanguage = "zh-CN";
const UI_LANGUAGE_STORAGE_KEY = "hoi4-focus-tree-ui-language";
const THEME_STORAGE_KEY = "hoi4-focus-tree-theme";

const LOCALISATION_LANGUAGES = [
  { code: "english", labels: { "zh-CN": "英语（English）", en: "English" } },
  { code: "french", labels: { "zh-CN": "法语（Français）", en: "French" } },
  { code: "german", labels: { "zh-CN": "德语（Deutsch）", en: "German" } },
  { code: "polish", labels: { "zh-CN": "波兰语（Polski）", en: "Polish" } },
  { code: "braz_por", labels: { "zh-CN": "巴西葡萄牙语（Português do Brasil）", en: "Portuguese (Brazil)" } },
  { code: "russian", labels: { "zh-CN": "俄语（Русский）", en: "Russian" } },
  { code: "spanish", labels: { "zh-CN": "西班牙语（Español）", en: "Spanish" } },
  { code: "japanese", labels: { "zh-CN": "日语（日本語）", en: "Japanese" } },
  { code: "simp_chinese", labels: { "zh-CN": "简体中文", en: "Simplified Chinese" } },
  { code: "korean", labels: { "zh-CN": "韩语（한국어）", en: "Korean" } },
] as const;

type LocalisationLanguage = (typeof LOCALISATION_LANGUAGES)[number]["code"];

const DEFAULT_LOCALISATION_LANGUAGE: LocalisationLanguage = "english";

function isLocalisationLanguage(value: unknown): value is LocalisationLanguage {
  return typeof value === "string" && LOCALISATION_LANGUAGES.some((language) => language.code === value);
}

function isUiLanguage(value: unknown): value is UiLanguage {
  return value === "zh-CN" || value === "en";
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function localisationSettings(language: LocalisationLanguage) {
  return LOCALISATION_LANGUAGES.find((item) => item.code === language) ?? LOCALISATION_LANGUAGES[0];
}

function localisationLabel(language: LocalisationLanguage, uiLanguage: UiLanguage) {
  return localisationSettings(language).labels[uiLanguage];
}

function detectLocalisationLanguage(text: string): LocalisationLanguage | null {
  const match = text.replace(/^\uFEFF/, "").match(/^\s*l_([A-Za-z_]+)\s*:/m);
  return isLocalisationLanguage(match?.[1]) ? match[1] : null;
}

const UI_MESSAGES = {
  "zh-CN": {
    searchFocus: "查找国策",
    searchPlaceholder: "名称或 ID · Ctrl+F",
    searchResults: (count: number) => `${count} 个匹配 · Enter 定位首项`,
    noSearchResults: "没有匹配的国策，试试名称或 ID。",
    clearSearch: "清空搜索",
    batchProperties: "批量编辑",
    selectionSummary: (count: number, days: number) => `已选 ${count} 个国策 · 合计 ${days} 天`,
    selectionHelp: "Ctrl / Cmd + 拖动框选；Shift + 点击增减选择。",
    applyDays: "应用天数",
    batchDaysPlaceholder: "输入统一天数",
    arrangeRow: "排成一行",
    arrangeColumn: "排成一列",
    arrangeHelp: "保持空间顺序，间隔 2 格；使用最后点击节点所在的行或列。",
    focusSelection: "定位所选",
    clearSelection: "取消选择",
    deleteSelection: (count: number) => `删除所选 ${count} 个国策`,
    nodesRemoved: (count: number) => `已删除 ${count} 个国策，可用 Ctrl / Cmd + Z 撤销。`,
    batchUpdated: (count: number) => `已更新 ${count} 个国策，可一步撤销。`,
    selectionDaysHelp: "天数为所选节点之和，包含互斥国策。",
    issuesTitle: "检查问题",
    locateIssue: "定位相关国策",
    issueHelp: "点击问题可定位；错误会阻止导出，提醒供检查。",
    absoluteX: "绝对 X",
    absoluteY: "绝对 Y",
    preservedScript: "保留的原始脚本",
    preservedScriptHelp: "以下效果、条件等内容会随国策保留并导出。",
    pageTitle: "HOI4 国策树设计器",
    appTitle: "国策树设计器",
    organizationGithub: "访问 Les Misérables Mod 组织 GitHub 首页",
    projectGithub: "查看本项目的 GitHub 仓库",
    themeMode: "显示主题",
    lightTheme: "日间模式",
    darkTheme: "夜间模式",
    systemTheme: "跟随系统",
    interfaceLanguage: "界面语言",
    chineseInterface: "中文界面",
    englishInterface: "English interface",
    viewMode: "视图模式",
    canvas: "画布",
    codePreview: "代码预览",
    saving: "保存中",
    saved: "已保存",
    undo: "撤销",
    redo: "重做",
    save: "保存草稿",
    backupProject: "下载工程备份",
    backupHelp: "JSON 保留布局、关系、原始脚本与当前本地化，可再次导入。",
    sourceTreeHelp: "保留原文件的国家条件、树级设置与其他国策树；国家 TAG 仅供查看。",
    importedStructureHelp: "导入的关系保持原样。编辑前置或互斥时才重新计算 OR 汇合。",
    idReferenceHelp: "改 ID 会同步当前文件内可识别的国策引用；其他文件的引用需自行同步。",
    copyFocus: "复制 TXT",
    copyLocalisation: "复制 YML",
    copiedFile: "当前文件已复制。",
    importChoiceError: "一次导入一份 TXT（或工程 JSON）和同一语言的 YML，避免遗漏文件。",
    projectImported: "工程备份已恢复。",
    saveFailed: "未保存",
    invalidCoordinates: (id: string) => `${id}：坐标必须是有限整数`,
    import: "导入",
    addFocus: "添加国策",
    focusProperties: "国策属性",
    focusId: "国策 ID",
    localisationName: "本地化名称",
    localisationDescription: "本地化描述",
    completionDays: "完成天数",
    prerequisiteGroups: "前置国策",
    prerequisiteLogic: "组内 OR · 组间 AND",
    addFirstPrerequisite: "添加前置国策",
    addAndGroup: "添加 AND 条件",
    prerequisiteHelp: "同一条件组内任选其一（OR）；不同条件组必须全部满足（AND）。互斥分支会自动归入同一 OR 组。",
    noPrerequisite: "暂无前置国策",
    and: "并且",
    conditionGroup: (index: number) => `条件组 ${index}`,
    anyCompleteOr: "任一完成 OR",
    mustComplete: "必须完成",
    deletePrerequisiteGroup: (index: number) => `删除前置条件组 ${index}`,
    removePrerequisite: (name: string) => `移除前置国策 ${name}`,
    addPrerequisite: (index: number) => `向前置条件组 ${index} 添加国策`,
    addOrAlternative: "添加 OR 备选",
    choosePrerequisite: "选择前置国策",
    mutualFocusGroup: "互斥国策组",
    mutualLogic: "组内两两互斥",
    mutualHelp: "组内每个国策都会显式列出其余全部成员，符合游戏引擎的读取方式。",
    removeMutual: (name: string) => `移除互斥国策 ${name}`,
    addMutual: "添加互斥国策",
    joinMutualGroup: "加入互斥组",
    noMutual: "尚未设置互斥关系",
    relativeTo: "坐标相对于",
    canvasOrigin: "画布原点",
    relativeX: "相对 X",
    relativeY: "相对 Y",
    dragToEditCoordinates: "拖动节点即可修改坐标",
    duplicate: "复制",
    delete: "删除",
    chooseFocus: "选择一个国策",
    chooseFocusHelp: "点击画布节点以编辑 ID、名称、描述与关系。",
    draggableCanvas: "可拖拽国策树画布",
    focusCoordinate: (name: string, x: number, y: number) => `${name}，坐标 ${x}, ${y}`,
    unnamedFocus: "未命名国策",
    days: (value: number) => `${value} 日`,
    canvasHelp: "空白处左键平移 · Ctrl / Cmd + 左键框选 · 滚轮缩放",
    zoomControls: "缩放控制",
    zoomOut: "缩小",
    zoomIn: "放大",
    fitCanvas: "适应画布",
    gameFilePreview: "游戏文件预览",
    copyAll: "复制全部",
    download: "下载",
    navigationAndExport: "导航与导出",
    navigator: "导航器",
    totalDays: (value: number) => `共计 ${value} 天`,
    totalDaysHelp: "所有国策节点的完成天数合计（包含互斥国策）",
    fitAllFocuses: "点击适应全部国策",
    globalLayout: "全局布局图 · 点击适应全部节点",
    projectSettings: "项目设置",
    treeId: "国策树 ID",
    countryTag: "国家 TAG",
    localisationLanguage: "本地化语言",
    localisationLanguageNote: "切换语言会更新 YML 文件头、路径与文件名，但不会自动翻译已填写文本。",
    exportFiles: "导出文件",
    focusScript: "国策脚本",
    localisationExport: (language: string) => `${language}本地化`,
    copyTwoFiles: "复制两份文件内容",
    pasteFiles: "粘贴 TXT / YML 内容",
    importNote: "导入编辑第一棵国策树，保留树级配置与文件其余内容；同语言的多份 YML 会合并。",
    errorCount: (count: number) => `${count} 个错误`,
    warningCount: (count: number) => `${count} 个提醒`,
    readyToExport: "可以导出",
    projectSummary: (focuses: number, prerequisites: number, mutuals: number) => `${focuses} 个国策 · ${prerequisites} 条前置 · ${mutuals} 条互斥`,
    prerequisiteRelations: (count: number) => `${count} 条前置关系`,
    mutualRelations: (count: number) => `${count} 条互斥关系`,
    gridSnapOn: "网格吸附：开启",
    selectedFocus: (id: string) => `选中：${id}`,
    selectedFocusCount: (count: number) => `已选 ${count} 个节点 · 拖动任一节点可整组移动`,
    noSelectedFocus: "未选择节点",
    focusCount: (count: number) => `${count} 个国策`,
    closeToast: "关闭提示",
    textImport: "粘贴文本导入",
    closeTextImport: "关闭粘贴导入",
    focusTreeScriptFile: "国策树脚本（.txt）",
    optionalLocalisation: (language: string) => `${language}本地化（可选）`,
    focusNamePlaceholder: "国策名称",
    importModalWarning: "导入会替换当前画布，可立即撤销。先下载工程备份可随时恢复；树级配置、其他树与效果会保留。",
    cancel: "取消",
    parseAndImport: "解析并导入",
    damagedDraft: "本地草稿已损坏，已恢复示例国策树。",
    autosaveUnavailable: "浏览器无法保存本地草稿，请及时导出。",
    newFocusName: "新国策",
    newFocusDescription: "在这里填写国策描述。",
    newFocusCreated: "已创建新国策，可直接拖到目标位置。",
    copySuffix: "（副本）",
    keepOneFocus: "至少保留一个国策节点。",
    nodeRemoved: "节点及其引用已安全移除。",
    mutualPrerequisitesMerged: "检测到互斥前置，已自动合并为同一个 OR 条件组。",
    mutualPrerequisitesRestored: "互斥关系已取消，原来的 AND 前置条件组已恢复。",
    importedFocuses: (count: number) => `已导入 ${count} 个国策，并保留各节点原有的效果、条件、图标与注释。`,
    missingLocalisationHeader: "本地化缺少受支持的 l_<language>: 文件头",
    unsupportedLanguageCode: "本地化文件使用了尚不支持的语言代码",
    localisationMerged: (language: string) => `${language}本地化已按国策 ID 合并。`,
    noRecognizedImport: "未识别到 focus_tree 或本地化内容",
    importFailed: (message: string) => `导入失败：${message}`,
    unrecognizedText: "文本格式无法识别",
    unrecognizedFile: "文件格式无法识别",
    resolveErrorsBeforeExport: (count: number) => `请先处理 ${count} 个错误，再导出文件。`,
    focusExported: "国策脚本 TXT 已生成。",
    localisationExported: (language: string) => `${language}本地化 YML 已生成（UTF-8 BOM）。`,
    copiedToClipboard: "脚本与本地化已复制到剪贴板。",
    clipboardDenied: "浏览器未允许读取剪贴板，请使用下载按钮。",
    draftSaved: "草稿已保存在当前浏览器。",
    draftSaveFailed: "浏览器无法保存草稿。",
    missingClosingBrace: (key: string) => `${key} 块缺少右花括号`,
    noFocusTree: "没有找到 focus_tree = { ... }",
    noFocusBlock: "国策树中没有找到 focus = { ... }",
    relativeCoordinateCycle: (id: string) => `检测到相对坐标循环：${id}`,
    invalidTreeId: "国策树 ID 为空或含无效字符",
    invalidCountryTag: "国家 TAG 为空或含无效字符",
    missingFocusId: "存在未填写 ID 的国策",
    invalidFocusId: (id: string) => `${id}：ID 应以字母或下划线开头，且只含字母、数字、下划线`,
    missingFocusName: (id: string) => `${id}：尚未填写名称`,
    invalidDays: (id: string) => `${id}：完成天数必须是非负数`,
    duplicateId: (id: string) => `${id}：ID 重复`,
    emptyPrerequisiteGroup: (id: string, index: number) => `${id}：前置条件组 ${index} 为空`,
    selfPrerequisite: (id: string) => `${id}：不能将自身设为前置国策`,
    invalidPrerequisiteReference: (id: string) => `${id}：前置国策引用已失效`,
    allPrerequisitesMutual: (id: string) => `${id}：某个前置条件组中的国策均与其互斥`,
    mutuallyExclusivePrerequisiteGroups: (id: string) => `${id}：互斥国策不能位于不同的 AND 前置组，请将它们放在同一个 OR 组`,
    selfMutual: (id: string) => `${id}：不能与自身互斥`,
    invalidMutualReference: (id: string) => `${id}：互斥国策引用已失效`,
    unsyncedMutual: (id: string) => `${id}：互斥关系未双向同步`,
    prerequisiteDeadlock: "前置条件存在无法满足的循环或死锁",
    relativeReferenceCycle: "相对坐标引用存在循环",
    coordinateOverlap: (ids: string[]) => `${ids.join("、")}：坐标重叠`,
  },
  en: {
    searchFocus: "Find a focus",
    searchPlaceholder: "Name or ID · Ctrl+F",
    searchResults: (count: number) => `${count} matches · Enter locates the first`,
    noSearchResults: "No matching focuses. Try a name or ID.",
    clearSearch: "Clear search",
    batchProperties: "Batch edit",
    selectionSummary: (count: number, days: number) => `${count} selected · ${days} days total`,
    selectionHelp: "Ctrl / Cmd + drag to select; Shift + click to add or remove.",
    applyDays: "Apply days",
    batchDaysPlaceholder: "Set completion days",
    arrangeRow: "Arrange in a row",
    arrangeColumn: "Arrange in a column",
    arrangeHelp: "Keeps spatial order, spaced by 2 units on the last clicked node’s row or column.",
    focusSelection: "Locate selection",
    clearSelection: "Clear selection",
    deleteSelection: (count: number) => `Delete ${count} selected focuses`,
    nodesRemoved: (count: number) => `Deleted ${count} focuses. Undo with Ctrl / Cmd + Z.`,
    batchUpdated: (count: number) => `Updated ${count} focuses. Undo in one step.`,
    selectionDaysHelp: "Sum for the selected nodes, including mutually exclusive focuses.",
    issuesTitle: "Issues",
    locateIssue: "Locate related focuses",
    issueHelp: "Click an issue to locate it. Errors block export; warnings need review.",
    absoluteX: "Absolute X",
    absoluteY: "Absolute Y",
    preservedScript: "Preserved script",
    preservedScriptHelp: "These effects and conditions stay attached and will be exported.",
    pageTitle: "HOI4 Focus Tree Designer",
    appTitle: "Focus Tree Designer",
    organizationGithub: "Visit the Les Misérables Mod organization on GitHub",
    projectGithub: "View this project on GitHub",
    themeMode: "Color theme",
    lightTheme: "Light theme",
    darkTheme: "Dark theme",
    systemTheme: "Follow system",
    interfaceLanguage: "Interface language",
    chineseInterface: "Chinese interface",
    englishInterface: "English interface",
    viewMode: "View mode",
    canvas: "Canvas",
    codePreview: "Code Preview",
    saving: "Saving",
    saved: "Saved",
    undo: "Undo",
    redo: "Redo",
    save: "Save draft",
    backupProject: "Download project backup",
    backupHelp: "JSON keeps layout, relations, source scripts and current localisation. Import it to restore.",
    sourceTreeHelp: "Original country conditions, tree settings and other trees are retained. The country tag is read-only.",
    importedStructureHelp: "Imported relations stay unchanged. Editing prerequisites or exclusions recalculates OR convergence.",
    idReferenceHelp: "Renaming updates recognized focus references in this file. Update references in other files separately.",
    copyFocus: "Copy TXT",
    copyLocalisation: "Copy YML",
    copiedFile: "File copied to clipboard.",
    importChoiceError: "Import one TXT (or project JSON) and YML files in one language at a time, so no files are skipped.",
    projectImported: "Project backup restored.",
    saveFailed: "Not saved",
    invalidCoordinates: (id: string) => `${id}: coordinates must be finite integers`,
    import: "Import",
    addFocus: "Add Focus",
    focusProperties: "Focus Properties",
    focusId: "Focus ID",
    localisationName: "Localisation Name",
    localisationDescription: "Localisation Description",
    completionDays: "Completion Days",
    prerequisiteGroups: "Prerequisite Focuses",
    prerequisiteLogic: "OR within groups · AND between groups",
    addFirstPrerequisite: "Add Prerequisite",
    addAndGroup: "Add AND Condition",
    prerequisiteHelp: "Complete any one focus within a group (OR); every separate group is required (AND). Mutually exclusive branches are merged into one OR group automatically.",
    noPrerequisite: "No prerequisites yet",
    and: "and",
    conditionGroup: (index: number) => `Group ${index}`,
    anyCompleteOr: "Any one · OR",
    mustComplete: "Required",
    deletePrerequisiteGroup: (index: number) => `Delete prerequisite group ${index}`,
    removePrerequisite: (name: string) => `Remove prerequisite ${name}`,
    addPrerequisite: (index: number) => `Add a focus to prerequisite group ${index}`,
    addOrAlternative: "Add OR Alternative",
    choosePrerequisite: "Choose Prerequisite",
    mutualFocusGroup: "Mutually Exclusive Group",
    mutualLogic: "Every pair is exclusive",
    mutualHelp: "Every focus explicitly lists every other member, matching how the game engine reads mutual exclusions.",
    removeMutual: (name: string) => `Remove mutually exclusive focus ${name}`,
    addMutual: "Add mutually exclusive focus",
    joinMutualGroup: "Join mutual group",
    noMutual: "No mutual exclusions set",
    relativeTo: "Coordinates relative to",
    canvasOrigin: "Canvas origin",
    relativeX: "Relative X",
    relativeY: "Relative Y",
    dragToEditCoordinates: "Drag the node to change its coordinates",
    duplicate: "Duplicate",
    delete: "Delete",
    chooseFocus: "Select a Focus",
    chooseFocusHelp: "Click a canvas node to edit its ID, localisation, and relationships.",
    draggableCanvas: "Draggable focus tree canvas",
    focusCoordinate: (name: string, x: number, y: number) => `${name}, coordinates ${x}, ${y}`,
    unnamedFocus: "Unnamed Focus",
    days: (value: number) => `${value} days`,
    canvasHelp: "Left-drag blank canvas to pan · Ctrl / Cmd + left-drag to select · Wheel to zoom",
    zoomControls: "Zoom controls",
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    fitCanvas: "Fit canvas",
    gameFilePreview: "Game File Preview",
    copyAll: "Copy All",
    download: "Download",
    navigationAndExport: "Navigation and export",
    navigator: "Navigator",
    totalDays: (value: number) => `Total ${value} ${value === 1 ? "day" : "days"}`,
    totalDaysHelp: "Sum of completion days for all focus nodes, including mutually exclusive focuses",
    fitAllFocuses: "Fit all focuses",
    globalLayout: "Full layout · Click to fit all nodes",
    projectSettings: "Project Settings",
    treeId: "Focus Tree ID",
    countryTag: "Country TAG",
    localisationLanguage: "Localisation Language",
    localisationLanguageNote: "Changing this updates the YML header, path, and filename. Existing text is not translated automatically.",
    exportFiles: "Export Files",
    focusScript: "Focus Script",
    localisationExport: (language: string) => `${language} Localisation`,
    copyTwoFiles: "Copy both file contents",
    pasteFiles: "Paste TXT / YML Content",
    importNote: "Import edits the first focus tree and retains other file content. Multiple YML files in the same language are merged.",
    errorCount: (count: number) => `${count} ${count === 1 ? "error" : "errors"}`,
    warningCount: (count: number) => `${count} ${count === 1 ? "warning" : "warnings"}`,
    readyToExport: "Ready to Export",
    projectSummary: (focuses: number, prerequisites: number, mutuals: number) => `${focuses} ${focuses === 1 ? "focus" : "focuses"} · ${prerequisites} ${prerequisites === 1 ? "prerequisite" : "prerequisites"} · ${mutuals} mutual ${mutuals === 1 ? "link" : "links"}`,
    prerequisiteRelations: (count: number) => `${count} prerequisite ${count === 1 ? "link" : "links"}`,
    mutualRelations: (count: number) => `${count} mutual ${count === 1 ? "link" : "links"}`,
    gridSnapOn: "Grid snap: On",
    selectedFocus: (id: string) => `Selected: ${id}`,
    selectedFocusCount: (count: number) => `${count} nodes selected · Drag any selected node to move the group`,
    noSelectedFocus: "No node selected",
    focusCount: (count: number) => `${count} ${count === 1 ? "focus" : "focuses"}`,
    closeToast: "Dismiss notification",
    textImport: "Paste Text Import",
    closeTextImport: "Close text import",
    focusTreeScriptFile: "Focus tree script (.txt)",
    optionalLocalisation: (language: string) => `${language} localisation (optional)`,
    focusNamePlaceholder: "Focus name",
    importModalWarning: "Import replaces this canvas and can be undone. Download a project backup to restore later. Tree settings, other trees and effects are retained.",
    cancel: "Cancel",
    parseAndImport: "Parse and Import",
    damagedDraft: "The local draft was damaged, so the example tree has been restored.",
    autosaveUnavailable: "This browser cannot save the local draft. Export your work to avoid losing it.",
    newFocusName: "New Focus",
    newFocusDescription: "Enter the focus description here.",
    newFocusCreated: "New focus created. Drag it to the desired position.",
    copySuffix: " (copy)",
    keepOneFocus: "Keep at least one focus node.",
    nodeRemoved: "The node and its references were removed safely.",
    mutualPrerequisitesMerged: "Mutually exclusive prerequisites were merged into the same OR group automatically.",
    mutualPrerequisitesRestored: "The mutual exclusion was removed, so the original AND prerequisite groups were restored.",
    importedFocuses: (count: number) => `Imported ${count} ${count === 1 ? "focus" : "focuses"} with their existing effects, conditions, icons, and comments retained.`,
    missingLocalisationHeader: "The localisation text needs a supported l_<language>: header",
    unsupportedLanguageCode: "The localisation file uses an unsupported language code",
    localisationMerged: (language: string) => `${language} localisation was merged by focus ID.`,
    noRecognizedImport: "No focus_tree or localisation content was recognized",
    importFailed: (message: string) => `Import failed: ${message}`,
    unrecognizedText: "The text format could not be recognized",
    unrecognizedFile: "The file format could not be recognized",
    resolveErrorsBeforeExport: (count: number) => `Resolve ${count} ${count === 1 ? "error" : "errors"} before exporting.`,
    focusExported: "Focus script TXT generated.",
    localisationExported: (language: string) => `${language} localisation YML generated with a UTF-8 BOM.`,
    copiedToClipboard: "The script and localisation were copied to the clipboard.",
    clipboardDenied: "Clipboard access was denied. Use the download buttons instead.",
    draftSaved: "Draft saved in this browser.",
    draftSaveFailed: "This browser could not save the draft.",
    missingClosingBrace: (key: string) => `${key} block is missing a closing brace`,
    noFocusTree: "No focus_tree = { ... } block was found",
    noFocusBlock: "No focus = { ... } block was found in the focus tree",
    relativeCoordinateCycle: (id: string) => `Relative coordinate cycle detected at ${id}`,
    invalidTreeId: "The focus tree ID is empty or contains invalid characters",
    invalidCountryTag: "The country TAG is empty or contains invalid characters",
    missingFocusId: "At least one focus has no ID",
    invalidFocusId: (id: string) => `${id}: IDs must start with a letter or underscore and contain only letters, numbers, and underscores`,
    missingFocusName: (id: string) => `${id}: localisation name is empty`,
    invalidDays: (id: string) => `${id}: completion days must be a non-negative number`,
    duplicateId: (id: string) => `${id}: duplicate ID`,
    emptyPrerequisiteGroup: (id: string, index: number) => `${id}: prerequisite group ${index} is empty`,
    selfPrerequisite: (id: string) => `${id}: a focus cannot be its own prerequisite`,
    invalidPrerequisiteReference: (id: string) => `${id}: a prerequisite reference is invalid`,
    allPrerequisitesMutual: (id: string) => `${id}: every focus in one prerequisite group is mutually exclusive with this focus`,
    mutuallyExclusivePrerequisiteGroups: (id: string) => `${id}: mutually exclusive focuses cannot be separate AND prerequisites; place them in the same OR group`,
    selfMutual: (id: string) => `${id}: a focus cannot be mutually exclusive with itself`,
    invalidMutualReference: (id: string) => `${id}: a mutually exclusive reference is invalid`,
    unsyncedMutual: (id: string) => `${id}: a mutual exclusion is not synchronized both ways`,
    prerequisiteDeadlock: "Prerequisites contain an unsatisfiable cycle or deadlock",
    relativeReferenceCycle: "Relative coordinate references contain a cycle",
    coordinateOverlap: (ids: string[]) => `${ids.join(", ")}: coordinates overlap`,
  },
} as const;

type UiMessages = (typeof UI_MESSAGES)[UiLanguage];

type ProjectState = {
  sourceText?: string;
  localisationExtras?: Record<string, string>;
  treeId: string;
  countryTag: string;
  localisationLanguage: LocalisationLanguage;
  nodes: FocusNode[];
};

type ViewState = { x: number; y: number; zoom: number };
type ToastState = { tone: "success" | "warning" | "error"; message: string } | null;

const WORLD_W = 1700;
const WORLD_H = 1180;
const ORIGIN_X = 740;
const ORIGIN_Y = 90;
const STORAGE_KEY = "hoi4-focus-tree-studio-v2";
const LEGACY_STORAGE_KEY = "hoi4-focus-tree-studio-v1";

const initialProject: ProjectState = {
  treeId: "TAG_national_focus",
  countryTag: "TAG",
  localisationLanguage: DEFAULT_LOCALISATION_LANGUAGE,
  nodes: [
    {
      uid: "root-rebuild",
      id: "TAG_national_reconstruction",
      name: "National Reconstruction",
      description: "Rebuild the institutions of state and lay a stable foundation for the nation's future.",
      days: 70,
      absX: 0,
      absY: 1,
      prerequisiteGroups: [],
      mutuallyExclusiveUids: [],
      relativeToUid: null,
      artwork: 0,
    },
    {
      uid: "industrial-recovery",
      id: "TAG_industrial_recovery",
      name: "Industrial Recovery",
      description: "Restore the industrial base and unlock new productive capacity.",
      days: 70,
      absX: -2,
      absY: 3,
      prerequisiteGroups: [["root-rebuild"]],
      mutuallyExclusiveUids: [],
      relativeToUid: "root-rebuild",
      artwork: 1,
    },
    {
      uid: "army-reform",
      id: "TAG_army_reform",
      name: "Army Reorganization",
      description: "Reorganize the armed forces and prepare the army for modernization.",
      days: 70,
      absX: 2,
      absY: 3,
      prerequisiteGroups: [["root-rebuild"]],
      mutuallyExclusiveUids: [],
      relativeToUid: "root-rebuild",
      artwork: 2,
    },
    {
      uid: "research-cooperation",
      id: "TAG_research_cooperation",
      name: "Research Cooperation",
      description: "Unite universities and industrial laboratories to accelerate technological progress.",
      days: 70,
      absX: -2,
      absY: 5,
      prerequisiteGroups: [["industrial-recovery"]],
      mutuallyExclusiveUids: [],
      relativeToUid: "industrial-recovery",
      artwork: 3,
    },
    {
      uid: "homeland-defense",
      id: "TAG_homeland_defense",
      name: "Homeland Defense",
      description: "Fortify the border and key strategic positions to establish a defense in depth.",
      days: 70,
      absX: 2,
      absY: 5,
      prerequisiteGroups: [["army-reform"]],
      mutuallyExclusiveUids: [],
      relativeToUid: "army-reform",
      artwork: 4,
    },
  ],
};

function cloneProject(project: ProjectState): ProjectState {
  return {
    ...project,
    nodes: project.nodes.map((node) => ({
      ...node,
      prerequisiteGroups: node.prerequisiteGroups.map((group) => [...group]),
      prerequisiteGroupsBeforeMutualMerge: node.prerequisiteGroupsBeforeMutualMerge
        ?.map((group) => [...group]),
      mutuallyExclusiveUids: [...node.mutuallyExclusiveUids],
    })),
  };
}

function normalizeProject(value: unknown): ProjectState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as {
    sourceText?: unknown;
    localisationExtras?: unknown;
    treeId?: unknown;
    countryTag?: unknown;
    localisationLanguage?: unknown;
    nodes?: unknown;
  };
  if (!Array.isArray(raw.nodes) || !raw.nodes.length) return null;

  const provisional = raw.nodes.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const node = item as Partial<FocusNode> & { prerequisiteUids?: unknown; mutuallyExclusiveUids?: unknown };
    if (typeof node.uid !== "string" || typeof node.id !== "string") return [];
    const groups = Array.isArray(node.prerequisiteGroups)
      ? node.prerequisiteGroups.filter(Array.isArray).map((group) => group.filter((uid): uid is string => typeof uid === "string"))
      : Array.isArray(node.prerequisiteUids)
        ? [node.prerequisiteUids.filter((uid): uid is string => typeof uid === "string")]
        : [];
    return [{
      uid: node.uid,
      id: node.id,
      name: typeof node.name === "string" ? node.name : node.id,
      description: typeof node.description === "string" ? node.description : "",
      days: Number.isFinite(node.days) ? Math.max(0, Number(node.days)) : 70,
      absX: Number.isFinite(node.absX) ? Number(node.absX) : 0,
      absY: Number.isFinite(node.absY) ? Number(node.absY) : 0,
      prerequisiteGroups: groups,
      prerequisiteGroupsBeforeMutualMerge: Array.isArray(node.prerequisiteGroupsBeforeMutualMerge)
        ? node.prerequisiteGroupsBeforeMutualMerge
          .filter(Array.isArray)
          .map((group) => group.filter((uid): uid is string => typeof uid === "string"))
        : undefined,
      mutuallyExclusiveUids: Array.isArray(node.mutuallyExclusiveUids)
        ? node.mutuallyExclusiveUids.filter((uid): uid is string => typeof uid === "string")
        : [],
      relativeToUid: typeof node.relativeToUid === "string" ? node.relativeToUid : null,
      artwork: Number.isFinite(node.artwork) ? Number(node.artwork) : 0,
      scriptExtras: typeof node.scriptExtras === "string" ? node.scriptExtras : undefined,
      sourceId: typeof node.sourceId === "string" ? node.sourceId : undefined,
      sourceValues: node.sourceValues,
    } satisfies FocusNode];
  });
  if (!provisional.length) return null;

  const validUids = new Set(provisional.map((node) => node.uid));
  const sanitizedNodes = provisional.map((node) => ({
    ...node,
    prerequisiteGroups: node.prerequisiteGroups
      .map((group) => [...new Set(group.filter((uid) => uid !== node.uid && validUids.has(uid)))])
      .filter((group) => group.length),
    prerequisiteGroupsBeforeMutualMerge: node.prerequisiteGroupsBeforeMutualMerge
      ?.map((group) => [...new Set(group.filter((uid) => uid !== node.uid && validUids.has(uid)))])
      .filter((group) => group.length),
    mutuallyExclusiveUids: [...new Set(node.mutuallyExclusiveUids.filter((uid) => uid !== node.uid && validUids.has(uid)))],
    relativeToUid: node.relativeToUid && node.relativeToUid !== node.uid && validUids.has(node.relativeToUid) ? node.relativeToUid : null,
  }));
  const nodes = typeof raw.sourceText === "string" ? sanitizedNodes : normalizeFocusRelations(sanitizedNodes);

  return {
    sourceText: typeof raw.sourceText === "string" ? raw.sourceText : undefined,
    localisationExtras: raw.localisationExtras && typeof raw.localisationExtras === "object" ? Object.fromEntries(Object.entries(raw.localisationExtras).filter((entry): entry is [string, string] => typeof entry[1] === "string")) : undefined,
    treeId: typeof raw.treeId === "string" ? raw.treeId : "custom_focus_tree",
    countryTag: typeof raw.countryTag === "string" ? raw.countryTag : "TAG",
    localisationLanguage: isLocalisationLanguage(raw.localisationLanguage)
      ? raw.localisationLanguage
      : DEFAULT_LOCALISATION_LANGUAGE,
    nodes,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function worldX(x: number) {
  return ORIGIN_X + x * GRID_X;
}

function worldY(y: number) {
  return ORIGIN_Y + y * GRID_Y;
}

function fittedView(nodes: FocusNode[], width: number, height: number): ViewState {
  if (!nodes.length) return { x: 0, y: 0, zoom: 1 };
  const left = Math.min(...nodes.map((node) => worldX(node.absX)));
  const right = Math.max(...nodes.map((node) => worldX(node.absX) + NODE_W));
  const top = Math.min(...nodes.map((node) => worldY(node.absY)));
  const bottom = Math.max(...nodes.map((node) => worldY(node.absY) + NODE_H));
  const zoom = clamp(Math.min((width - 80) / (right - left), (height - 100) / (bottom - top)), 0.08, 1.1);
  return { zoom, x: (width - (right - left) * zoom) / 2 - left * zoom, y: (height - (bottom - top) * zoom) / 2 - top * zoom };
}

function escapeLocalisation(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n");
}

function unescapeLocalisation(value: string) {
  return decodeLocalisation(value);
}

function safeToken(value: string, fallback: string) {
  const cleaned = value.trim().replace(/[^A-Za-z0-9_.:-]+/g, "_");
  return cleaned || fallback;
}

function focusCostFromDays(days: number) {
  return String(Number((Math.max(0, days) / 7).toFixed(6)));
}

function generateFocusScript(project: ProjectState) {
  const normalizedNodes = project.sourceText ? project.nodes : normalizeFocusRelations(project.nodes);
  const nodeByUid = new Map(normalizedNodes.map((node) => [node.uid, node]));
  const sorted = [...normalizedNodes].sort((a, b) => a.absY - b.absY || a.absX - b.absX);
  const treeId = safeToken(project.treeId, "custom_focus_tree");
  const tag = safeToken(project.countryTag.toUpperCase(), "TAG");

  const focuses = sorted
    .map((node) => {
      const anchor = node.relativeToUid ? nodeByUid.get(node.relativeToUid) : undefined;
      const x = anchor ? node.absX - anchor.absX : node.absX;
      const y = anchor ? node.absY - anchor.absY : node.absY;
      const relationLines = buildFocusRelationLines(node, nodeByUid);
      return { sourceId: node.sourceId, script: renderFocusScriptBlock({
        id: safeToken(node.id, "unnamed_focus"),
        x: node.sourceValues?.x && x === node.sourceValues.relativeX ? node.sourceValues.x : x,
        y: node.sourceValues?.y && y === node.sourceValues.relativeY ? node.sourceValues.y : y,
        relativePositionId: anchor?.id,
        cost: node.sourceValues?.cost && node.days === node.sourceValues.days ? node.sourceValues.cost : focusCostFromDays(node.days),
        relationLines,
        scriptExtras: node.scriptExtras,
      }) };
    });
  if (project.sourceText) return renderImportedTree(project.sourceText, treeId, focuses);

  return `focus_tree = {
\tid = ${treeId}

\tcountry = {
\t\tfactor = 0
\t\tmodifier = {
\t\t\tadd = 10
\t\t\ttag = ${tag}
\t\t}
\t}

\tdefault = no

${focuses.map((focus) => focus.script).join("\n\n")}
}
`;
}

function generateLocalisation(project: ProjectState) {
  const managedKeys = new Set(project.nodes.flatMap((node) => [node.id, `${node.id}_desc`]));
  const extraLines = Object.entries(project.localisationExtras ?? {}).filter(([key]) => !managedKeys.has(key)).map(([key, value]) => ` ${key}:0 "${escapeLocalisation(value)}"`);
  const lines = [...project.nodes]
    .sort((a, b) => a.absY - b.absY || a.absX - b.absX)
    .flatMap((node) => [
      ` ${safeToken(node.id, "unnamed_focus")}:0 "${escapeLocalisation(node.name || node.id)}"`,
      ` ${safeToken(node.id, "unnamed_focus")}_desc:0 "${escapeLocalisation(node.description)}"`,
    ]);
  return `l_${project.localisationLanguage}:\n${[...extraLines, ...lines].join("\n")}\n`;
}

function parseLocalisation(text: string) {
  const entries = new Map<string, string>();
  const clean = text.replace(/^\uFEFF/, "");
  const matcher = /^\s*([^#\s:]+):\d*\s+"((?:\\.|[^"\\])*)"/gm;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(clean))) entries.set(match[1], unescapeLocalisation(match[2]));
  return entries;
}

function parseFocusScript(
  text: string,
  localisation: Map<string, string>,
  localisationLanguage: LocalisationLanguage = DEFAULT_LOCALISATION_LANGUAGE,
  uiLanguage: UiLanguage = DEFAULT_UI_LANGUAGE,
) {
  const ui = UI_MESSAGES[uiLanguage];
  const importedFile = readFocusTree(text);
  const raw = importedFile.nodes;

  const rawById = new Map(raw.map((node) => [node.id, node]));
  const absolute = new Map<string, { x: number; y: number }>();
  const resolve = (id: string, trail = new Set<string>()): { x: number; y: number } => {
    const cached = absolute.get(id);
    if (cached) return cached;
    const node = rawById.get(id);
    if (!node) return { x: 0, y: 0 };
    if (trail.has(id)) throw new Error(ui.relativeCoordinateCycle(id));
    trail.add(id);
    const anchor = node.relativeId ? resolve(node.relativeId, trail) : { x: 0, y: 0 };
    const result = { x: node.x + anchor.x, y: node.y + anchor.y };
    absolute.set(id, result);
    trail.delete(id);
    return result;
  };

  const timestamp = Date.now();
  const uidById = new Map(raw.map((node, index) => [node.id, `import-${timestamp}-${index}`]));
  const baseNodes: FocusNode[] = raw.map((node) => {
    const position = resolve(node.id);
    return {
      uid: uidById.get(node.id)!,
      id: node.id,
      name: localisation.get(node.id) ?? node.id,
      description: localisation.get(`${node.id}_desc`) ?? "",
      days: node.days,
      absX: position.x,
      absY: position.y,
      prerequisiteGroups: node.prerequisiteIdGroups
        .map((group) => group.map((id) => uidById.get(id)).filter(Boolean) as string[])
        .filter((group) => group.length),
      mutuallyExclusiveUids: node.mutuallyExclusiveIds.map((id) => uidById.get(id)).filter(Boolean) as string[],
      relativeToUid: node.relativeId ? uidById.get(node.relativeId) ?? null : null,
      artwork: node.artwork,
      scriptExtras: node.scriptExtras,
      sourceId: node.id,
      sourceValues: node.sourceValues,
    };
  });
  return {
    sourceText: importedFile.sourceText,
    localisationExtras: Object.fromEntries([...localisation].filter(([key]) => !baseNodes.some((node) => key === node.id || key === `${node.id}_desc`))),
    treeId: importedFile.treeId,
    countryTag: importedFile.countryTag,
    localisationLanguage,
    nodes: baseNodes,
  } satisfies ProjectState;
}

type ValidationIssue = { tone: "error" | "warning"; message: string; uids: string[]; field?: "treeId" | "countryTag" };

function validationFor(project: ProjectState, uiLanguage: UiLanguage) {
  const ui = UI_MESSAGES[uiLanguage];
  const issues: ValidationIssue[] = [];
  const error = (message: string, uids: string[] = [], field?: "treeId" | "countryTag") => issues.push({ tone: "error", message, uids, field });
  const warning = (message: string, uids: string[]) => issues.push({ tone: "warning", message, uids });
  const ids = new Map<string, number>();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(project.treeId.trim())) error(ui.invalidTreeId, [], "treeId");
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(project.countryTag.trim())) error(ui.invalidCountryTag, [], "countryTag");
  project.nodes.forEach((node) => {
    const id = node.id.trim();
    ids.set(id, (ids.get(id) ?? 0) + 1);
    if (!id) error(ui.missingFocusId, [node.uid]);
    else if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(id)) error(ui.invalidFocusId(id), [node.uid]);
    if (!Number.isSafeInteger(node.absX) || !Number.isSafeInteger(node.absY)) error(ui.invalidCoordinates(id), [node.uid]);
    if (!node.name.trim()) warning(ui.missingFocusName(id || ui.unnamedFocus), [node.uid]);
    if (!Number.isFinite(node.days) || node.days < 0) error(ui.invalidDays(id || ui.unnamedFocus), [node.uid]);
  });
  ids.forEach((count, id) => {
    if (id && count > 1) error(ui.duplicateId(id), project.nodes.filter((node) => node.id.trim() === id).map((node) => node.uid));
  });

  const nodeByUid = new Map(project.nodes.map((node) => [node.uid, node]));
  const mutualNodeByUid = new Map((project.sourceText ? project.nodes : completeMutualGroups(project.nodes)).map((node) => [node.uid, node]));
  const forcedByUid = buildForcedCompletionMap(mutualNodeByUid);
  project.nodes.forEach((node) => {
    node.prerequisiteGroups.forEach((group, index) => {
      if (!group.length) warning(ui.emptyPrerequisiteGroup(node.id, index + 1), [node.uid]);
      if (group.includes(node.uid)) error(ui.selfPrerequisite(node.id), [node.uid]);
      if (group.some((uid) => !nodeByUid.has(uid))) error(ui.invalidPrerequisiteReference(node.id), [node.uid]);
      if (group.length && group.every((uid) => node.mutuallyExclusiveUids.includes(uid))) {
        error(ui.allPrerequisitesMutual(node.id), [node.uid]);
      }
    });
    for (let firstIndex = 0; firstIndex < node.prerequisiteGroups.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < node.prerequisiteGroups.length; secondIndex += 1) {
        if (prerequisiteGroupsAreFullyMutual(
          node.prerequisiteGroups[firstIndex],
          node.prerequisiteGroups[secondIndex],
          mutualNodeByUid,
          forcedByUid,
        )) {
          error(ui.mutuallyExclusivePrerequisiteGroups(node.id), [node.uid]);
        }
      }
    }
    node.mutuallyExclusiveUids.forEach((uid) => {
      if (uid === node.uid) error(ui.selfMutual(node.id), [node.uid]);
      const other = nodeByUid.get(uid);
      if (!other) error(ui.invalidMutualReference(node.id), [node.uid]);
      else if (!other.mutuallyExclusiveUids.includes(node.uid)) warning(ui.unsyncedMutual(node.id), [node.uid]);
    });
  });

  const reachable = new Set(project.nodes.filter((node) => !node.prerequisiteGroups.length).map((node) => node.uid));
  let changed = true;
  while (changed) {
    changed = false;
    project.nodes.forEach((node) => {
      if (reachable.has(node.uid)) return;
      const allGroupsSatisfied = node.prerequisiteGroups.every((group) => group.some((uid) => reachable.has(uid)));
      if (allGroupsSatisfied) {
        reachable.add(node.uid);
        changed = true;
      }
    });
  }
  if (reachable.size !== project.nodes.length) error(ui.prerequisiteDeadlock, project.nodes.filter((node) => !reachable.has(node.uid)).map((node) => node.uid));

  const visitRelative = (uid: string, path: Set<string>): boolean => {
    if (path.has(uid)) return true;
    const node = project.nodes.find((item) => item.uid === uid);
    if (!node?.relativeToUid) return false;
    return visitRelative(node.relativeToUid, new Set(path).add(uid));
  };
  const relativeCycles = project.nodes.filter((node) => visitRelative(node.uid, new Set())).map((node) => node.uid);
  if (relativeCycles.length) error(ui.relativeReferenceCycle, relativeCycles);

  const occupied = new Map<string, string[]>();
  project.nodes.forEach((node) => {
    const key = `${node.absX},${node.absY}`;
    occupied.set(key, [...(occupied.get(key) ?? []), node.uid]);
  });
  occupied.forEach((nodeIds) => {
    if (nodeIds.length > 1) warning(ui.coordinateOverlap(nodeIds.map((uid) => nodeByUid.get(uid)!.id)), nodeIds);
  });
  const unique = [...new Map(issues.map((issue) => [JSON.stringify([issue.tone, issue.message, issue.uids]), issue])).values()];
  return {
    errors: unique.filter((issue) => issue.tone === "error").map((issue) => issue.message),
    warnings: unique.filter((issue) => issue.tone === "warning").map((issue) => issue.message),
    issues: unique.sort((a, b) => Number(a.tone === "warning") - Number(b.tone === "warning")),
  };
}

function downloadText(filename: string, content: string, withBom = false) {
  const blob = new Blob([withBom ? `\uFEFF${content}` : content], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function buildPrerequisitePath(parent: FocusNode, child: FocusNode) {
  const sourceX = worldX(parent.absX) + NODE_W / 2;
  const sourceY = worldY(parent.absY) + NODE_H;
  const targetX = worldX(child.absX) + NODE_W / 2;
  const targetTop = worldY(child.absY);
  const endY = targetTop - 4;

  // Whenever the child is visually below its prerequisite, keep the whole route
  // inside the available gap. A one-row HOI4 layout only leaves 28 px here.
  if (targetTop > sourceY) {
    if (Math.abs(sourceX - targetX) < 1) return `M ${sourceX} ${sourceY} V ${endY}`;
    const middleY = sourceY + (endY - sourceY) / 2;
    return `M ${sourceX} ${sourceY} V ${middleY} H ${targetX} V ${endY}`;
  }

  const approachY = endY - 18;
  const parentLeft = worldX(parent.absX);
  const parentRight = parentLeft + NODE_W;
  const childLeft = worldX(child.absX);
  const childRight = childLeft + NODE_W;
  const leftLane = Math.max(24, Math.min(parentLeft, childLeft) - 42);
  const rightLane = Math.min(WORLD_W - 24, Math.max(parentRight, childRight) + 42);
  const laneX = leftLane > WORLD_W - rightLane ? leftLane : rightLane;
  return `M ${sourceX} ${sourceY} V ${sourceY + 18} H ${laneX} V ${approachY} H ${targetX} V ${endY}`;
}

function buildMutualPath(first: FocusNode, second: FocusNode) {
  const firstLeft = worldX(first.absX);
  const firstTop = worldY(first.absY);
  const secondLeft = worldX(second.absX);
  const secondTop = worldY(second.absY);
  const firstCenterX = firstLeft + NODE_W / 2;
  const firstCenterY = firstTop + NODE_H / 2;
  const secondCenterX = secondLeft + NODE_W / 2;
  const secondCenterY = secondTop + NODE_H / 2;

  if (Math.abs(firstCenterX - secondCenterX) >= Math.abs(firstCenterY - secondCenterY)) {
    const firstIsLeft = firstCenterX < secondCenterX;
    const sourceX = firstIsLeft ? firstLeft + NODE_W : firstLeft;
    const targetX = firstIsLeft ? secondLeft : secondLeft + NODE_W;
    const middleX = (sourceX + targetX) / 2;
    return {
      d: `M ${sourceX} ${firstCenterY} H ${middleX} V ${secondCenterY} H ${targetX}`,
      labelX: middleX,
      labelY: (firstCenterY + secondCenterY) / 2,
    };
  }

  const firstIsAbove = firstCenterY < secondCenterY;
  const sourceY = firstIsAbove ? firstTop + NODE_H : firstTop;
  const targetY = firstIsAbove ? secondTop : secondTop + NODE_H;
  const middleY = (sourceY + targetY) / 2;
  return {
    d: `M ${firstCenterX} ${sourceY} V ${middleY} H ${secondCenterX} V ${targetY}`,
    labelX: (firstCenterX + secondCenterX) / 2,
    labelY: middleY,
  };
}

type PrerequisiteEditorProps = {
  nodes: FocusNode[];
  currentUid: string;
  groups: string[][];
  ui: UiMessages;
  onChange: (groups: string[][]) => void;
};

function PrerequisiteEditor({ nodes, currentUid, groups, ui, onChange }: PrerequisiteEditorProps) {
  const candidates = nodes.filter((node) => node.uid !== currentUid);
  const updateGroup = (index: number, nextGroup: string[]) => {
    onChange(groups.map((group, groupIndex) => groupIndex === index ? [...new Set(nextGroup)] : group));
  };

  return (
    <section className="relation-editor prerequisite-editor">
      <div className="relation-editor-head">
        <div><strong>{ui.prerequisiteGroups}</strong><span>{ui.prerequisiteLogic}</span></div>
        <button type="button" onClick={() => onChange([...groups, []])}><Plus size={13} />{groups.length ? ui.addAndGroup : ui.addFirstPrerequisite}</button>
      </div>
      <p className="relation-help">{ui.prerequisiteHelp}</p>
      {!groups.length && <div className="relation-empty">{ui.noPrerequisite}</div>}
      {groups.map((group, index) => (
        <div key={`prerequisite-group-${index}`}>
          {index > 0 && <div className="relation-and"><span>AND</span>{ui.and}</div>}
          <div className="relation-group-card">
            <div className="relation-group-top">
              <span>{ui.conditionGroup(index + 1)}</span>
              <em>{group.length > 1 ? ui.anyCompleteOr : ui.mustComplete}</em>
              <button type="button" onClick={() => onChange(groups.filter((_, groupIndex) => groupIndex !== index))} aria-label={ui.deletePrerequisiteGroup(index + 1)}><X size={13} /></button>
            </div>
            <div className="relation-chips">
              {group.map((uid) => {
                const node = nodes.find((item) => item.uid === uid);
                if (!node) return null;
                return <span className="relation-chip" key={uid}>{node.name || node.id}<button type="button" onClick={() => updateGroup(index, group.filter((item) => item !== uid))} aria-label={ui.removePrerequisite(node.name || node.id)}><X size={11} /></button></span>;
              })}
              <select
                className="relation-add-select"
                value=""
                aria-label={ui.addPrerequisite(index + 1)}
                onChange={(event) => {
                  if (event.target.value) updateGroup(index, [...group, event.target.value]);
                }}
              >
                <option value="">＋ {group.length ? ui.addOrAlternative : ui.choosePrerequisite}</option>
                {candidates.filter((node) => !group.includes(node.uid)).map((node) => <option key={node.uid} value={node.uid}>{node.name ? `${node.name} · ${node.id}` : node.id}</option>)}
              </select>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

type MutualEditorProps = {
  nodes: FocusNode[];
  currentUid: string;
  values: string[];
  ui: UiMessages;
  onChange: (uids: string[]) => void;
};

function MutualEditor({ nodes, currentUid, values, ui, onChange }: MutualEditorProps) {
  const candidates = nodes.filter((node) => node.uid !== currentUid && !values.includes(node.uid));
  return (
    <section className="relation-editor mutual-editor">
      <div className="relation-editor-head">
        <div><strong>{ui.mutualFocusGroup}</strong><span>{ui.mutualLogic}</span></div>
        <Ban size={15} />
      </div>
      <p className="relation-help">{ui.mutualHelp}</p>
      <div className="relation-group-card mutual-card">
        <div className="relation-chips">
          {values.map((uid) => {
            const node = nodes.find((item) => item.uid === uid);
            if (!node) return null;
            return <span className="relation-chip mutual" key={uid}>{node.name || node.id}<button type="button" onClick={() => onChange(values.filter((item) => item !== uid))} aria-label={ui.removeMutual(node.name || node.id)}><X size={11} /></button></span>;
          })}
          <select
            className="relation-add-select"
            value=""
            aria-label={ui.addMutual}
            onChange={(event) => {
              if (event.target.value) onChange([...values, event.target.value]);
            }}
          >
            <option value="">＋ {ui.joinMutualGroup}</option>
            {candidates.map((node) => <option key={node.uid} value={node.uid}>{node.name ? `${node.name} · ${node.id}` : node.id}</option>)}
          </select>
        </div>
        {!values.length && <span className="inline-empty">{ui.noMutual}</span>}
      </div>
    </section>
  );
}

function DraftField({ label, value, onCommit, onPending, multiline = false }: { label: string; value: string; onCommit: (value: string) => void; onPending: (pending: boolean) => void; multiline?: boolean }) {
  const [draft, setDraft] = useState(value);
  const props = {
    value: draft,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setDraft(event.target.value); onPending(event.target.value !== value); },
    onBlur: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { if (event.target.value !== value) onCommit(event.target.value); setDraft(value); onPending(false); },
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !multiline) event.currentTarget.blur();
      if (event.key === "Escape") { event.stopPropagation(); event.currentTarget.value = value; setDraft(value); event.currentTarget.blur(); }
    },
  };
  return <label>{label}{multiline ? <textarea {...props} rows={5} /> : <input {...props} spellCheck={false} />}</label>;
}

function CoordinateInput({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  return <label>{label}<input type="text" inputMode="numeric" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={(event) => {
    const text = event.currentTarget.value.trim();
    const next = Number(text);
    if (/^-?\d+$/.test(text) && Number.isSafeInteger(next)) {
      if (next !== value) onCommit(next);
      setDraft(String(next));
    } else setDraft(String(value));
  }} onKeyDown={(event) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") {
      event.stopPropagation();
      event.currentTarget.value = String(value);
      setDraft(String(value));
      event.currentTarget.blur();
    }
  }} /></label>;
}

export default function Home() {
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(DEFAULT_UI_LANGUAGE);
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [project, setProject] = useState<ProjectState>(initialProject);
  const [selectedUid, setSelectedUid] = useState(initialProject.nodes[1].uid);
  const [selectedUids, setSelectedUids] = useState<string[]>([initialProject.nodes[1].uid]);
  const [marqueeBox, setMarqueeBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const [past, setPast] = useState<ProjectState[]>([]);
  const [future, setFuture] = useState<ProjectState[]>([]);
  const [view, setView] = useState<ViewState>({ x: -290, y: 18, zoom: 0.82 });
  const [mode, setMode] = useState<"edit" | "code">("edit");
  const [toast, setToast] = useState<ToastState>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [ready, setReady] = useState(false);
  const [pasteImportOpen, setPasteImportOpen] = useState(false);
  const [focusImportDraft, setFocusImportDraft] = useState("");
  const [localisationImportDraft, setLocalisationImportDraft] = useState("");
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 600 });
  const [searchQuery, setSearchQuery] = useState("");
  const [batchDays, setBatchDays] = useState("");
  const [issuesOpen, setIssuesOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const treeIdRef = useRef<HTMLInputElement>(null);
  const countryTagRef = useRef<HTMLInputElement>(null);
  const canvasColumnRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef(project);
  const editSessionRef = useRef<string | null>(null);
  const pendingDraftRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPositions: Map<string, { x: number; y: number }>;
    before: ProjectState;
    moved: boolean;
  } | null>(null);
  const panRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    moved: boolean;
    clearSelectionOnClick: boolean;
  } | null>(null);
  const marqueeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    startedNodeUid: string | null;
  } | null>(null);

  const ui = UI_MESSAGES[uiLanguage];
  const selected = project.nodes.find((node) => node.uid === selectedUid) ?? null;
  const selectedUidSet = useMemo(() => new Set(selectedUids), [selectedUids]);
  const selectedNodes = useMemo(() => project.nodes.filter((node) => selectedUidSet.has(node.uid)), [project.nodes, selectedUidSet]);
  const searchResults = useMemo(() => findFocuses(project.nodes, searchQuery), [project.nodes, searchQuery]);
  const selectionDays = selectedNodes.reduce((sum, node) => sum + node.days, 0);
  const reservedIds = useMemo(() => project.sourceText ? reservedFocusIds(project.sourceText) : [], [project.sourceText]);
  const activeLocalisationLabel = localisationLabel(project.localisationLanguage, uiLanguage);
  const safeTreeId = safeToken(project.treeId, "focus_tree");
  const focusFilename = `${safeTreeId}.txt`;
  const localisationFilename = `${safeTreeId}_l_${project.localisationLanguage}.yml`;
  const nodeByUid = useMemo(() => new Map(project.nodes.map((node) => [node.uid, node])), [project.nodes]);
  const prerequisiteEdges = useMemo(() => {
    const edges = new Map<string, { parentUid: string; childUid: string; isOr: boolean }>();
    project.nodes.forEach((node) => {
      node.prerequisiteGroups.forEach((group) => {
        group.forEach((parentUid) => {
          const key = `${parentUid}->${node.uid}`;
          const existing = edges.get(key);
          edges.set(key, { parentUid, childUid: node.uid, isOr: Boolean(existing?.isOr || group.length > 1) });
        });
      });
    });
    return [...edges.values()];
  }, [project.nodes]);
  const mutualPairs = useMemo(() => {
    const pairs = new Map<string, { firstUid: string; secondUid: string }>();
    project.nodes.forEach((node) => {
      node.mutuallyExclusiveUids.forEach((otherUid) => {
        if (!nodeByUid.has(otherUid)) return;
        const [firstUid, secondUid] = [node.uid, otherUid].sort();
        pairs.set(`${firstUid}<->${secondUid}`, { firstUid, secondUid });
      });
    });
    return [...pairs.values()];
  }, [nodeByUid, project.nodes]);
  const validation = useMemo(() => validationFor(project, uiLanguage), [project, uiLanguage]);
  const focusScript = useMemo(() => generateFocusScript(project), [project]);
  const localisation = useMemo(() => generateLocalisation(project), [project]);
  const totalDays = useMemo(() => Number(project.nodes.reduce((sum, node) => sum + node.days, 0).toFixed(6)), [project.nodes]);
  const minimapBounds = useMemo(() => {
    if (!project.nodes.length) return { x: 0, y: 0, width: WORLD_W, height: WORLD_H };
    const padding = 72;
    const left = Math.min(...project.nodes.map((node) => worldX(node.absX)));
    const right = Math.max(...project.nodes.map((node) => worldX(node.absX) + NODE_W));
    const top = Math.min(...project.nodes.map((node) => worldY(node.absY)));
    const bottom = Math.max(...project.nodes.map((node) => worldY(node.absY) + NODE_H));
    return {
      x: left - padding,
      y: top - padding,
      width: right - left + padding * 2,
      height: bottom - top + padding * 2,
    };
  }, [project.nodes]);

  useEffect(() => {
    const element = canvasColumnRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setCanvasSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => {
      const rect = canvasColumnRef.current?.getBoundingClientRect();
      if (rect) setView(fittedView(projectRef.current.nodes, rect.width, rect.height));
    });
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedUiLanguage = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
        if (isUiLanguage(savedUiLanguage)) setUiLanguage(savedUiLanguage);
        const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (isThemeMode(savedTheme)) setThemeMode(savedTheme);
        const saved = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
        if (saved) {
          const parsed = normalizeProject(JSON.parse(saved));
          if (parsed) {
            setProject(parsed);
            setSelectedUid(parsed.nodes[0].uid);
            setSelectedUids([parsed.nodes[0].uid]);
          }
        }
      } catch {
        setToast({ tone: "warning", message: UI_MESSAGES[DEFAULT_UI_LANGUAGE].damagedDraft });
      } finally {
        setReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolvedTheme = themeMode === "system" ? (media.matches ? "dark" : "light") : themeMode;
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.style.colorScheme = resolvedTheme;
    };
    applyTheme();
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // Theme switching still works when storage is unavailable.
    }
    if (themeMode === "system") media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [ready, themeMode]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
        if (!pendingDraftRef.current) setSaveState("saved");
      } catch {
        setSaveState("error");
        setToast({ tone: "warning", message: ui.autosaveUnavailable });
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [project, ready, ui.autosaveUnavailable]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, uiLanguage);
    } catch {
      // The interface still switches for this session when storage is unavailable.
    }
    document.documentElement.lang = uiLanguage;
    document.title = ui.pageTitle;
  }, [ready, ui.pageTitle, uiLanguage]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function commit(next: ProjectState, editKey?: string) {
    const before = cloneProject(projectRef.current);
    if (!editKey || editSessionRef.current !== editKey) setPast((items) => [...items.slice(-59), before]);
    editSessionRef.current = editKey ?? null;
    setFuture([]);
    setSaveState("saving");
    const normalized = { ...next, nodes: next.sourceText ? next.nodes : normalizeFocusRelations(next.nodes) };
    projectRef.current = normalized;
    setProject(normalized);
  }

  function patchProject(patch: Partial<ProjectState>, editKey?: string) {
    commit({ ...projectRef.current, ...patch }, editKey);
  }

  function patchNode(uid: string, patch: Partial<FocusNode>, editKey?: string) {
    if (patch.id !== undefined) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(patch.id)) {
        setToast({ tone: "error", message: ui.invalidFocusId(patch.id) });
        return;
      }
      if ([...projectRef.current.nodes.filter((node) => node.uid !== uid), ...reservedIds].some((node) => node.id === patch.id)) {
        setToast({ tone: "error", message: ui.duplicateId(patch.id) });
        return;
      }
    }
    const requestedGroups = patch.prerequisiteGroups;
    const patchedNodes = projectRef.current.nodes.map((node) => {
      if (node.uid !== uid) return node;
      return {
        ...node,
        ...patch,
        ...(requestedGroups
          ? { prerequisiteGroupsBeforeMutualMerge: prerequisiteBackupAfterManualEdit(node, requestedGroups) }
          : {}),
      };
    });
    let nodes = requestedGroups ? normalizeFocusRelations(patchedNodes, { preservePairs: Boolean(projectRef.current.sourceText) }) : patchedNodes;
    const previous = projectRef.current.nodes.find((node) => node.uid === uid);
    const renamed = previous && patch.id && patch.id !== previous.id && /^[A-Za-z_][A-Za-z0-9_]*$/.test(patch.id) && !nodes.some((node) => node.uid !== uid && node.id === patch.id);
    let sourceText = projectRef.current.sourceText;
    if (renamed) {
      nodes = nodes.map((node) => ({ ...node, scriptExtras: node.scriptExtras && renameFocusReferences(node.scriptExtras, previous.id, patch.id!) }));
      if (sourceText) sourceText = renameFocusReferences(sourceText, previous.id, patch.id!);
    }
    commit({
      ...projectRef.current,
      sourceText,
      nodes,
    }, editKey);
    if (requestedGroups) {
      const normalizedGroupCount = nodes.find((node) => node.uid === uid)?.prerequisiteGroups.filter((group) => group.length).length ?? 0;
      const requestedGroupCount = requestedGroups.filter((group) => group.length).length;
      if (normalizedGroupCount < requestedGroupCount) {
        setToast({ tone: "success", message: ui.mutualPrerequisitesMerged });
      }
    }
  }

  function setMutuallyExclusive(uid: string, nextUids: string[]) {
    const restoredNodes = restoreAutoMergedPrerequisiteGroups(projectRef.current.nodes);
    const complete = projectRef.current.sourceText ? synchronizeMutualPairs : completeMutualGroups;
    const currentNodes = complete(restoredNodes);
    const nodeByUid = new Map(currentNodes.map((node) => [node.uid, node]));
    const current = nodeByUid.get(uid);
    if (!current) return;
    const previousGroup = new Set([uid, ...current.mutuallyExclusiveUids]);
    const requested = new Set(nextUids.filter((otherUid) => otherUid !== uid && nodeByUid.has(otherUid)));
    const targetGroup = new Set([uid, ...requested]);

    // Adding one member merges its existing group; removing a member detaches it
    // from the retained group while preserving any other removed subgroup.
    requested.forEach((otherUid) => {
      if (previousGroup.has(otherUid)) return;
      const other = nodeByUid.get(otherUid);
      if (!other) return;
      targetGroup.add(otherUid);
      other.mutuallyExclusiveUids.forEach((peerUid) => targetGroup.add(peerUid));
    });

    const removed = [...previousGroup].filter((memberUid) => memberUid !== uid && !requested.has(memberUid));
    const adjacency = new Map(currentNodes.map((node) => [node.uid, new Set(node.mutuallyExclusiveUids)]));
    removed.forEach((removedUid) => {
      targetGroup.forEach((memberUid) => {
        adjacency.get(removedUid)?.delete(memberUid);
        adjacency.get(memberUid)?.delete(removedUid);
      });
    });
    targetGroup.forEach((memberUid) => {
      targetGroup.forEach((otherUid) => {
        if (memberUid !== otherUid) adjacency.get(memberUid)?.add(otherUid);
      });
    });

    const relationNodes = complete(currentNodes.map((node) => ({
      ...node,
      mutuallyExclusiveUids: [...(adjacency.get(node.uid) ?? [])],
    })));
    const nodes = normalizeFocusRelations(relationNodes, { preservePairs: Boolean(projectRef.current.sourceText) });
    const previousPrerequisiteGroupCount = projectRef.current.nodes.reduce(
      (count, node) => count + node.prerequisiteGroups.filter((group) => group.length).length,
      0,
    );
    const nextPrerequisiteGroupCount = nodes.reduce(
      (count, node) => count + node.prerequisiteGroups.filter((group) => group.length).length,
      0,
    );
    commit({ ...projectRef.current, nodes });
    if (nextPrerequisiteGroupCount < previousPrerequisiteGroupCount) {
      setToast({ tone: "success", message: ui.mutualPrerequisitesMerged });
    } else if (nextPrerequisiteGroupCount > previousPrerequisiteGroupCount) {
      setToast({ tone: "success", message: ui.mutualPrerequisitesRestored });
    }
  }

  function restoreSnapshot(snapshot: ProjectState) {
    editSessionRef.current = null;
    const next = { ...snapshot, nodes: snapshot.sourceText ? snapshot.nodes : normalizeFocusRelations(snapshot.nodes) };
    projectRef.current = next;
    setProject(next);
    setSaveState("saving");
    const valid = new Set(next.nodes.map((node) => node.uid));
    const selection = selectedUids.filter((uid) => valid.has(uid));
    const fallback = next.nodes[0]?.uid ?? "";
    setSelectedUids(selection.length ? selection : fallback ? [fallback] : []);
    setSelectedUid(valid.has(selectedUid) ? selectedUid : selection[0] ?? fallback);
  }

  function undo() {
    if (!past.length) return;
    setFuture([cloneProject(projectRef.current), ...future].slice(0, 60));
    const previous = past[past.length - 1];
    setPast(past.slice(0, -1));
    restoreSnapshot(previous);
  }

  function redo() {
    if (!future.length) return;
    setPast([...past.slice(-59), cloneProject(projectRef.current)]);
    const next = future[0];
    setFuture(future.slice(1));
    restoreSnapshot(next);
  }

  function addNode() {
    const index = project.nodes.length + 1;
    const anchor = selected;
    let uidIndex = index;
    while (project.nodes.some((node) => node.uid === `focus-${uidIndex}`)) uidIndex += 1;
    const baseX = anchor?.absX ?? 0;
    const baseY = Math.max(1, (anchor?.absY ?? -1) + 2);
    const position = findAvailableNodePosition(project.nodes, { baseX, baseY });
    const node: FocusNode = {
      uid: `focus-${uidIndex}`,
      id: uniqueFocusId([...project.nodes, ...reservedIds], `${safeToken(project.countryTag.toUpperCase(), "TAG")}_new_focus_${index}`),
      name: ui.newFocusName,
      description: ui.newFocusDescription,
      days: 70,
      absX: position.x,
      absY: position.y,
      prerequisiteGroups: anchor ? [[anchor.uid]] : [],
      mutuallyExclusiveUids: [],
      relativeToUid: anchor?.uid ?? null,
      artwork: index % 5,
    };
    commit({ ...project, nodes: [...project.nodes, node] });
    setSelectedUid(node.uid);
    setSelectedUids([node.uid]);
    setMode("edit");
    setToast({ tone: "success", message: ui.newFocusCreated });
  }

  function duplicateNode(uid: string) {
    const source = nodeByUid.get(uid);
    if (!source) return;
    let copyIndex = 1;
    while (project.nodes.some((node) => node.uid === `${source.uid}-copy-${copyIndex}`)) copyIndex += 1;
    const position = findAvailableNodePosition(project.nodes, {
      baseX: source.absX + 2,
      baseY: Math.max(1, source.absY),
    });
    const copy: FocusNode = {
      ...source,
      uid: `${source.uid}-copy-${copyIndex}`,
      id: uniqueFocusId([...project.nodes, ...reservedIds], `${source.id}_copy`),
      sourceId: undefined,
      sourceValues: undefined,
      name: `${source.name}${ui.copySuffix}`,
      absX: position.x,
      absY: position.y,
      prerequisiteGroups: source.prerequisiteGroups.map((group) => [...group]),
      mutuallyExclusiveUids: [],
    };
    commit({ ...project, nodes: [...project.nodes, copy] });
    setSelectedUid(copy.uid);
    setSelectedUids([copy.uid]);
  }

  function removeNodes(uids: string[]) {
    const current = projectRef.current;
    const nodes = removeSelection(current.nodes, uids);
    if (nodes === current.nodes) {
      setToast({ tone: "warning", message: ui.keepOneFocus });
      return;
    }
    commit({ ...current, nodes });
    setSelectedUid(nodes[0]?.uid ?? "");
    setSelectedUids(nodes[0] ? [nodes[0].uid] : []);
    setToast({ tone: "success", message: ui.nodesRemoved(current.nodes.length - nodes.length) });
  }

  function updateSelection(action: "days" | "row" | "column") {
    const current = projectRef.current;
    const nodes = action === "days"
      ? setSelectionDays(current.nodes, selectedUids, Number(batchDays))
      : arrangeSelection(current.nodes, selectedUids, selectedUid, action);
    if (nodes.every((node, index) => node === current.nodes[index])) return;
    commit({ ...current, nodes });
    setToast({ tone: "success", message: ui.batchUpdated(selectedNodes.length) });
  }

  function toggleSelection(uid: string) {
    const next = selectedUidSet.has(uid) ? selectedUids.filter((item) => item !== uid) : [...selectedUids, uid];
    setSelectedUids(next);
    setSelectedUid(next.includes(uid) ? uid : next[next.length - 1] ?? "");
  }

  function moveNodesBy(uids: string[], deltaX: number, deltaY: number) {
    const movingUids = new Set(uids);
    if (!movingUids.size) return;
    commit({
      ...projectRef.current,
      nodes: projectRef.current.nodes.map((node) =>
        movingUids.has(node.uid) ? { ...node, absX: node.absX + deltaX, absY: node.absY + deltaY } : node,
      ),
    });
  }

  function handleNodePointerDown(event: ReactPointerEvent<HTMLButtonElement>, node: FocusNode) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || mode !== "edit") return;
    event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    if (event.shiftKey) {
      event.preventDefault();
      toggleSelection(node.uid);
      return;
    }
    const movingUids = selectedUidSet.has(node.uid) ? selectedUids : [node.uid];
    setSelectedUid(node.uid);
    if (!selectedUidSet.has(node.uid)) setSelectedUids([node.uid]);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPositions: new Map(
        projectRef.current.nodes
          .filter((item) => movingUids.includes(item.uid))
          .map((item) => [item.uid, { x: item.absX, y: item.absY }]),
      ),
      before: cloneProject(projectRef.current),
      moved: false,
    };
  }

  function handleNodePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = (event.clientX - drag.startClientX) / view.zoom;
    const deltaY = (event.clientY - drag.startClientY) / view.zoom;
    const gridDeltaX = Math.round(deltaX / GRID_X);
    const gridDeltaY = Math.round(deltaY / GRID_Y);
    if (gridDeltaX === 0 && gridDeltaY === 0 && !drag.moved) return;
    drag.moved = true;
    setSaveState("saving");
    setProject((current) => ({
      ...current,
      nodes: current.nodes.map((node) => {
        const start = drag.startPositions.get(node.uid);
        return start ? { ...node, absX: start.x + gridDeltaX, absY: start.y + gridDeltaY } : node;
      }),
    }));
  }

  function handleNodePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      setPast((items) => [...items.slice(-59), drag.before]);
      setFuture([]);
    }
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (mode !== "edit") return;
    if ((event.button === 0 || event.button === 1) && !(event.target as HTMLElement).closest("button")) {
      event.currentTarget.focus({ preventScroll: true });
    }
    const shouldStartMarquee = event.button === 0 && (event.ctrlKey || event.metaKey);
    if (shouldStartMarquee) {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const startX = clamp(event.clientX - rect.left, 0, rect.width);
      const startY = clamp(event.clientY - rect.top, 0, rect.height);
      event.currentTarget.setPointerCapture(event.pointerId);
      marqueeRef.current = {
        pointerId: event.pointerId,
        startX,
        startY,
        currentX: startX,
        currentY: startY,
        startedNodeUid: ((event.target as HTMLElement).closest("[data-focus-uid]") as HTMLElement | null)?.dataset.focusUid ?? null,
      };
      setMarqueeBox({ left: startX, top: startY, width: 0, height: 0 });
      return;
    }
    if (event.button !== 0 && event.button !== 1) return;
    if (event.button === 0 && (event.target as HTMLElement).closest(".focus-card, .zoom-controls")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanning(true);
    panRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: view.x,
      startY: view.y,
      moved: false,
      clearSelectionOnClick: event.button === 0,
    };
  }

  function handleCanvasPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const marquee = marqueeRef.current;
    if (marquee?.pointerId === event.pointerId) {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const currentX = clamp(event.clientX - rect.left, 0, rect.width);
      const currentY = clamp(event.clientY - rect.top, 0, rect.height);
      marquee.currentX = currentX;
      marquee.currentY = currentY;
      setMarqueeBox({
        left: Math.min(marquee.startX, currentX),
        top: Math.min(marquee.startY, currentY),
        width: Math.abs(currentX - marquee.startX),
        height: Math.abs(currentY - marquee.startY),
      });
      return;
    }
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - pan.startClientX;
    const deltaY = event.clientY - pan.startClientY;
    if (!pan.moved && Math.hypot(deltaX, deltaY) < 4) return;
    pan.moved = true;
    setView((current) => ({
      ...current,
      x: pan.startX + deltaX,
      y: pan.startY + deltaY,
    }));
  }

  function handleCanvasPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const marquee = marqueeRef.current;
    if (marquee?.pointerId === event.pointerId) {
      const left = Math.min(marquee.startX, marquee.currentX);
      const top = Math.min(marquee.startY, marquee.currentY);
      const right = Math.max(marquee.startX, marquee.currentX);
      const bottom = Math.max(marquee.startY, marquee.currentY);
      if (Math.hypot(marquee.currentX - marquee.startX, marquee.currentY - marquee.startY) >= 5) {
        const matchingUids = projectRef.current.nodes
          .filter((node) => {
            const nodeLeft = view.x + worldX(node.absX) * view.zoom;
            const nodeTop = view.y + worldY(node.absY) * view.zoom;
            const nodeRight = nodeLeft + NODE_W * view.zoom;
            const nodeBottom = nodeTop + NODE_H * view.zoom;
            return nodeLeft <= right && nodeRight >= left && nodeTop <= bottom && nodeBottom >= top;
          })
          .map((node) => node.uid);
        setSelectedUids(matchingUids);
        setSelectedUid(matchingUids[0] ?? "");
      } else if (marquee.startedNodeUid) {
        setSelectedUids([marquee.startedNodeUid]);
        setSelectedUid(marquee.startedNodeUid);
      } else {
        setSelectedUids([]);
        setSelectedUid("");
      }
      marqueeRef.current = null;
      setMarqueeBox(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    const pan = panRef.current;
    if (pan?.pointerId !== event.pointerId) return;
    if (!pan.moved && pan.clearSelectionOnClick) {
      setSelectedUid("");
      setSelectedUids([]);
    }
    panRef.current = null;
    setPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleCanvasPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    if (marqueeRef.current?.pointerId === event.pointerId) {
      marqueeRef.current = null;
      setMarqueeBox(null);
    }
    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null;
      setPanning(false);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    setView((current) => {
      const nextZoom = clamp(current.zoom * Math.exp(-event.deltaY * 0.0011), 0.08, 1.55);
      const pointX = (mouseX - current.x) / current.zoom;
      const pointY = (mouseY - current.y) / current.zoom;
      return {
        zoom: nextZoom,
        x: mouseX - pointX * nextZoom,
        y: mouseY - pointY * nextZoom,
      };
    });
  }

  function zoomBy(factor: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    setView((current) => {
      const nextZoom = clamp(current.zoom * factor, 0.08, 1.55);
      const pointX = (centerX - current.x) / current.zoom;
      const pointY = (centerY - current.y) / current.zoom;
      return {
        zoom: nextZoom,
        x: centerX - pointX * nextZoom,
        y: centerY - pointY * nextZoom,
      };
    });
  }

  function fitNodes(nodes: FocusNode[]) {
    setMode("edit");
    const rect = canvasColumnRef.current?.getBoundingClientRect();
    if (!rect || !nodes.length) return;
    setView(fittedView(nodes, rect.width, rect.height));
  }

  function fitView() {
    fitNodes(projectRef.current.nodes);
  }

  function locateNodes(uids: string[]) {
    const nodes = projectRef.current.nodes.filter((node) => uids.includes(node.uid));
    if (!nodes.length) return;
    setSelectedUids(nodes.map((node) => node.uid));
    setSelectedUid(nodes[0].uid);
    fitNodes(nodes);
    if (window.matchMedia("(max-width: 700px)").matches) {
      requestAnimationFrame(() => canvasColumnRef.current?.scrollIntoView({ block: "start" }));
    }
  }

  function locateIssue(issue: ValidationIssue) {
    if (issue.uids.length) locateNodes(issue.uids);
    else {
      const input = issue.field === "treeId" ? treeIdRef.current : countryTagRef.current;
      input?.scrollIntoView({ block: "nearest" });
      input?.focus();
    }
  }

  function applyImportedProject(
    focusText: string,
    localisationMap: Map<string, string>,
    localisationLanguage: LocalisationLanguage = projectRef.current.localisationLanguage,
  ) {
    const imported = parseFocusScript(focusText, localisationMap, localisationLanguage, uiLanguage);
    commit(imported);
    const importedSelectedUid = imported.nodes[0]?.uid ?? "";
    setSelectedUid(importedSelectedUid);
    setSelectedUids(importedSelectedUid ? [importedSelectedUid] : []);
    setMode("edit");
    window.setTimeout(fitView, 60);
    setToast({
      tone: "success",
      message: ui.importedFocuses(imported.nodes.length),
    });
  }

  function importPastedText() {
    try {
      if (!/\bfocus_tree\s*=\s*\{/.test(focusImportDraft)) throw new Error(ui.noFocusTree);
      if (localisationImportDraft.trim() && !detectLocalisationLanguage(localisationImportDraft)) {
        throw new Error(ui.missingLocalisationHeader);
      }
      const detectedLanguage = detectLocalisationLanguage(localisationImportDraft) ?? projectRef.current.localisationLanguage;
      applyImportedProject(focusImportDraft, parseLocalisation(localisationImportDraft), detectedLanguage);
      setPasteImportOpen(false);
      setFocusImportDraft("");
      setLocalisationImportDraft("");
    } catch (error) {
      setToast({ tone: "error", message: ui.importFailed(error instanceof Error ? error.message : ui.unrecognizedText) });
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    try {
      const texts = await Promise.all(files.map(async (file) => ({ name: file.name, text: await file.text() })));
      const jsonFiles = texts.filter((item) => item.name.endsWith(".json"));
      if (jsonFiles.length) {
        if (texts.length !== 1) throw new Error(ui.importChoiceError);
        const backup = JSON.parse(jsonFiles[0].text);
        if (backup.format !== "hoi4-focus-project" || backup.version !== 1) throw new Error(ui.unrecognizedFile);
        const restored = normalizeProject(backup.project);
        if (!restored || new Set(restored.nodes.map((node) => node.uid)).size !== restored.nodes.length) throw new Error(ui.unrecognizedFile);
        commit(restored);
        setSelectedUid(restored.nodes[0].uid); setSelectedUids([restored.nodes[0].uid]);
        setMode("edit"); window.setTimeout(fitView, 60);
        setToast({ tone: "success", message: ui.projectImported });
        return;
      }
      const focusFiles = texts.filter((item) => /\bfocus_tree\s*=\s*\{/.test(item.text));
      if (focusFiles.length > 1) throw new Error(ui.importChoiceError);
      const focusFile = focusFiles[0];
      const localisationCandidates = texts.filter((item) => /^\uFEFF?\s*l_[A-Za-z_]+\s*:/m.test(item.text));
      const localisationFiles = texts.flatMap((item) => {
        const language = detectLocalisationLanguage(item.text);
        return language ? [{ ...item, language }] : [];
      });
      if (localisationCandidates.length && !localisationFiles.length) {
        throw new Error(ui.unsupportedLanguageCode);
      }
      if (new Set(localisationFiles.map((file) => file.language)).size > 1) throw new Error(ui.importChoiceError);
      if (texts.some((item) => item !== focusFile && !localisationFiles.some((file) => file.name === item.name))) throw new Error(ui.unrecognizedFile);
      const preferredLocalisation = localisationFiles.find(
        (item) => item.language === projectRef.current.localisationLanguage,
      ) ?? localisationFiles[0];
      const localisationMap = preferredLocalisation
        ? new Map(localisationFiles.flatMap((file) => [...parseLocalisation(file.text)]))
        : new Map<string, string>();

      if (focusFile) {
        applyImportedProject(
          focusFile.text,
          localisationMap,
          preferredLocalisation?.language ?? projectRef.current.localisationLanguage,
        );
      } else if (preferredLocalisation && localisationMap.size) {
        const currentProject = projectRef.current;
        const next = {
          ...currentProject,
          localisationLanguage: preferredLocalisation.language,
          localisationExtras: { ...currentProject.localisationExtras, ...Object.fromEntries([...localisationMap].filter(([key]) => !currentProject.nodes.some((node) => key === node.id || key === `${node.id}_desc`))) },
          nodes: currentProject.nodes.map((node) => ({
            ...node,
            name: localisationMap.get(node.id) ?? node.name,
            description: localisationMap.get(`${node.id}_desc`) ?? node.description,
          })),
        };
        commit(next);
        setToast({
          tone: "success",
          message: ui.localisationMerged(localisationLabel(preferredLocalisation.language, uiLanguage)),
        });
      } else {
        throw new Error(ui.noRecognizedImport);
      }
    } catch (error) {
      setToast({ tone: "error", message: ui.importFailed(error instanceof Error ? error.message : ui.unrecognizedFile) });
    }
  }

  function guardExport(action: () => void) {
    if (validation.errors.length) {
      setIssuesOpen(true);
      setToast({ tone: "error", message: ui.resolveErrorsBeforeExport(validation.errors.length) });
      return;
    }
    action();
  }

  function exportFocus() {
    guardExport(() => {
      downloadText(focusFilename, focusScript);
      setToast({ tone: "success", message: ui.focusExported });
    });
  }

  function exportLocalisation() {
    guardExport(() => {
      downloadText(localisationFilename, localisation, true);
      setToast({ tone: "success", message: ui.localisationExported(activeLocalisationLabel) });
    });
  }

  async function copyFile(kind: "focus" | "localisation") {
    if (validation.errors.length) { guardExport(() => {}); return; }
    try {
      await navigator.clipboard.writeText(kind === "focus" ? focusScript : localisation);
      setToast({ tone: "success", message: ui.copiedFile });
    } catch {
      setToast({ tone: "error", message: ui.clipboardDenied });
    }
  }

  function backupProject() {
    downloadText(`${safeTreeId}.hoi4-project.json`, JSON.stringify({ format: "hoi4-focus-project", version: 1, project: projectRef.current }, null, 2));
  }

  function saveNow() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projectRef.current));
      setSaveState("saved");
      setToast({ tone: "success", message: ui.draftSaved });
    } catch {
      setSaveState("error");
      setToast({ tone: "error", message: ui.draftSaveFailed });
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const editing = Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
      const canvasKeyboard = mode === "edit" && (target === canvasRef.current || Boolean(target.closest(".focus-card")));
      const modifier = event.ctrlKey || event.metaKey;
      if (pasteImportOpen) {
        if (event.key === "Escape") setPasteImportOpen(false);
        return;
      }
      if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (editing) target.blur();
        saveNow();
        return;
      }
      if (modifier && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (editing) return;
      if (modifier && event.key.toLowerCase() === "a" && mode === "edit") {
        event.preventDefault();
        setSelectedUids(project.nodes.map((node) => node.uid));
        setSelectedUid(selectedUid || project.nodes[0]?.uid || "");
        canvasRef.current?.focus({ preventScroll: true });
        return;
      }
      if (event.key === "Escape" && !marqueeRef.current) {
        setSelectedUids([]);
        setSelectedUid("");
        return;
      }
      if (!editing && event.key === "Escape" && marqueeRef.current) {
        event.preventDefault();
        const activeMarquee = marqueeRef.current;
        if (activeMarquee && canvasRef.current?.hasPointerCapture(activeMarquee.pointerId)) {
          canvasRef.current.releasePointerCapture(activeMarquee.pointerId);
        }
        marqueeRef.current = null;
        setMarqueeBox(null);
      } else if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      } else if (canvasKeyboard && selectedUid && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        const step = event.shiftKey ? 2 : 1;
        const directions: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        };
        const [deltaX, deltaY] = directions[event.key];
        moveNodesBy(selectedUidSet.has(selectedUid) ? selectedUids : [selectedUid], deltaX, deltaY);
      } else if (canvasKeyboard && (event.key === "Delete" || event.key === "Backspace") && selectedUid) {
        event.preventDefault();
        removeNodes(selectedUids);
      }
    };
    const flushBeforeLeaving = () => {
      (document.activeElement as HTMLElement | null)?.blur();
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projectRef.current)); } catch { /* Storage errors are already visible in the editor. */ }
    };
    const handleWindowBlur = () => {
      const activeMarquee = marqueeRef.current;
      const activePointerId = activeMarquee?.pointerId ?? panRef.current?.pointerId;
      if (activePointerId !== undefined && canvasRef.current?.hasPointerCapture(activePointerId)) {
        canvasRef.current.releasePointerCapture(activePointerId);
      }
      const activeDrag = dragRef.current;
      if (activeDrag?.moved) {
        setPast((items) => [...items.slice(-59), activeDrag.before]);
        setFuture([]);
      }
      dragRef.current = null;
      marqueeRef.current = null;
      panRef.current = null;
      setMarqueeBox(null);
      setPanning(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("beforeunload", flushBeforeLeaving);
    window.addEventListener("pagehide", flushBeforeLeaving);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("beforeunload", flushBeforeLeaving);
      window.removeEventListener("pagehide", flushBeforeLeaving);
    };
  });

  const rulerStep = view.zoom < 0.25 ? 5 : view.zoom < 0.7 ? 2 : 1;
  const firstTick = Math.floor(((-view.x / view.zoom - ORIGIN_X) / GRID_X) / rulerStep) * rulerStep;
  const rulerTicks = Array.from({ length: Math.min(150, Math.ceil(canvasSize.width / (GRID_X * view.zoom * rulerStep)) + 2) }, (_, index) => firstTick + index * rulerStep);

  const selectedAnchor = selected?.relativeToUid ? nodeByUid.get(selected.relativeToUid) : null;
  const relativeX = selected ? selected.absX - (selectedAnchor?.absX ?? 0) : 0;
  const relativeY = selected ? selected.absY - (selectedAnchor?.absY ?? 0) : 0;

  return (
    <main className="studio-shell" lang={uiLanguage}>
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><Compass size={26} strokeWidth={1.5} /></span>
          <div>
            <h1>{ui.appTitle}</h1>
            <p>Focus Tree Cartography Studio</p>
          </div>
          <a
            className="organization-link"
            href="https://github.com/LesMiserablesMod"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={ui.organizationGithub}
            title={ui.organizationGithub}
          >
            <Image
              src="/hoi4-focus-tree-designer/lm-mod-logo.png"
              alt=""
              width={2000}
              height={768}
              priority
            />
          </a>
        </div>

        <div className="mode-switch" role="tablist" aria-label={ui.viewMode}>
          <button className={mode === "edit" ? "active" : ""} onClick={() => setMode("edit")} role="tab" aria-selected={mode === "edit"}>
            <MapIcon size={15} /> {ui.canvas}
          </button>
          <button className={mode === "code" ? "active" : ""} onClick={() => setMode("code")} role="tab" aria-selected={mode === "code"}>
            <FileCode2 size={15} /> {ui.codePreview}
          </button>
        </div>

        <div className="top-actions">
          <a
            className="icon-button github-link"
            href="https://github.com/LesMiserablesMod/hoi4-focus-tree-designer"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={ui.projectGithub}
            title={ui.projectGithub}
          ><Github size={18} /></a>
          <div className="theme-switch" role="group" aria-label={ui.themeMode}>
            <button className={themeMode === "light" ? "active" : ""} onClick={() => setThemeMode("light")} aria-pressed={themeMode === "light"} aria-label={ui.lightTheme} title={ui.lightTheme}><Sun size={14} /></button>
            <button className={themeMode === "dark" ? "active" : ""} onClick={() => setThemeMode("dark")} aria-pressed={themeMode === "dark"} aria-label={ui.darkTheme} title={ui.darkTheme}><Moon size={14} /></button>
            <button className={themeMode === "system" ? "active" : ""} onClick={() => setThemeMode("system")} aria-pressed={themeMode === "system"} aria-label={ui.systemTheme} title={ui.systemTheme}><Monitor size={14} /></button>
          </div>
          <div className="ui-language-switch" role="group" aria-label={ui.interfaceLanguage}>
            <Languages size={14} aria-hidden="true" />
            <button className={uiLanguage === "zh-CN" ? "active" : ""} onClick={() => setUiLanguage("zh-CN")} aria-pressed={uiLanguage === "zh-CN"} title={ui.chineseInterface}>中</button>
            <button className={uiLanguage === "en" ? "active" : ""} onClick={() => setUiLanguage("en")} aria-pressed={uiLanguage === "en"} title={ui.englishInterface}>EN</button>
          </div>
          <span className="save-indicator"><span className={saveState === "saving" ? "saving-dot" : "saved-dot"} />{saveState === "saving" ? ui.saving : saveState === "error" ? ui.saveFailed : ui.saved}</span>
          <button className="icon-button" onClick={undo} disabled={!past.length} aria-label={ui.undo} title={`${ui.undo} Ctrl+Z`}><Undo2 size={17} /></button>
          <button className="icon-button" onClick={redo} disabled={!future.length} aria-label={ui.redo} title={`${ui.redo} Ctrl+Y`}><Redo2 size={17} /></button>
          <button className="secondary-button" onClick={saveNow}><Save size={16} />{ui.save}</button>
          <label className="secondary-button file-button"><Upload size={16} />{ui.import}<input type="file" accept=".txt,.yml,.yaml,.json" multiple onChange={handleImport} /></label>
          <button className="primary-button" onClick={addNode}><Plus size={17} />{ui.addFocus}</button>
        </div>
      </header>

      <section className="workspace">
        <aside className="inspector panel-paper" aria-label={ui.focusProperties}>
          <div className="panel-heading">
            <div><span className="eyebrow">FOCUS</span><h2>{selectedNodes.length > 1 ? ui.batchProperties : ui.focusProperties}</h2></div>
            <span className="folio">№ {String(project.nodes.findIndex((node) => node.uid === selectedUid) + 1).padStart(3, "0")}</span>
          </div>

          {selectedNodes.length > 1 ? (
            <div className="inspector-form batch-panel">
              <strong className="selection-summary" title={ui.selectionDaysHelp}>{ui.selectionSummary(selectedNodes.length, selectionDays)}</strong>
              <p className="workflow-help">{ui.selectionHelp}</p>
              <label>{ui.completionDays}
                <input type="number" min="1" step="1" placeholder={ui.batchDaysPlaceholder} value={batchDays} onChange={(event) => setBatchDays(event.target.value)} />
              </label>
              <button className="workflow-button" disabled={!Number.isSafeInteger(Number(batchDays)) || Number(batchDays) < 1} onClick={() => updateSelection("days")}><Check size={15} />{ui.applyDays}</button>
              <div className="ornament-rule"><span /></div>
              <button className="workflow-button" onClick={() => updateSelection("row")}><AlignVerticalJustifyCenter size={16} />{ui.arrangeRow}</button>
              <button className="workflow-button" onClick={() => updateSelection("column")}><AlignHorizontalJustifyCenter size={16} />{ui.arrangeColumn}</button>
              <p className="workflow-help">{ui.arrangeHelp}</p>
              <button className="workflow-button" onClick={() => fitNodes(selectedNodes)}><LocateFixed size={16} />{ui.focusSelection}</button>
              <button className="workflow-button" onClick={() => { setSelectedUids([]); setSelectedUid(""); }}><X size={16} />{ui.clearSelection}</button>
              <button className="workflow-button danger" disabled={selectedNodes.length === project.nodes.length} title={selectedNodes.length === project.nodes.length ? ui.keepOneFocus : undefined} onClick={() => removeNodes(selectedUids)}><Trash2 size={16} />{ui.deleteSelection(selectedNodes.length)}</button>
              <div className="selection-members">{selectedNodes.map((node) => <button key={node.uid} onClick={() => locateNodes([node.uid])} title={node.id}>{node.name || node.id}<small>{node.id}</small></button>)}</div>
            </div>
          ) : selected ? (
            <div className="inspector-form">
              <DraftField key={`${selected.uid}-id-${selected.id}`} label={ui.focusId} value={selected.id} onCommit={(id) => patchNode(selected.uid, { id: id.trim() })} onPending={(pending) => { pendingDraftRef.current = pending; if (pending) setSaveState("saving"); else saveNow(); }} />
              <p className="workflow-help">{ui.idReferenceHelp}</p>
              <label>{ui.localisationName} · {activeLocalisationLabel}<input value={selected.name} onChange={(event) => patchNode(selected.uid, { name: event.target.value }, `${selected.uid}:name`)} onBlur={() => { editSessionRef.current = null; }} /></label>
              <label>{ui.localisationDescription} · {activeLocalisationLabel}<textarea value={selected.description} rows={5} onChange={(event) => patchNode(selected.uid, { description: event.target.value }, `${selected.uid}:description`)} onBlur={() => { editSessionRef.current = null; }} /></label>
              <label>{ui.completionDays}<input type="number" min="0" step="any" value={selected.days} onChange={(event) => {
                const days = event.currentTarget.valueAsNumber;
                if (Number.isFinite(days)) patchNode(selected.uid, { days: Math.max(0, days) });
              }} /></label>

              <div className="ornament-rule"><span /></div>

              {project.sourceText && <p className="workflow-help">{ui.importedStructureHelp}</p>}
              <PrerequisiteEditor
                nodes={project.nodes}
                currentUid={selected.uid}
                groups={selected.prerequisiteGroups}
                ui={ui}
                onChange={(groups) => patchNode(selected.uid, {
                  prerequisiteGroups: groups,
                  relativeToUid: selected.relativeToUid ?? groups.flat()[0] ?? null,
                })}
              />

              <MutualEditor
                nodes={project.nodes}
                currentUid={selected.uid}
                values={selected.mutuallyExclusiveUids}
                ui={ui}
                onChange={(uids) => setMutuallyExclusive(selected.uid, uids)}
              />

              <label>{ui.relativeTo}
                <select value={selected.relativeToUid ?? ""} onChange={(event) => patchNode(selected.uid, { relativeToUid: event.target.value || null })}>
                  <option value="">{ui.canvasOrigin}</option>
                  {project.nodes.filter((node) => node.uid !== selected.uid).map((node) => <option key={node.uid} value={node.uid}>{node.name ? `${node.name} · ${node.id}` : node.id}</option>)}
                </select>
              </label>

              <div className="coordinate-inputs">
                {(["absX", "absY"] as const).map((axis) => <CoordinateInput
                  key={`${selected.uid}-${axis}-${selected[axis]}`}
                  label={axis === "absX" ? ui.absoluteX : ui.absoluteY}
                  value={selected[axis]}
                  onCommit={(value) => patchNode(selected.uid, { [axis]: value })}
                />)}
              </div>
              <div className="coordinate-card">
                <div><span>{ui.relativeX}</span><strong>{relativeX}</strong></div>
                <div><span>{ui.relativeY}</span><strong>{relativeY}</strong></div>
                <small><MousePointer2 size={13} />{ui.dragToEditCoordinates}</small>
              </div>

              {selected.scriptExtras?.trim() && <details className="script-details">
                <summary>{ui.preservedScript}</summary>
                <p className="workflow-help">{ui.preservedScriptHelp}</p>
                <pre>{selected.scriptExtras}</pre>
              </details>}
              <div className="node-actions">
                <button onClick={() => duplicateNode(selected.uid)}><Copy size={15} />{ui.duplicate}</button>
                <button className="danger" onClick={() => removeNodes([selected.uid])}><Trash2 size={15} />{ui.delete}</button>
              </div>
            </div>
          ) : (
            <div className="empty-selection">
              <MousePointer2 size={28} />
              <h3>{ui.chooseFocus}</h3>
              <p>{ui.chooseFocusHelp}</p>
              <button className="primary-button" onClick={addNode}><Plus size={16} />{ui.addFocus}</button>
            </div>
          )}
        </aside>

        <section className="canvas-column" ref={canvasColumnRef}>
          {mode === "edit" ? (
            <div
              className={`focus-canvas ${marqueeBox ? "is-marquee" : ""} ${panning ? "is-panning" : ""}`}
              ref={canvasRef}
              tabIndex={0}
              style={{
                "--grid-x": `${GRID_X * view.zoom}px`,
                "--grid-y": `${GRID_Y * view.zoom}px`,
                "--minor-grid-x": `${GRID_X * view.zoom / 4}px`,
                "--minor-grid-y": `${GRID_Y * view.zoom / 4}px`,
                "--grid-origin-x": `${view.x + ORIGIN_X * view.zoom}px`,
                "--grid-origin-y": `${view.y + ORIGIN_Y * view.zoom}px`,
              } as CSSProperties}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerCancel={handleCanvasPointerCancel}
              onLostPointerCapture={handleCanvasPointerCancel}
              onDragStart={(event) => event.preventDefault()}
              onWheel={handleWheel}
              aria-label={ui.draggableCanvas}
            >
              <div className="coordinate-ruler ruler-top" aria-hidden="true">{rulerTicks.map((x) => <span key={x} style={{ left: view.x + worldX(x) * view.zoom }}>{x}</span>)}</div>
              <div className="north-mark" aria-hidden="true">N<span>↑</span></div>
              <div className="canvas-world" style={{ width: WORLD_W, height: WORLD_H, transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
                <svg className="connector-layer" width={WORLD_W} height={WORLD_H} aria-hidden="true">
                  <defs>
                    <marker id="arrow-ink" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" refX="11" refY="6" viewBox="0 0 12 12" orient="auto"><path d="M0,0 L12,6 L0,12 Z" /></marker>
                    <marker id="arrow-wine" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" refX="11" refY="6" viewBox="0 0 12 12" orient="auto"><path d="M0,0 L12,6 L0,12 Z" /></marker>
                  </defs>
                  {mutualPairs.map(({ firstUid, secondUid }) => {
                    const first = nodeByUid.get(firstUid);
                    const second = nodeByUid.get(secondUid);
                    if (!first || !second) return null;
                    const route = buildMutualPath(first, second);
                    const highlighted = selectedUidSet.has(firstUid) || selectedUidSet.has(secondUid);
                    return <g key={`${firstUid}<->${secondUid}`} className={highlighted ? "mutual-connection selected" : "mutual-connection"}>
                      <path className="connector mutual" d={route.d} />
                      <circle className="mutual-badge" cx={route.labelX} cy={route.labelY} r="10" />
                      <text className="mutual-badge-text" x={route.labelX} y={route.labelY + 0.5}>×</text>
                    </g>;
                  })}
                  {prerequisiteEdges.map(({ parentUid, childUid, isOr }) => {
                    const parent = nodeByUid.get(parentUid);
                    const child = nodeByUid.get(childUid);
                    if (!parent || !child) return null;
                    const highlighted = selectedUidSet.has(child.uid) || selectedUidSet.has(parent.uid);
                    return <path
                      key={`${parentUid}->${childUid}`}
                      className={`connector prerequisite ${isOr ? "or" : ""} ${highlighted ? "selected" : ""}`}
                      d={buildPrerequisitePath(parent, child)}
                      markerEnd={highlighted ? "url(#arrow-wine)" : "url(#arrow-ink)"}
                    />;
                  })}
                </svg>

                {project.nodes.map((node) => {
                  const rx = node.absX;
                  const ry = node.absY;
                  return (
                    <button
                      key={node.uid}
                      data-focus-uid={node.uid}
                      className={`focus-card art-${node.artwork % 5} ${selectedUidSet.has(node.uid) ? "selected" : ""} ${selectedUid === node.uid ? "primary-selected" : ""}`}
                      style={{ left: worldX(node.absX), top: worldY(node.absY), width: NODE_W, height: NODE_H }}
                      onPointerDown={(event) => handleNodePointerDown(event, node)}
                      onPointerMove={handleNodePointerMove}
                      onPointerUp={handleNodePointerUp}
                      onPointerCancel={handleNodePointerUp}
                      onLostPointerCapture={handleNodePointerUp}
                      onClick={(event) => {
                        if (event.detail !== 0) return;
                        if (event.shiftKey) toggleSelection(node.uid);
                        else { setSelectedUid(node.uid); setSelectedUids([node.uid]); }
                      }}
                      aria-pressed={selectedUidSet.has(node.uid)}
                      aria-label={ui.focusCoordinate(node.name || node.id, rx, ry)}
                    >
                      <span className="card-art" aria-hidden="true" />
                      <span className="card-copy"><strong>{node.name || ui.unnamedFocus}</strong><small>{node.id || "missing_id"}</small></span>
                      <span className="card-meta"><span><Focus size={12} />x {rx} · y {ry}</span><span>{ui.days(node.days)}</span></span>
                    </button>
                  );
                })}
              </div>

              {marqueeBox && (
                <div
                  className="selection-marquee"
                  style={{ left: marqueeBox.left, top: marqueeBox.top, width: marqueeBox.width, height: marqueeBox.height }}
                  aria-hidden="true"
                />
              )}
              <div className="canvas-help"><MousePointer2 size={14} />{ui.canvasHelp}</div>
              <div className="zoom-controls" aria-label={ui.zoomControls} onPointerDown={(event) => event.stopPropagation()}>
                <button onClick={() => zoomBy(0.88)} aria-label={ui.zoomOut}><ZoomOut size={17} /></button>
                <span>{Math.round(view.zoom * 100)}%</span>
                <button onClick={() => zoomBy(1.14)} aria-label={ui.zoomIn}><ZoomIn size={17} /></button>
                <button onClick={fitView} aria-label={ui.fitCanvas}><Maximize2 size={17} /></button>
              </div>
            </div>
          ) : (
            <div className="code-preview panel-paper">
              <div className="code-preview-head">
                <div><span className="eyebrow">EXPORT PREVIEW</span><h2>{ui.gameFilePreview}</h2></div>
                <button className="secondary-button" onClick={() => copyFile("focus")}><Clipboard size={15} />{ui.copyFocus}</button>
              </div>
              <div className="code-grid">
                <article><header><FileText size={15} /><span>{focusFilename}</span><button onClick={exportFocus}><Download size={14} />{ui.download}</button></header><pre>{focusScript}</pre></article>
                <article><header><Languages size={15} /><span>{localisationFilename}</span><button onClick={exportLocalisation}><Download size={14} />{ui.download}</button></header><pre>{localisation}</pre></article>
              </div>
            </div>
          )}
        </section>

        <aside className="utility-rail" aria-label={ui.navigationAndExport}>
          <section className="utility-card panel-paper search-card" aria-label={ui.searchFocus}>
            <label className="search-label" htmlFor="focus-search"><Search size={16} />{ui.searchFocus}</label>
            <div className="search-input-wrap">
              <input id="focus-search" ref={searchRef} type="search" value={searchQuery} placeholder={ui.searchPlaceholder} autoComplete="off" onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => {
                if (event.key === "Enter" && searchResults.length) { event.preventDefault(); locateNodes([searchResults[0].uid]); }
                if (event.key === "Escape") { event.stopPropagation(); setSearchQuery(""); event.currentTarget.blur(); }
              }} />
              {searchQuery && <button onClick={() => { setSearchQuery(""); searchRef.current?.focus(); }} aria-label={ui.clearSearch}><X size={14} /></button>}
            </div>
            {searchQuery.trim() && <>
              <p className="workflow-help" role="status">{searchResults.length ? ui.searchResults(searchResults.length) : ui.noSearchResults}</p>
              <div className="search-results">{searchResults.map((node) => <button key={node.uid} onClick={() => locateNodes([node.uid])} aria-pressed={selectedUid === node.uid}>
                <strong>{node.name || ui.unnamedFocus}</strong><small>{node.id} · {ui.days(node.days)}</small>
              </button>)}</div>
            </>}
          </section>
          <section className="utility-card panel-paper minimap-card">
            <div className="utility-heading">
              <div>
                <span className="eyebrow">NAVIGATOR</span>
                <div className="navigator-title-row">
                  <h2>{ui.navigator}</h2>
                  <span className="navigator-total" title={ui.totalDaysHelp}>{ui.totalDays(totalDays)}</span>
                </div>
              </div>
              <LocateFixed size={18} />
            </div>
            <button className="minimap" onClick={fitView} aria-label={ui.fitAllFocuses}>
              <svg viewBox={`${minimapBounds.x} ${minimapBounds.y} ${minimapBounds.width} ${minimapBounds.height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                {prerequisiteEdges.map(({ parentUid, childUid, isOr }) => {
                  const parent = nodeByUid.get(parentUid);
                  const child = nodeByUid.get(childUid);
                  if (!parent || !child) return null;
                  return <line key={`${parentUid}-${childUid}`} className={isOr ? "or" : ""} x1={worldX(parent.absX) + NODE_W / 2} y1={worldY(parent.absY) + NODE_H / 2} x2={worldX(child.absX) + NODE_W / 2} y2={worldY(child.absY) + NODE_H / 2} />;
                })}
                {mutualPairs.map(({ firstUid, secondUid }) => {
                  const first = nodeByUid.get(firstUid);
                  const second = nodeByUid.get(secondUid);
                  if (!first || !second) return null;
                  return <line key={`${firstUid}-${secondUid}`} className="mutual" x1={worldX(first.absX) + NODE_W / 2} y1={worldY(first.absY) + NODE_H / 2} x2={worldX(second.absX) + NODE_W / 2} y2={worldY(second.absY) + NODE_H / 2} />;
                })}
                {project.nodes.map((node) => <rect key={node.uid} className={selectedUidSet.has(node.uid) ? "active" : ""} x={worldX(node.absX)} y={worldY(node.absY)} width={NODE_W} height={NODE_H} rx="12" />)}
              </svg>
              <span>{ui.globalLayout}</span>
            </button>
          </section>

          <section className="utility-card panel-paper project-card">
            <div className="utility-heading"><div><span className="eyebrow">PROJECT</span><h2>{ui.projectSettings}</h2></div><Settings2 size={18} /></div>
            <label>{ui.treeId}<input ref={treeIdRef} value={project.treeId} onChange={(event) => patchProject({ treeId: event.target.value }, "treeId")} onBlur={() => { editSessionRef.current = null; }} /></label>
            <label>{ui.countryTag}<input ref={countryTagRef} disabled={Boolean(project.sourceText)} value={project.countryTag} maxLength={12} onChange={(event) => patchProject({ countryTag: event.target.value.toUpperCase() }, "countryTag")} /></label>
            {project.sourceText && <p className="workflow-help">{ui.sourceTreeHelp}</p>}
            <label>{ui.localisationLanguage}
              <select
                value={project.localisationLanguage}
                onChange={(event) => patchProject({ localisationLanguage: event.target.value as LocalisationLanguage })}
              >
                {LOCALISATION_LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.labels[uiLanguage]}</option>)}
              </select>
            </label>
            <p className="language-note">{ui.localisationLanguageNote}</p>
          </section>

          <section className="utility-card panel-paper export-card">
            <div className="utility-heading"><div><span className="eyebrow">EXPORT</span><h2>{ui.exportFiles}</h2></div><Download size={18} /></div>
            <button className="export-button primary" onClick={exportFocus}><FileText size={18} /><span><strong>{ui.focusScript}</strong><small>common/national_focus · .txt</small></span><Download size={16} /></button>
            <button className="export-button" onClick={exportLocalisation}><Languages size={18} /><span><strong>{ui.localisationExport(activeLocalisationLabel)}</strong><small>localisation/{project.localisationLanguage} · .yml</small></span><Download size={16} /></button>
            <div className="copy-file-actions"><button className="copy-all" onClick={() => copyFile("focus")}><Clipboard size={15} />{ui.copyFocus}</button><button className="copy-all" onClick={() => copyFile("localisation")}><Clipboard size={15} />{ui.copyLocalisation}</button></div>
            <button className="copy-all" onClick={backupProject} title={ui.backupHelp}><Save size={15} />{ui.backupProject}</button>
            <button className="copy-all" onClick={() => setPasteImportOpen(true)}><Upload size={15} />{ui.pasteFiles}</button>
            <p className="import-note"><AlertTriangle size={12} />{ui.importNote}</p>
          </section>

          <section className="utility-card panel-paper issues-panel" aria-label={ui.issuesTitle}>
            <button className={`validation-card ${validation.errors.length ? "has-errors" : validation.warnings.length ? "has-warnings" : ""}`} aria-expanded={issuesOpen} aria-controls="issue-list" onClick={() => setIssuesOpen(!issuesOpen)}>
              {validation.issues.length ? <AlertTriangle size={19} /> : <CheckCircle2 size={19} />}
              <span className="validation-summary"><strong>{validation.issues.length ? `${ui.errorCount(validation.errors.length)} · ${ui.warningCount(validation.warnings.length)}` : ui.readyToExport}</strong><span>{ui.issuesTitle} {issuesOpen ? "−" : "+"}</span></span>
            </button>
            {issuesOpen && <div id="issue-list" className="issue-list">
              <p className="workflow-help">{validation.issues.length ? ui.issueHelp : ui.projectSummary(project.nodes.length, prerequisiteEdges.length, mutualPairs.length)}</p>
              {validation.issues.map((issue, index) => <button key={`${issue.tone}-${index}`} className={`issue-item ${issue.tone}`} onClick={() => locateIssue(issue)} title={issue.uids.length ? ui.locateIssue : ui.projectSettings}>
                <span className="issue-severity">{issue.tone === "error" ? ui.errorCount(1) : ui.warningCount(1)}</span>
                <span>{issue.message}</span><LocateFixed size={14} />
              </button>)}
            </div>}
          </section>
        </aside>
      </section>

      <footer className="statusbar">
        <span><Link2 size={13} />{ui.prerequisiteRelations(prerequisiteEdges.length)}</span>
        <span><Ban size={13} />{ui.mutualRelations(mutualPairs.length)}</span>
        <span><MousePointer2 size={13} />{ui.gridSnapOn}</span>
        <span className="status-spacer" />
        <span>{selectedUids.length > 1 ? ui.selectedFocusCount(selectedUids.length) : selected ? ui.selectedFocus(selected.id) : ui.noSelectedFocus}</span>
        <span>{ui.focusCount(project.nodes.length)}</span>
      </footer>

      {toast && (
        <div className={`toast ${toast.tone}`} role="status">
          {toast.tone === "success" ? <Check size={17} /> : <AlertTriangle size={17} />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} aria-label={ui.closeToast}><Minus size={14} /></button>
        </div>
      )}

      {pasteImportOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPasteImportOpen(false);
        }}>
          <section className="import-modal panel-paper" role="dialog" aria-modal="true" aria-labelledby="paste-import-title">
            <div className="import-modal-head">
              <div><span className="eyebrow">TEXT IMPORT</span><h2 id="paste-import-title">{ui.textImport}</h2></div>
              <button onClick={() => setPasteImportOpen(false)} aria-label={ui.closeTextImport}><Minus size={16} /></button>
            </div>
            <div className="import-modal-grid">
              <label>{ui.focusTreeScriptFile}<textarea value={focusImportDraft} onChange={(event) => setFocusImportDraft(event.target.value)} placeholder="focus_tree = { ... }" spellCheck={false} /></label>
              <label>{ui.optionalLocalisation(activeLocalisationLabel)}<textarea value={localisationImportDraft} onChange={(event) => setLocalisationImportDraft(event.target.value)} placeholder={`l_${project.localisationLanguage}:\n TAG_focus:0 "${ui.focusNamePlaceholder}"`} spellCheck={false} /></label>
            </div>
            <p className="modal-warning"><AlertTriangle size={14} />{ui.importModalWarning}</p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setPasteImportOpen(false)}>{ui.cancel}</button>
              <button className="primary-button" onClick={importPastedText}><Upload size={15} />{ui.parseAndImport}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
