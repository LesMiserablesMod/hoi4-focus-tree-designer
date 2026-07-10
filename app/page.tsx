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
  Languages,
  Link2,
  LocateFixed,
  Map as MapIcon,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  Redo2,
  Save,
  Settings2,
  Trash2,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type FocusNode = {
  uid: string;
  id: string;
  name: string;
  description: string;
  days: number;
  absX: number;
  absY: number;
  prerequisiteGroups: string[][];
  mutuallyExclusiveUids: string[];
  relativeToUid: string | null;
  artwork: number;
};

type UiLanguage = "zh-CN" | "en";

const DEFAULT_UI_LANGUAGE: UiLanguage = "zh-CN";
const UI_LANGUAGE_STORAGE_KEY = "hoi4-focus-tree-ui-language";

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

const DEFAULT_LOCALISATION_LANGUAGE: LocalisationLanguage = "simp_chinese";

function isLocalisationLanguage(value: unknown): value is LocalisationLanguage {
  return typeof value === "string" && LOCALISATION_LANGUAGES.some((language) => language.code === value);
}

function isUiLanguage(value: unknown): value is UiLanguage {
  return value === "zh-CN" || value === "en";
}

function localisationSettings(language: LocalisationLanguage) {
  return LOCALISATION_LANGUAGES.find((item) => item.code === language) ?? LOCALISATION_LANGUAGES[8];
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
    pageTitle: "HOI4 国策树设计器",
    appTitle: "国策树设计器",
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
    save: "保存",
    import: "导入",
    addFocus: "添加国策",
    focusProperties: "国策属性",
    focusId: "国策 ID",
    localisationName: "本地化名称",
    localisationDescription: "本地化描述",
    completionDays: "完成天数",
    prerequisiteGroups: "前置条件组",
    prerequisiteLogic: "组间 AND · 组内 OR",
    addAndGroup: "添加 AND 组",
    prerequisiteHelp: "每一组至少完成一个；存在多组时，需要每组都满足。",
    noPrerequisite: "暂无前置国策",
    and: "并且",
    conditionGroup: (index: number) => `条件组 ${index}`,
    anyCompleteOr: "任一完成 OR",
    mustComplete: "必须完成",
    deletePrerequisiteGroup: (index: number) => `删除前置条件组 ${index}`,
    removePrerequisite: (name: string) => `移除前置国策 ${name}`,
    addPrerequisite: (index: number) => `向前置条件组 ${index} 添加国策`,
    addOrAlternative: " OR 备选",
    addFocusOption: "国策",
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
    canvasHelp: "拖动节点 · 方向键微调 · 滚轮缩放",
    zoomControls: "缩放控制",
    zoomOut: "缩小",
    zoomIn: "放大",
    fitCanvas: "适应画布",
    gameFilePreview: "游戏文件预览",
    copyAll: "复制全部",
    download: "下载",
    navigationAndExport: "导航与导出",
    navigator: "导航器",
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
    importNote: "导入仅解析布局、前置、互斥与本地化；高级效果和注释不会被覆盖保存。",
    errorCount: (count: number) => `${count} 个错误`,
    warningCount: (count: number) => `${count} 个提醒`,
    readyToExport: "可以导出",
    projectSummary: (focuses: number, prerequisites: number, mutuals: number) => `${focuses} 个国策 · ${prerequisites} 条前置 · ${mutuals} 条互斥`,
    prerequisiteRelations: (count: number) => `${count} 条前置关系`,
    mutualRelations: (count: number) => `${count} 条互斥关系`,
    gridSnapOn: "网格吸附：开启",
    selectedFocus: (id: string) => `选中：${id}`,
    noSelectedFocus: "未选择节点",
    focusCount: (count: number) => `${count} 个国策`,
    closeToast: "关闭提示",
    textImport: "粘贴文本导入",
    closeTextImport: "关闭粘贴导入",
    focusTreeScriptFile: "国策树脚本（.txt）",
    optionalLocalisation: (language: string) => `${language}本地化（可选）`,
    focusNamePlaceholder: "国策名称",
    importModalWarning: "导入会替换当前画布；不支持的效果、图标与注释不会保留，请先保存原文件。",
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
    importedFocuses: (count: number) => `已导入 ${count} 个国策。高级效果与图标不会进入这个轻量布局项目。`,
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
    invalidDays: (id: string) => `${id}：完成天数必须是正整数`,
    duplicateId: (id: string) => `${id}：ID 重复`,
    emptyPrerequisiteGroup: (id: string, index: number) => `${id}：前置条件组 ${index} 为空`,
    selfPrerequisite: (id: string) => `${id}：不能将自身设为前置国策`,
    invalidPrerequisiteReference: (id: string) => `${id}：前置国策引用已失效`,
    allPrerequisitesMutual: (id: string) => `${id}：某个前置条件组中的国策均与其互斥`,
    selfMutual: (id: string) => `${id}：不能与自身互斥`,
    invalidMutualReference: (id: string) => `${id}：互斥国策引用已失效`,
    unsyncedMutual: (id: string) => `${id}：互斥关系未双向同步`,
    prerequisiteDeadlock: "前置条件存在无法满足的循环或死锁",
    relativeReferenceCycle: "相对坐标引用存在循环",
    coordinateOverlap: (ids: string[]) => `${ids.join("、")}：坐标重叠`,
  },
  en: {
    pageTitle: "HOI4 Focus Tree Designer",
    appTitle: "Focus Tree Designer",
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
    save: "Save",
    import: "Import",
    addFocus: "Add Focus",
    focusProperties: "Focus Properties",
    focusId: "Focus ID",
    localisationName: "Localisation Name",
    localisationDescription: "Localisation Description",
    completionDays: "Completion Days",
    prerequisiteGroups: "Prerequisite Groups",
    prerequisiteLogic: "AND between groups · OR within a group",
    addAndGroup: "Add AND Group",
    prerequisiteHelp: "Complete at least one focus in every group; all groups must be satisfied.",
    noPrerequisite: "No prerequisites yet",
    and: "and",
    conditionGroup: (index: number) => `Group ${index}`,
    anyCompleteOr: "Any one · OR",
    mustComplete: "Required",
    deletePrerequisiteGroup: (index: number) => `Delete prerequisite group ${index}`,
    removePrerequisite: (name: string) => `Remove prerequisite ${name}`,
    addPrerequisite: (index: number) => `Add a focus to prerequisite group ${index}`,
    addOrAlternative: " OR alternative",
    addFocusOption: "focus",
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
    canvasHelp: "Drag nodes · Arrow keys to nudge · Wheel to zoom",
    zoomControls: "Zoom controls",
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    fitCanvas: "Fit canvas",
    gameFilePreview: "Game File Preview",
    copyAll: "Copy All",
    download: "Download",
    navigationAndExport: "Navigation and export",
    navigator: "Navigator",
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
    importNote: "Import reads layout, prerequisites, mutual exclusions, and localisation only. Advanced effects and comments are not preserved.",
    errorCount: (count: number) => `${count} ${count === 1 ? "error" : "errors"}`,
    warningCount: (count: number) => `${count} ${count === 1 ? "warning" : "warnings"}`,
    readyToExport: "Ready to Export",
    projectSummary: (focuses: number, prerequisites: number, mutuals: number) => `${focuses} ${focuses === 1 ? "focus" : "focuses"} · ${prerequisites} ${prerequisites === 1 ? "prerequisite" : "prerequisites"} · ${mutuals} mutual ${mutuals === 1 ? "link" : "links"}`,
    prerequisiteRelations: (count: number) => `${count} prerequisite ${count === 1 ? "link" : "links"}`,
    mutualRelations: (count: number) => `${count} mutual ${count === 1 ? "link" : "links"}`,
    gridSnapOn: "Grid snap: On",
    selectedFocus: (id: string) => `Selected: ${id}`,
    noSelectedFocus: "No node selected",
    focusCount: (count: number) => `${count} ${count === 1 ? "focus" : "focuses"}`,
    closeToast: "Dismiss notification",
    textImport: "Paste Text Import",
    closeTextImport: "Close text import",
    focusTreeScriptFile: "Focus tree script (.txt)",
    optionalLocalisation: (language: string) => `${language} localisation (optional)`,
    focusNamePlaceholder: "Focus name",
    importModalWarning: "Import replaces the current canvas. Unsupported effects, icons, and comments are not preserved; save the original files first.",
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
    importedFocuses: (count: number) => `Imported ${count} ${count === 1 ? "focus" : "focuses"}. Advanced effects and icons are not retained in this lightweight layout project.`,
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
    invalidDays: (id: string) => `${id}: completion days must be a positive integer`,
    duplicateId: (id: string) => `${id}: duplicate ID`,
    emptyPrerequisiteGroup: (id: string, index: number) => `${id}: prerequisite group ${index} is empty`,
    selfPrerequisite: (id: string) => `${id}: a focus cannot be its own prerequisite`,
    invalidPrerequisiteReference: (id: string) => `${id}: a prerequisite reference is invalid`,
    allPrerequisitesMutual: (id: string) => `${id}: every focus in one prerequisite group is mutually exclusive with this focus`,
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
  treeId: string;
  countryTag: string;
  localisationLanguage: LocalisationLanguage;
  nodes: FocusNode[];
};

type ViewState = { x: number; y: number; zoom: number };
type ToastState = { tone: "success" | "warning" | "error"; message: string } | null;

const GRID_X = 116;
const GRID_Y = 154;
const NODE_W = 218;
const NODE_H = 126;
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
      name: "国家重建",
      description: "重新整合国家机构，为未来的发展奠定稳定基础。",
      days: 70,
      absX: 0,
      absY: 0,
      prerequisiteGroups: [],
      mutuallyExclusiveUids: [],
      relativeToUid: null,
      artwork: 0,
    },
    {
      uid: "industrial-recovery",
      id: "TAG_industrial_recovery",
      name: "工业复兴",
      description: "重建国家工业基础，解锁新的生产能力。",
      days: 70,
      absX: -2,
      absY: 2,
      prerequisiteGroups: [["root-rebuild"]],
      mutuallyExclusiveUids: [],
      relativeToUid: "root-rebuild",
      artwork: 1,
    },
    {
      uid: "army-reform",
      id: "TAG_army_reform",
      name: "军备整顿",
      description: "整顿军备体系，为陆军现代化做好准备。",
      days: 70,
      absX: 2,
      absY: 2,
      prerequisiteGroups: [["root-rebuild"]],
      mutuallyExclusiveUids: [],
      relativeToUid: "root-rebuild",
      artwork: 2,
    },
    {
      uid: "research-cooperation",
      id: "TAG_research_cooperation",
      name: "科研合作",
      description: "联合大学与工业实验室，加快技术成果转化。",
      days: 70,
      absX: -2,
      absY: 4,
      prerequisiteGroups: [["industrial-recovery"]],
      mutuallyExclusiveUids: [],
      relativeToUid: "industrial-recovery",
      artwork: 3,
    },
    {
      uid: "homeland-defense",
      id: "TAG_homeland_defense",
      name: "国土防线",
      description: "加固边境与战略要地，建立纵深防御体系。",
      days: 70,
      absX: 2,
      absY: 4,
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
      mutuallyExclusiveUids: [...node.mutuallyExclusiveUids],
    })),
  };
}

function completeMutualGroups(nodes: FocusNode[]): FocusNode[] {
  const validUids = new Set(nodes.map((node) => node.uid));
  const order = new Map(nodes.map((node, index) => [node.uid, index]));
  const adjacency = new Map(nodes.map((node) => [node.uid, new Set<string>()]));

  nodes.forEach((node) => {
    node.mutuallyExclusiveUids.forEach((otherUid) => {
      if (otherUid === node.uid || !validUids.has(otherUid)) return;
      adjacency.get(node.uid)?.add(otherUid);
      adjacency.get(otherUid)?.add(node.uid);
    });
  });

  const visited = new Set<string>();
  const peersByUid = new Map<string, string[]>();
  nodes.forEach((node) => {
    if (visited.has(node.uid)) return;
    const members: string[] = [];
    const queue = [node.uid];
    visited.add(node.uid);
    while (queue.length) {
      const uid = queue.shift()!;
      members.push(uid);
      adjacency.get(uid)?.forEach((otherUid) => {
        if (visited.has(otherUid)) return;
        visited.add(otherUid);
        queue.push(otherUid);
      });
    }
    members.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
    members.forEach((uid) => peersByUid.set(uid, members.filter((memberUid) => memberUid !== uid)));
  });

  return nodes.map((node) => ({
    ...node,
    mutuallyExclusiveUids: peersByUid.get(node.uid) ?? [],
  }));
}

function normalizeProject(value: unknown): ProjectState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as {
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
      days: Number.isFinite(node.days) ? Math.max(1, Math.round(Number(node.days))) : 70,
      absX: Number.isFinite(node.absX) ? Number(node.absX) : 0,
      absY: Number.isFinite(node.absY) ? Number(node.absY) : 0,
      prerequisiteGroups: groups,
      mutuallyExclusiveUids: Array.isArray(node.mutuallyExclusiveUids)
        ? node.mutuallyExclusiveUids.filter((uid): uid is string => typeof uid === "string")
        : [],
      relativeToUid: typeof node.relativeToUid === "string" ? node.relativeToUid : null,
      artwork: Number.isFinite(node.artwork) ? Number(node.artwork) : 0,
    } satisfies FocusNode];
  });
  if (!provisional.length) return null;

  const validUids = new Set(provisional.map((node) => node.uid));
  const sanitizedNodes = provisional.map((node) => ({
    ...node,
    prerequisiteGroups: node.prerequisiteGroups
      .map((group) => [...new Set(group.filter((uid) => uid !== node.uid && validUids.has(uid)))])
      .filter((group) => group.length),
    mutuallyExclusiveUids: [...new Set(node.mutuallyExclusiveUids.filter((uid) => uid !== node.uid && validUids.has(uid)))],
    relativeToUid: node.relativeToUid && node.relativeToUid !== node.uid && validUids.has(node.relativeToUid) ? node.relativeToUid : null,
  }));
  const nodes = completeMutualGroups(sanitizedNodes);

  return {
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

function escapeLocalisation(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n");
}

function unescapeLocalisation(value: string) {
  return value.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function safeToken(value: string, fallback: string) {
  const cleaned = value.trim().replace(/[^A-Za-z0-9_.:-]+/g, "_");
  return cleaned || fallback;
}

function focusCostFromDays(days: number) {
  return String(Number((Math.max(1, days) / 7).toFixed(6)));
}

function generateFocusScript(project: ProjectState) {
  const normalizedNodes = completeMutualGroups(project.nodes);
  const nodeByUid = new Map(normalizedNodes.map((node) => [node.uid, node]));
  const sorted = [...normalizedNodes].sort((a, b) => a.absY - b.absY || a.absX - b.absX);
  const treeId = safeToken(project.treeId, "custom_focus_tree");
  const tag = safeToken(project.countryTag.toUpperCase(), "TAG");

  const focuses = sorted
    .map((node) => {
      const anchor = node.relativeToUid ? nodeByUid.get(node.relativeToUid) : undefined;
      const x = anchor ? node.absX - anchor.absX : node.absX;
      const y = anchor ? node.absY - anchor.absY : node.absY;
      const relativeLine = anchor ? `\n\t\trelative_position_id = ${anchor.id}` : "";
      const prerequisiteLines = node.prerequisiteGroups
        .map((group) => group.map((uid) => nodeByUid.get(uid)?.id).filter(Boolean) as string[])
        .filter((group) => group.length)
        .map((group) => `\t\tprerequisite = { ${group.map((id) => `focus = ${id}`).join(" ")} }`);
      const mutuallyExclusiveIds = node.mutuallyExclusiveUids
        .map((uid) => nodeByUid.get(uid)?.id)
        .filter(Boolean) as string[];
      const relationLines = [
        ...prerequisiteLines,
        ...(mutuallyExclusiveIds.length
          ? [`\t\tmutually_exclusive = { ${mutuallyExclusiveIds.map((id) => `focus = ${id}`).join(" ")} }`]
          : []),
      ];
      const relationSection = relationLines.length ? `\n\n${relationLines.join("\n")}` : "";

      return `\tfocus = {
\t\tid = ${safeToken(node.id, "unnamed_focus")}
\t\ticon = GFX_goal_generic_construct_civ_factory
\t\tx = ${x}
\t\ty = ${y}${relativeLine}
\t\tcost = ${focusCostFromDays(node.days)}${relationSection}

\t\tcompletion_reward = {
\t\t\tadd_political_power = 0
\t\t}
\t}`;
    })
    .join("\n\n");

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

${focuses}
}
`;
}

function generateLocalisation(project: ProjectState) {
  const lines = [...project.nodes]
    .sort((a, b) => a.absY - b.absY || a.absX - b.absX)
    .flatMap((node) => [
      ` ${safeToken(node.id, "unnamed_focus")}:0 "${escapeLocalisation(node.name || node.id)}"`,
      ` ${safeToken(node.id, "unnamed_focus")}_desc:0 "${escapeLocalisation(node.description)}"`,
    ]);
  return `l_${project.localisationLanguage}:\n${lines.join("\n")}\n`;
}

function findMatchingBrace(text: string, openIndex: number) {
  let depth = 0;
  let quote = false;
  let comment = false;
  for (let i = openIndex; i < text.length; i += 1) {
    const char = text[i];
    const previous = text[i - 1];
    if (comment) {
      if (char === "\n") comment = false;
      continue;
    }
    if (!quote && char === "#") {
      comment = true;
      continue;
    }
    if (char === '"' && previous !== "\\") quote = !quote;
    if (quote) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractBlocks(text: string, key: string, uiLanguage: UiLanguage = DEFAULT_UI_LANGUAGE) {
  const blocks: string[] = [];
  const matcher = new RegExp(`\\b${key}\\s*=\\s*\\{`, "g");
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text))) {
    const openIndex = text.indexOf("{", match.index);
    const closeIndex = findMatchingBrace(text, openIndex);
    if (closeIndex < 0) throw new Error(UI_MESSAGES[uiLanguage].missingClosingBrace(key));
    blocks.push(text.slice(openIndex + 1, closeIndex));
    matcher.lastIndex = closeIndex + 1;
  }
  return blocks;
}

function scalar(block: string, key: string) {
  const matcher = new RegExp(`\\b${key}\\s*=\\s*(?:"([^"]*)"|([^\\s#}]+))`);
  const match = block.match(matcher);
  return match?.[1] ?? match?.[2] ?? "";
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
  const treeBlocks = extractBlocks(text.replace(/^\uFEFF/, ""), "focus_tree", uiLanguage);
  if (!treeBlocks.length) throw new Error(ui.noFocusTree);
  const treeBlock = treeBlocks[0];
  const focusBlocks = extractBlocks(treeBlock, "focus", uiLanguage);
  if (!focusBlocks.length) throw new Error(ui.noFocusBlock);

  const raw = focusBlocks.map((block, index) => {
    const id = scalar(block, "id") || `imported_focus_${index + 1}`;
    const focusIdsInBlock = (relationBlock: string) => {
      const ids: string[] = [];
      const matcher = /\bfocus\s*=\s*(?:"([^"]*)"|([^\s#}]+))/g;
      let match: RegExpExecArray | null;
      while ((match = matcher.exec(relationBlock))) ids.push(match[1] ?? match[2]);
      return ids;
    };
    const prerequisiteIdGroups = extractBlocks(block, "prerequisite", uiLanguage)
      .map(focusIdsInBlock)
      .filter((group) => group.length);
    const mutuallyExclusiveIds = extractBlocks(block, "mutually_exclusive", uiLanguage).flatMap(focusIdsInBlock);
    const parsedCost = Number.parseFloat(scalar(block, "cost") || "10");
    return {
      id,
      x: Number.parseInt(scalar(block, "x") || "0", 10),
      y: Number.parseInt(scalar(block, "y") || "0", 10),
      relativeId: scalar(block, "relative_position_id") || null,
      prerequisiteIdGroups,
      mutuallyExclusiveIds,
      days: Number.isFinite(parsedCost) && parsedCost > 0 ? Math.max(1, Math.round(parsedCost * 7)) : 70,
      artwork: index % 5,
    };
  });

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
    };
  });
  const nodes = completeMutualGroups(baseNodes);

  return {
    treeId: scalar(treeBlock, "id") || "imported_focus_tree",
    countryTag: scalar(treeBlock, "tag") || "TAG",
    localisationLanguage,
    nodes,
  } satisfies ProjectState;
}

function validationFor(project: ProjectState, uiLanguage: UiLanguage) {
  const ui = UI_MESSAGES[uiLanguage];
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Map<string, number>();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(project.treeId.trim())) errors.push(ui.invalidTreeId);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(project.countryTag.trim())) errors.push(ui.invalidCountryTag);
  project.nodes.forEach((node) => {
    const id = node.id.trim();
    ids.set(id, (ids.get(id) ?? 0) + 1);
    if (!id) errors.push(ui.missingFocusId);
    else if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(id)) errors.push(ui.invalidFocusId(id));
    if (!node.name.trim()) warnings.push(ui.missingFocusName(id || ui.unnamedFocus));
    if (!Number.isInteger(node.days) || node.days < 1) errors.push(ui.invalidDays(id || ui.unnamedFocus));
  });
  ids.forEach((count, id) => {
    if (id && count > 1) errors.push(ui.duplicateId(id));
  });

  const nodeByUid = new Map(project.nodes.map((node) => [node.uid, node]));
  project.nodes.forEach((node) => {
    node.prerequisiteGroups.forEach((group, index) => {
      if (!group.length) warnings.push(ui.emptyPrerequisiteGroup(node.id, index + 1));
      if (group.includes(node.uid)) errors.push(ui.selfPrerequisite(node.id));
      if (group.some((uid) => !nodeByUid.has(uid))) errors.push(ui.invalidPrerequisiteReference(node.id));
      if (group.length && group.every((uid) => node.mutuallyExclusiveUids.includes(uid))) {
        errors.push(ui.allPrerequisitesMutual(node.id));
      }
    });
    node.mutuallyExclusiveUids.forEach((uid) => {
      if (uid === node.uid) errors.push(ui.selfMutual(node.id));
      const other = nodeByUid.get(uid);
      if (!other) errors.push(ui.invalidMutualReference(node.id));
      else if (!other.mutuallyExclusiveUids.includes(node.uid)) warnings.push(ui.unsyncedMutual(node.id));
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
  if (reachable.size !== project.nodes.length) errors.push(ui.prerequisiteDeadlock);

  const visitRelative = (uid: string, path: Set<string>): boolean => {
    if (path.has(uid)) return true;
    const node = project.nodes.find((item) => item.uid === uid);
    if (!node?.relativeToUid) return false;
    return visitRelative(node.relativeToUid, new Set(path).add(uid));
  };
  if (project.nodes.some((node) => visitRelative(node.uid, new Set()))) errors.push(ui.relativeReferenceCycle);

  const occupied = new Map<string, string[]>();
  project.nodes.forEach((node) => {
    const key = `${node.absX},${node.absY}`;
    occupied.set(key, [...(occupied.get(key) ?? []), node.id]);
  });
  occupied.forEach((nodeIds) => {
    if (nodeIds.length > 1) warnings.push(ui.coordinateOverlap(nodeIds));
  });
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
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
        <button type="button" onClick={() => onChange([...groups, []])}><Plus size={13} />{ui.addAndGroup}</button>
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
                <option value="">＋ {ui.addFocus}{group.length ? ui.addOrAlternative : ` ${ui.addFocusOption}`}</option>
                {candidates.filter((node) => !group.includes(node.uid)).map((node) => <option key={node.uid} value={node.uid}>{node.name || node.id}</option>)}
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
            {candidates.map((node) => <option key={node.uid} value={node.uid}>{node.name || node.id}</option>)}
          </select>
        </div>
        {!values.length && <span className="inline-empty">{ui.noMutual}</span>}
      </div>
    </section>
  );
}

export default function Home() {
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(DEFAULT_UI_LANGUAGE);
  const [project, setProject] = useState<ProjectState>(initialProject);
  const [selectedUid, setSelectedUid] = useState(initialProject.nodes[1].uid);
  const [past, setPast] = useState<ProjectState[]>([]);
  const [future, setFuture] = useState<ProjectState[]>([]);
  const [view, setView] = useState<ViewState>({ x: -290, y: 18, zoom: 0.82 });
  const [mode, setMode] = useState<"edit" | "code">("edit");
  const [toast, setToast] = useState<ToastState>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [ready, setReady] = useState(false);
  const [pasteImportOpen, setPasteImportOpen] = useState(false);
  const [focusImportDraft, setFocusImportDraft] = useState("");
  const [localisationImportDraft, setLocalisationImportDraft] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef(project);
  const dragRef = useRef<{
    uid: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startAbsX: number;
    startAbsY: number;
    before: ProjectState;
    moved: boolean;
  } | null>(null);
  const panRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const ui = UI_MESSAGES[uiLanguage];
  const selected = project.nodes.find((node) => node.uid === selectedUid) ?? null;
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
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedUiLanguage = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
        if (isUiLanguage(savedUiLanguage)) setUiLanguage(savedUiLanguage);
        const saved = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
        if (saved) {
          const parsed = normalizeProject(JSON.parse(saved));
          if (parsed) {
            setProject(parsed);
            setSelectedUid(parsed.nodes[0].uid);
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
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
        setSaveState("saved");
      } catch {
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

  function commit(next: ProjectState) {
    setPast((items) => [...items.slice(-59), cloneProject(projectRef.current)]);
    setFuture([]);
    setSaveState("saving");
    setProject(next);
  }

  function patchProject(patch: Partial<ProjectState>) {
    commit({ ...projectRef.current, ...patch });
  }

  function patchNode(uid: string, patch: Partial<FocusNode>) {
    commit({
      ...projectRef.current,
      nodes: projectRef.current.nodes.map((node) => (node.uid === uid ? { ...node, ...patch } : node)),
    });
  }

  function setMutuallyExclusive(uid: string, nextUids: string[]) {
    const currentNodes = completeMutualGroups(projectRef.current.nodes);
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

    const nodes = completeMutualGroups(currentNodes.map((node) => ({
      ...node,
      mutuallyExclusiveUids: [...(adjacency.get(node.uid) ?? [])],
    })));
    commit({
      ...projectRef.current,
      nodes,
    });
  }

  function undo() {
    setPast((items) => {
      if (!items.length) return items;
      const previous = items[items.length - 1];
      setFuture((next) => [cloneProject(projectRef.current), ...next].slice(0, 60));
      setProject(previous);
      if (!previous.nodes.some((node) => node.uid === selectedUid)) setSelectedUid(previous.nodes[0]?.uid ?? "");
      return items.slice(0, -1);
    });
  }

  function redo() {
    setFuture((items) => {
      if (!items.length) return items;
      const next = items[0];
      setPast((previous) => [...previous.slice(-59), cloneProject(projectRef.current)]);
      setProject(next);
      if (!next.nodes.some((node) => node.uid === selectedUid)) setSelectedUid(next.nodes[0]?.uid ?? "");
      return items.slice(1);
    });
  }

  function addNode() {
    const index = project.nodes.length + 1;
    const anchor = selected;
    let uidIndex = index;
    while (project.nodes.some((node) => node.uid === `focus-${uidIndex}`)) uidIndex += 1;
    const occupied = new Set(project.nodes.map((node) => `${node.absX},${node.absY}`));
    const baseX = anchor?.absX ?? 0;
    const baseY = (anchor?.absY ?? -2) + 2;
    const offsets = [0, 2, -2, 1, -1, 3, -3, 4, -4];
    let position = { x: baseX, y: baseY };
    outer: for (let row = 0; row < 20; row += 1) {
      for (const offset of offsets) {
        const candidate = { x: baseX + offset, y: baseY + row * 2 };
        if (!occupied.has(`${candidate.x},${candidate.y}`)) {
          position = candidate;
          break outer;
        }
      }
    }
    const node: FocusNode = {
      uid: `focus-${uidIndex}`,
      id: `${safeToken(project.countryTag.toUpperCase(), "TAG")}_new_focus_${index}`,
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
    setMode("edit");
    setToast({ tone: "success", message: ui.newFocusCreated });
  }

  function duplicateNode(uid: string) {
    const source = nodeByUid.get(uid);
    if (!source) return;
    let copyIndex = 1;
    while (project.nodes.some((node) => node.uid === `${source.uid}-copy-${copyIndex}`)) copyIndex += 1;
    const copy: FocusNode = {
      ...source,
      uid: `${source.uid}-copy-${copyIndex}`,
      id: `${source.id}_copy`,
      name: `${source.name}${ui.copySuffix}`,
      absX: source.absX + 1,
      absY: source.absY + 1,
      prerequisiteGroups: source.prerequisiteGroups.map((group) => [...group]),
      mutuallyExclusiveUids: [],
    };
    commit({ ...project, nodes: [...project.nodes, copy] });
    setSelectedUid(copy.uid);
  }

  function removeNode(uid: string) {
    if (project.nodes.length <= 1) {
      setToast({ tone: "warning", message: ui.keepOneFocus });
      return;
    }
    const nextNodes = project.nodes
      .filter((node) => node.uid !== uid)
      .map((node) => ({
        ...node,
        prerequisiteGroups: node.prerequisiteGroups
          .map((group) => group.filter((item) => item !== uid))
          .filter((group) => group.length),
        mutuallyExclusiveUids: node.mutuallyExclusiveUids.filter((item) => item !== uid),
        relativeToUid: node.relativeToUid === uid ? null : node.relativeToUid,
      }));
    commit({ ...project, nodes: nextNodes });
    setSelectedUid(nextNodes[0]?.uid ?? "");
    setToast({ tone: "success", message: ui.nodeRemoved });
  }

  function moveNodeBy(uid: string, deltaX: number, deltaY: number) {
    const current = projectRef.current.nodes.find((node) => node.uid === uid);
    if (!current) return;
    commit({
      ...projectRef.current,
      nodes: projectRef.current.nodes.map((node) =>
        node.uid === uid ? { ...node, absX: node.absX + deltaX, absY: node.absY + deltaY } : node,
      ),
    });
  }

  function handleNodePointerDown(event: ReactPointerEvent<HTMLButtonElement>, node: FocusNode) {
    if (event.button !== 0 || mode !== "edit") return;
    event.stopPropagation();
    setSelectedUid(node.uid);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      uid: node.uid,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startAbsX: node.absX,
      startAbsY: node.absY,
      before: cloneProject(projectRef.current),
      moved: false,
    };
  }

  function handleNodePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = (event.clientX - drag.startClientX) / view.zoom;
    const deltaY = (event.clientY - drag.startClientY) / view.zoom;
    const nextX = Math.round(drag.startAbsX + deltaX / GRID_X);
    const nextY = Math.round(drag.startAbsY + deltaY / GRID_Y);
    if (nextX === drag.startAbsX && nextY === drag.startAbsY && !drag.moved) return;
    drag.moved = true;
    setSaveState("saving");
    setProject((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.uid === drag.uid ? { ...node, absX: nextX, absY: nextY } : node,
      ),
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
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest(".focus-card, .zoom-controls")) return;
    setSelectedUid("");
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: view.x,
      startY: view.y,
    };
  }

  function handleCanvasPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    setView((current) => ({
      ...current,
      x: pan.startX + event.clientX - pan.startClientX,
      y: pan.startY + event.clientY - pan.startClientY,
    }));
  }

  function handleCanvasPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (panRef.current?.pointerId !== event.pointerId) return;
    panRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    setView((current) => {
      const nextZoom = clamp(current.zoom * Math.exp(-event.deltaY * 0.0011), 0.42, 1.55);
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
      const nextZoom = clamp(current.zoom * factor, 0.42, 1.55);
      const pointX = (centerX - current.x) / current.zoom;
      const pointY = (centerY - current.y) / current.zoom;
      return {
        zoom: nextZoom,
        x: centerX - pointX * nextZoom,
        y: centerY - pointY * nextZoom,
      };
    });
  }

  function fitView() {
    const rect = canvasRef.current?.getBoundingClientRect();
    const nodes = projectRef.current.nodes;
    if (!rect || !nodes.length) return;
    const left = Math.min(...nodes.map((node) => worldX(node.absX)));
    const right = Math.max(...nodes.map((node) => worldX(node.absX) + NODE_W));
    const top = Math.min(...nodes.map((node) => worldY(node.absY)));
    const bottom = Math.max(...nodes.map((node) => worldY(node.absY) + NODE_H));
    const zoom = clamp(Math.min((rect.width - 100) / (right - left), (rect.height - 100) / (bottom - top)), 0.42, 1.1);
    setView({
      zoom,
      x: (rect.width - (right - left) * zoom) / 2 - left * zoom,
      y: (rect.height - (bottom - top) * zoom) / 2 - top * zoom,
    });
  }

  function applyImportedProject(
    focusText: string,
    localisationMap: Map<string, string>,
    localisationLanguage: LocalisationLanguage = projectRef.current.localisationLanguage,
  ) {
    const imported = parseFocusScript(focusText, localisationMap, localisationLanguage, uiLanguage);
    commit(imported);
    setSelectedUid(imported.nodes[0]?.uid ?? "");
    setMode("edit");
    window.setTimeout(fitView, 60);
    setToast({
      tone: "warning",
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
      const focusFile = texts.find((item) => /\bfocus_tree\s*=\s*\{/.test(item.text));
      const localisationCandidates = texts.filter((item) => /^\uFEFF?\s*l_[A-Za-z_]+\s*:/m.test(item.text));
      const localisationFiles = texts.flatMap((item) => {
        const language = detectLocalisationLanguage(item.text);
        return language ? [{ ...item, language }] : [];
      });
      if (localisationCandidates.length && !localisationFiles.length) {
        throw new Error(ui.unsupportedLanguageCode);
      }
      const preferredLocalisation = localisationFiles.find(
        (item) => item.language === projectRef.current.localisationLanguage,
      ) ?? localisationFiles[0];
      const localisationMap = preferredLocalisation
        ? parseLocalisation(preferredLocalisation.text)
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

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(`# common/national_focus/${focusFilename}\n\n${focusScript}\n# localisation/${project.localisationLanguage}/${localisationFilename}\n\n${localisation}`);
      setToast({ tone: "success", message: ui.copiedToClipboard });
    } catch {
      setToast({ tone: "error", message: ui.clipboardDenied });
    }
  }

  function saveNow() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      setSaveState("saved");
      setToast({ tone: "success", message: ui.draftSaved });
    } catch {
      setToast({ tone: "error", message: ui.draftSaveFailed });
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const editing = target.matches("input, textarea, select, [contenteditable='true']");
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      } else if (!editing && selectedUid && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        const step = event.shiftKey ? 2 : 1;
        const directions: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        };
        const [deltaX, deltaY] = directions[event.key];
        moveNodeBy(selectedUid, deltaX, deltaY);
      } else if (!editing && (event.key === "Delete" || event.key === "Backspace") && selectedUid) {
        event.preventDefault();
        removeNode(selectedUid);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

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
          <div className="ui-language-switch" role="group" aria-label={ui.interfaceLanguage}>
            <Languages size={14} aria-hidden="true" />
            <button className={uiLanguage === "zh-CN" ? "active" : ""} onClick={() => setUiLanguage("zh-CN")} aria-pressed={uiLanguage === "zh-CN"} title={ui.chineseInterface}>中</button>
            <button className={uiLanguage === "en" ? "active" : ""} onClick={() => setUiLanguage("en")} aria-pressed={uiLanguage === "en"} title={ui.englishInterface}>EN</button>
          </div>
          <span className="save-indicator"><span className={saveState === "saving" ? "saving-dot" : "saved-dot"} />{saveState === "saving" ? ui.saving : ui.saved}</span>
          <button className="icon-button" onClick={undo} disabled={!past.length} aria-label={ui.undo} title={`${ui.undo} Ctrl+Z`}><Undo2 size={17} /></button>
          <button className="icon-button" onClick={redo} disabled={!future.length} aria-label={ui.redo} title={`${ui.redo} Ctrl+Y`}><Redo2 size={17} /></button>
          <button className="secondary-button" onClick={saveNow}><Save size={16} />{ui.save}</button>
          <label className="secondary-button file-button"><Upload size={16} />{ui.import}<input type="file" accept=".txt,.yml,.yaml" multiple onChange={handleImport} /></label>
          <button className="primary-button" onClick={addNode}><Plus size={17} />{ui.addFocus}</button>
        </div>
      </header>

      <section className="workspace">
        <aside className="inspector panel-paper" aria-label={ui.focusProperties}>
          <div className="panel-heading">
            <div><span className="eyebrow">FOCUS</span><h2>{ui.focusProperties}</h2></div>
            <span className="folio">№ {String(project.nodes.findIndex((node) => node.uid === selectedUid) + 1).padStart(3, "0")}</span>
          </div>

          {selected ? (
            <div className="inspector-form">
              <label>{ui.focusId}<input value={selected.id} spellCheck={false} onChange={(event) => patchNode(selected.uid, { id: event.target.value })} /></label>
              <label>{ui.localisationName} · {activeLocalisationLabel}<input value={selected.name} onChange={(event) => patchNode(selected.uid, { name: event.target.value })} /></label>
              <label>{ui.localisationDescription} · {activeLocalisationLabel}<textarea value={selected.description} rows={6} onChange={(event) => patchNode(selected.uid, { description: event.target.value })} /></label>
              <label>{ui.completionDays}<input type="number" min="1" step="1" value={selected.days} onChange={(event) => {
                const days = event.currentTarget.valueAsNumber;
                if (Number.isFinite(days)) patchNode(selected.uid, { days: Math.max(1, Math.round(days)) });
              }} /></label>

              <div className="ornament-rule"><span /></div>

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
                  {project.nodes.filter((node) => node.uid !== selected.uid).map((node) => <option key={node.uid} value={node.uid}>{node.name || node.id}</option>)}
                </select>
              </label>

              <div className="coordinate-card">
                <div><span>{ui.relativeX}</span><strong>{relativeX}</strong></div>
                <div><span>{ui.relativeY}</span><strong>{relativeY}</strong></div>
                <small><MousePointer2 size={13} />{ui.dragToEditCoordinates}</small>
              </div>

              <div className="node-actions">
                <button onClick={() => duplicateNode(selected.uid)}><Copy size={15} />{ui.duplicate}</button>
                <button className="danger" onClick={() => removeNode(selected.uid)}><Trash2 size={15} />{ui.delete}</button>
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

        <section className="canvas-column">
          {mode === "edit" ? (
            <div
              className="focus-canvas"
              ref={canvasRef}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerCancel={handleCanvasPointerUp}
              onWheel={handleWheel}
              aria-label={ui.draggableCanvas}
            >
              <div className="coordinate-ruler ruler-top" aria-hidden="true"><span>-6</span><span>-4</span><span>-2</span><span>0</span><span>2</span><span>4</span><span>6</span></div>
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
                    const highlighted = selectedUid === firstUid || selectedUid === secondUid;
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
                    const highlighted = selectedUid === child.uid || selectedUid === parent.uid;
                    return <path
                      key={`${parentUid}->${childUid}`}
                      className={`connector prerequisite ${isOr ? "or" : ""} ${highlighted ? "selected" : ""}`}
                      d={buildPrerequisitePath(parent, child)}
                      markerEnd={highlighted ? "url(#arrow-wine)" : "url(#arrow-ink)"}
                    />;
                  })}
                </svg>

                {project.nodes.map((node) => {
                  const anchor = node.relativeToUid ? nodeByUid.get(node.relativeToUid) : null;
                  const rx = node.absX - (anchor?.absX ?? 0);
                  const ry = node.absY - (anchor?.absY ?? 0);
                  return (
                    <button
                      key={node.uid}
                      className={`focus-card art-${node.artwork % 5} ${selectedUid === node.uid ? "selected" : ""}`}
                      style={{ left: worldX(node.absX), top: worldY(node.absY), width: NODE_W, height: NODE_H }}
                      onPointerDown={(event) => handleNodePointerDown(event, node)}
                      onPointerMove={handleNodePointerMove}
                      onPointerUp={handleNodePointerUp}
                      onPointerCancel={handleNodePointerUp}
                      aria-label={ui.focusCoordinate(node.name || node.id, rx, ry)}
                    >
                      <span className="card-art" aria-hidden="true" />
                      <span className="card-copy"><strong>{node.name || ui.unnamedFocus}</strong><small>{node.id || "missing_id"}</small></span>
                      <span className="card-meta"><span><Focus size={12} />x {rx} · y {ry}</span><span>{ui.days(node.days)}</span></span>
                    </button>
                  );
                })}
              </div>

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
                <button className="secondary-button" onClick={copyAll}><Clipboard size={15} />{ui.copyAll}</button>
              </div>
              <div className="code-grid">
                <article><header><FileText size={15} /><span>{focusFilename}</span><button onClick={exportFocus}><Download size={14} />{ui.download}</button></header><pre>{focusScript}</pre></article>
                <article><header><Languages size={15} /><span>{localisationFilename}</span><button onClick={exportLocalisation}><Download size={14} />{ui.download}</button></header><pre>{localisation}</pre></article>
              </div>
            </div>
          )}
        </section>

        <aside className="utility-rail" aria-label={ui.navigationAndExport}>
          <section className="utility-card panel-paper minimap-card">
            <div className="utility-heading"><div><span className="eyebrow">NAVIGATOR</span><h2>{ui.navigator}</h2></div><LocateFixed size={18} /></div>
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
                {project.nodes.map((node) => <rect key={node.uid} className={node.uid === selectedUid ? "active" : ""} x={worldX(node.absX)} y={worldY(node.absY)} width={NODE_W} height={NODE_H} rx="12" />)}
              </svg>
              <span>{ui.globalLayout}</span>
            </button>
          </section>

          <section className="utility-card panel-paper project-card">
            <div className="utility-heading"><div><span className="eyebrow">PROJECT</span><h2>{ui.projectSettings}</h2></div><Settings2 size={18} /></div>
            <label>{ui.treeId}<input value={project.treeId} onChange={(event) => patchProject({ treeId: event.target.value })} /></label>
            <label>{ui.countryTag}<input value={project.countryTag} maxLength={12} onChange={(event) => patchProject({ countryTag: event.target.value.toUpperCase() })} /></label>
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
            <button className="copy-all" onClick={copyAll}><Clipboard size={15} />{ui.copyTwoFiles}</button>
            <button className="copy-all" onClick={() => setPasteImportOpen(true)}><Upload size={15} />{ui.pasteFiles}</button>
            <p className="import-note"><AlertTriangle size={12} />{ui.importNote}</p>
          </section>

          <section className={`validation-card ${validation.errors.length ? "has-errors" : validation.warnings.length ? "has-warnings" : ""}`}>
            {validation.errors.length || validation.warnings.length ? <AlertTriangle size={19} /> : <CheckCircle2 size={19} />}
            <div><strong>{validation.errors.length ? ui.errorCount(validation.errors.length) : validation.warnings.length ? ui.warningCount(validation.warnings.length) : ui.readyToExport}</strong><span>{validation.errors[0] ?? validation.warnings[0] ?? ui.projectSummary(project.nodes.length, prerequisiteEdges.length, mutualPairs.length)}</span></div>
          </section>
        </aside>
      </section>

      <footer className="statusbar">
        <span><Link2 size={13} />{ui.prerequisiteRelations(prerequisiteEdges.length)}</span>
        <span><Ban size={13} />{ui.mutualRelations(mutualPairs.length)}</span>
        <span><MousePointer2 size={13} />{ui.gridSnapOn}</span>
        <span className="status-spacer" />
        <span>{selected ? ui.selectedFocus(selected.id) : ui.noSelectedFocus}</span>
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
