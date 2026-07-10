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

type ProjectState = {
  treeId: string;
  countryTag: string;
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
  return `l_simp_chinese:\n${lines.join("\n")}\n`;
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

function extractBlocks(text: string, key: string) {
  const blocks: string[] = [];
  const matcher = new RegExp(`\\b${key}\\s*=\\s*\\{`, "g");
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text))) {
    const openIndex = text.indexOf("{", match.index);
    const closeIndex = findMatchingBrace(text, openIndex);
    if (closeIndex < 0) throw new Error(`${key} 块缺少右花括号`);
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

function parseFocusScript(text: string, localisation: Map<string, string>) {
  const treeBlocks = extractBlocks(text.replace(/^\uFEFF/, ""), "focus_tree");
  if (!treeBlocks.length) throw new Error("没有找到 focus_tree = { ... }");
  const treeBlock = treeBlocks[0];
  const focusBlocks = extractBlocks(treeBlock, "focus");
  if (!focusBlocks.length) throw new Error("国策树中没有找到 focus = { ... }");

  const raw = focusBlocks.map((block, index) => {
    const id = scalar(block, "id") || `imported_focus_${index + 1}`;
    const focusIdsInBlock = (relationBlock: string) => {
      const ids: string[] = [];
      const matcher = /\bfocus\s*=\s*(?:"([^"]*)"|([^\s#}]+))/g;
      let match: RegExpExecArray | null;
      while ((match = matcher.exec(relationBlock))) ids.push(match[1] ?? match[2]);
      return ids;
    };
    const prerequisiteIdGroups = extractBlocks(block, "prerequisite")
      .map(focusIdsInBlock)
      .filter((group) => group.length);
    const mutuallyExclusiveIds = extractBlocks(block, "mutually_exclusive").flatMap(focusIdsInBlock);
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
    if (trail.has(id)) throw new Error(`检测到相对坐标循环：${id}`);
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
    nodes,
  } satisfies ProjectState;
}

function validationFor(project: ProjectState) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Map<string, number>();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(project.treeId.trim())) errors.push("国策树 ID 为空或含无效字符");
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(project.countryTag.trim())) errors.push("国家 TAG 为空或含无效字符");
  project.nodes.forEach((node) => {
    const id = node.id.trim();
    ids.set(id, (ids.get(id) ?? 0) + 1);
    if (!id) errors.push("存在未填写 ID 的国策");
    else if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(id)) errors.push(`${id}：ID 应以字母或下划线开头，且只含字母、数字、下划线`);
    if (!node.name.trim()) warnings.push(`${id || "未命名国策"}：尚未填写名称`);
    if (!Number.isInteger(node.days) || node.days < 1) errors.push(`${id || "未命名国策"}：完成天数必须是正整数`);
  });
  ids.forEach((count, id) => {
    if (id && count > 1) errors.push(`${id}：ID 重复`);
  });

  const nodeByUid = new Map(project.nodes.map((node) => [node.uid, node]));
  project.nodes.forEach((node) => {
    node.prerequisiteGroups.forEach((group, index) => {
      if (!group.length) warnings.push(`${node.id}：前置条件组 ${index + 1} 为空`);
      if (group.includes(node.uid)) errors.push(`${node.id}：不能将自身设为前置国策`);
      if (group.some((uid) => !nodeByUid.has(uid))) errors.push(`${node.id}：前置国策引用已失效`);
      if (group.length && group.every((uid) => node.mutuallyExclusiveUids.includes(uid))) {
        errors.push(`${node.id}：某个前置条件组中的国策均与其互斥`);
      }
    });
    node.mutuallyExclusiveUids.forEach((uid) => {
      if (uid === node.uid) errors.push(`${node.id}：不能与自身互斥`);
      const other = nodeByUid.get(uid);
      if (!other) errors.push(`${node.id}：互斥国策引用已失效`);
      else if (!other.mutuallyExclusiveUids.includes(node.uid)) warnings.push(`${node.id}：互斥关系未双向同步`);
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
  if (reachable.size !== project.nodes.length) errors.push("前置条件存在无法满足的循环或死锁");

  const visitRelative = (uid: string, path: Set<string>): boolean => {
    if (path.has(uid)) return true;
    const node = project.nodes.find((item) => item.uid === uid);
    if (!node?.relativeToUid) return false;
    return visitRelative(node.relativeToUid, new Set(path).add(uid));
  };
  if (project.nodes.some((node) => visitRelative(node.uid, new Set()))) errors.push("相对坐标引用存在循环");

  const occupied = new Map<string, string[]>();
  project.nodes.forEach((node) => {
    const key = `${node.absX},${node.absY}`;
    occupied.set(key, [...(occupied.get(key) ?? []), node.id]);
  });
  occupied.forEach((nodeIds) => {
    if (nodeIds.length > 1) warnings.push(`${nodeIds.join("、")}：坐标重叠`);
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
  onChange: (groups: string[][]) => void;
};

function PrerequisiteEditor({ nodes, currentUid, groups, onChange }: PrerequisiteEditorProps) {
  const candidates = nodes.filter((node) => node.uid !== currentUid);
  const updateGroup = (index: number, nextGroup: string[]) => {
    onChange(groups.map((group, groupIndex) => groupIndex === index ? [...new Set(nextGroup)] : group));
  };

  return (
    <section className="relation-editor prerequisite-editor">
      <div className="relation-editor-head">
        <div><strong>前置条件组</strong><span>组间 AND · 组内 OR</span></div>
        <button type="button" onClick={() => onChange([...groups, []])}><Plus size={13} />添加 AND 组</button>
      </div>
      <p className="relation-help">每一组至少完成一个；存在多组时，需要每组都满足。</p>
      {!groups.length && <div className="relation-empty">暂无前置国策</div>}
      {groups.map((group, index) => (
        <div key={`prerequisite-group-${index}`}>
          {index > 0 && <div className="relation-and"><span>AND</span>并且</div>}
          <div className="relation-group-card">
            <div className="relation-group-top">
              <span>条件组 {index + 1}</span>
              <em>{group.length > 1 ? "任一完成 OR" : "必须完成"}</em>
              <button type="button" onClick={() => onChange(groups.filter((_, groupIndex) => groupIndex !== index))} aria-label={`删除前置条件组 ${index + 1}`}><X size={13} /></button>
            </div>
            <div className="relation-chips">
              {group.map((uid) => {
                const node = nodes.find((item) => item.uid === uid);
                if (!node) return null;
                return <span className="relation-chip" key={uid}>{node.name || node.id}<button type="button" onClick={() => updateGroup(index, group.filter((item) => item !== uid))} aria-label={`移除前置国策 ${node.name || node.id}`}><X size={11} /></button></span>;
              })}
              <select
                className="relation-add-select"
                value=""
                aria-label={`向前置条件组 ${index + 1} 添加国策`}
                onChange={(event) => {
                  if (event.target.value) updateGroup(index, [...group, event.target.value]);
                }}
              >
                <option value="">＋ 添加{group.length ? " OR 备选" : "国策"}</option>
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
  onChange: (uids: string[]) => void;
};

function MutualEditor({ nodes, currentUid, values, onChange }: MutualEditorProps) {
  const candidates = nodes.filter((node) => node.uid !== currentUid && !values.includes(node.uid));
  return (
    <section className="relation-editor mutual-editor">
      <div className="relation-editor-head">
        <div><strong>互斥国策组</strong><span>组内两两互斥</span></div>
        <Ban size={15} />
      </div>
      <p className="relation-help">组内每个国策都会显式列出其余全部成员，符合游戏引擎的读取方式。</p>
      <div className="relation-group-card mutual-card">
        <div className="relation-chips">
          {values.map((uid) => {
            const node = nodes.find((item) => item.uid === uid);
            if (!node) return null;
            return <span className="relation-chip mutual" key={uid}>{node.name || node.id}<button type="button" onClick={() => onChange(values.filter((item) => item !== uid))} aria-label={`移除互斥国策 ${node.name || node.id}`}><X size={11} /></button></span>;
          })}
          <select
            className="relation-add-select"
            value=""
            aria-label="添加互斥国策"
            onChange={(event) => {
              if (event.target.value) onChange([...values, event.target.value]);
            }}
          >
            <option value="">＋ 加入互斥组</option>
            {candidates.map((node) => <option key={node.uid} value={node.uid}>{node.name || node.id}</option>)}
          </select>
        </div>
        {!values.length && <span className="inline-empty">尚未设置互斥关系</span>}
      </div>
    </section>
  );
}

export default function Home() {
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

  const selected = project.nodes.find((node) => node.uid === selectedUid) ?? null;
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
  const validation = useMemo(() => validationFor(project), [project]);
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
        const saved = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
        if (saved) {
          const parsed = normalizeProject(JSON.parse(saved));
          if (parsed) {
            setProject(parsed);
            setSelectedUid(parsed.nodes[0].uid);
          }
        }
      } catch {
        setToast({ tone: "warning", message: "本地草稿已损坏，已恢复示例国策树。" });
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
        setToast({ tone: "warning", message: "浏览器无法保存本地草稿，请及时导出。" });
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [project, ready]);

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
      name: "新国策",
      description: "在这里填写国策描述。",
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
    setToast({ tone: "success", message: "已创建新国策，可直接拖到目标位置。" });
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
      name: `${source.name}（副本）`,
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
      setToast({ tone: "warning", message: "至少保留一个国策节点。" });
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
    setToast({ tone: "success", message: "节点及其引用已安全移除。" });
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

  function applyImportedProject(focusText: string, localisationMap: Map<string, string>) {
    const imported = parseFocusScript(focusText, localisationMap);
    commit(imported);
    setSelectedUid(imported.nodes[0]?.uid ?? "");
    setMode("edit");
    window.setTimeout(fitView, 60);
    setToast({
      tone: "warning",
      message: `已导入 ${imported.nodes.length} 个国策。高级效果与图标不会进入这个轻量布局项目。`,
    });
  }

  function importPastedText() {
    try {
      if (!/\bfocus_tree\s*=\s*\{/.test(focusImportDraft)) throw new Error("没有找到 focus_tree = { ... }");
      applyImportedProject(focusImportDraft, parseLocalisation(localisationImportDraft));
      setPasteImportOpen(false);
      setFocusImportDraft("");
      setLocalisationImportDraft("");
    } catch (error) {
      setToast({ tone: "error", message: `导入失败：${error instanceof Error ? error.message : "文本格式无法识别"}` });
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    try {
      const texts = await Promise.all(files.map(async (file) => ({ name: file.name, text: await file.text() })));
      const focusFile = texts.find((item) => /\bfocus_tree\s*=\s*\{/.test(item.text));
      const localisationFiles = texts.filter((item) => /^\uFEFF?\s*l_[A-Za-z_]+\s*:/m.test(item.text));
      const localisationMap = new Map<string, string>();
      localisationFiles.forEach((item) => {
        parseLocalisation(item.text).forEach((value, key) => localisationMap.set(key, value));
      });

      if (focusFile) {
        applyImportedProject(focusFile.text, localisationMap);
      } else if (localisationMap.size) {
        const next = {
          ...project,
          nodes: project.nodes.map((node) => ({
            ...node,
            name: localisationMap.get(node.id) ?? node.name,
            description: localisationMap.get(`${node.id}_desc`) ?? node.description,
          })),
        };
        commit(next);
        setToast({ tone: "success", message: "本地化已按国策 ID 合并。" });
      } else {
        throw new Error("未识别到 focus_tree 或本地化内容");
      }
    } catch (error) {
      setToast({ tone: "error", message: `导入失败：${error instanceof Error ? error.message : "文件格式无法识别"}` });
    }
  }

  function guardExport(action: () => void) {
    if (validation.errors.length) {
      setToast({ tone: "error", message: `请先处理 ${validation.errors.length} 个错误，再导出文件。` });
      return;
    }
    action();
  }

  function exportFocus() {
    guardExport(() => {
      downloadText(`${safeToken(project.treeId, "focus_tree")}.txt`, focusScript);
      setToast({ tone: "success", message: "国策脚本 TXT 已生成。" });
    });
  }

  function exportLocalisation() {
    guardExport(() => {
      downloadText(`${safeToken(project.treeId, "focus_tree")}_l_simp_chinese.yml`, localisation, true);
      setToast({ tone: "success", message: "简体中文本地化 YML 已生成（UTF-8 BOM）。" });
    });
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(`# common/national_focus/${project.treeId}.txt\n\n${focusScript}\n# localisation/simp_chinese/${project.treeId}_l_simp_chinese.yml\n\n${localisation}`);
      setToast({ tone: "success", message: "脚本与本地化已复制到剪贴板。" });
    } catch {
      setToast({ tone: "error", message: "浏览器未允许读取剪贴板，请使用下载按钮。" });
    }
  }

  function saveNow() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      setSaveState("saved");
      setToast({ tone: "success", message: "草稿已保存在当前浏览器。" });
    } catch {
      setToast({ tone: "error", message: "浏览器无法保存草稿。" });
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
    <main className="studio-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><Compass size={26} strokeWidth={1.5} /></span>
          <div>
            <h1>国策树设计器</h1>
            <p>Focus Tree Cartography Studio</p>
          </div>
        </div>

        <div className="mode-switch" role="tablist" aria-label="视图模式">
          <button className={mode === "edit" ? "active" : ""} onClick={() => setMode("edit")} role="tab" aria-selected={mode === "edit"}>
            <MapIcon size={15} /> 画布
          </button>
          <button className={mode === "code" ? "active" : ""} onClick={() => setMode("code")} role="tab" aria-selected={mode === "code"}>
            <FileCode2 size={15} /> 代码预览
          </button>
        </div>

        <div className="top-actions">
          <span className="save-indicator"><span className={saveState === "saving" ? "saving-dot" : "saved-dot"} />{saveState === "saving" ? "保存中" : "已保存"}</span>
          <button className="icon-button" onClick={undo} disabled={!past.length} aria-label="撤销" title="撤销 Ctrl+Z"><Undo2 size={17} /></button>
          <button className="icon-button" onClick={redo} disabled={!future.length} aria-label="重做" title="重做 Ctrl+Y"><Redo2 size={17} /></button>
          <button className="secondary-button" onClick={saveNow}><Save size={16} />保存</button>
          <label className="secondary-button file-button"><Upload size={16} />导入<input type="file" accept=".txt,.yml,.yaml" multiple onChange={handleImport} /></label>
          <button className="primary-button" onClick={addNode}><Plus size={17} />添加国策</button>
        </div>
      </header>

      <section className="workspace">
        <aside className="inspector panel-paper" aria-label="国策属性">
          <div className="panel-heading">
            <div><span className="eyebrow">FOCUS</span><h2>国策属性</h2></div>
            <span className="folio">№ {String(project.nodes.findIndex((node) => node.uid === selectedUid) + 1).padStart(3, "0")}</span>
          </div>

          {selected ? (
            <div className="inspector-form">
              <label>国策 ID<input value={selected.id} spellCheck={false} onChange={(event) => patchNode(selected.uid, { id: event.target.value })} /></label>
              <label>本地化名称<input value={selected.name} onChange={(event) => patchNode(selected.uid, { name: event.target.value })} /></label>
              <label>本地化描述<textarea value={selected.description} rows={6} onChange={(event) => patchNode(selected.uid, { description: event.target.value })} /></label>
              <label>完成天数<input type="number" min="1" step="1" value={selected.days} onChange={(event) => {
                const days = event.currentTarget.valueAsNumber;
                if (Number.isFinite(days)) patchNode(selected.uid, { days: Math.max(1, Math.round(days)) });
              }} /></label>

              <div className="ornament-rule"><span /></div>

              <PrerequisiteEditor
                nodes={project.nodes}
                currentUid={selected.uid}
                groups={selected.prerequisiteGroups}
                onChange={(groups) => patchNode(selected.uid, {
                  prerequisiteGroups: groups,
                  relativeToUid: selected.relativeToUid ?? groups.flat()[0] ?? null,
                })}
              />

              <MutualEditor
                nodes={project.nodes}
                currentUid={selected.uid}
                values={selected.mutuallyExclusiveUids}
                onChange={(uids) => setMutuallyExclusive(selected.uid, uids)}
              />

              <label>坐标相对于
                <select value={selected.relativeToUid ?? ""} onChange={(event) => patchNode(selected.uid, { relativeToUid: event.target.value || null })}>
                  <option value="">画布原点</option>
                  {project.nodes.filter((node) => node.uid !== selected.uid).map((node) => <option key={node.uid} value={node.uid}>{node.name || node.id}</option>)}
                </select>
              </label>

              <div className="coordinate-card">
                <div><span>相对 X</span><strong>{relativeX}</strong></div>
                <div><span>相对 Y</span><strong>{relativeY}</strong></div>
                <small><MousePointer2 size={13} />拖动节点即可修改坐标</small>
              </div>

              <div className="node-actions">
                <button onClick={() => duplicateNode(selected.uid)}><Copy size={15} />复制</button>
                <button className="danger" onClick={() => removeNode(selected.uid)}><Trash2 size={15} />删除</button>
              </div>
            </div>
          ) : (
            <div className="empty-selection">
              <MousePointer2 size={28} />
              <h3>选择一个国策</h3>
              <p>点击画布节点以编辑 ID、名称、描述与关系。</p>
              <button className="primary-button" onClick={addNode}><Plus size={16} />添加国策</button>
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
              aria-label="可拖拽国策树画布"
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
                      aria-label={`${node.name || node.id}，坐标 ${rx}, ${ry}`}
                    >
                      <span className="card-art" aria-hidden="true" />
                      <span className="card-copy"><strong>{node.name || "未命名国策"}</strong><small>{node.id || "missing_id"}</small></span>
                      <span className="card-meta"><span><Focus size={12} />x {rx} · y {ry}</span><span>{node.days} 日</span></span>
                    </button>
                  );
                })}
              </div>

              <div className="canvas-help"><MousePointer2 size={14} />拖动节点 · 方向键微调 · 滚轮缩放</div>
              <div className="zoom-controls" aria-label="缩放控制" onPointerDown={(event) => event.stopPropagation()}>
                <button onClick={() => zoomBy(0.88)} aria-label="缩小"><ZoomOut size={17} /></button>
                <span>{Math.round(view.zoom * 100)}%</span>
                <button onClick={() => zoomBy(1.14)} aria-label="放大"><ZoomIn size={17} /></button>
                <button onClick={fitView} aria-label="适应画布"><Maximize2 size={17} /></button>
              </div>
            </div>
          ) : (
            <div className="code-preview panel-paper">
              <div className="code-preview-head">
                <div><span className="eyebrow">EXPORT PREVIEW</span><h2>游戏文件预览</h2></div>
                <button className="secondary-button" onClick={copyAll}><Clipboard size={15} />复制全部</button>
              </div>
              <div className="code-grid">
                <article><header><FileText size={15} /><span>{project.treeId}.txt</span><button onClick={exportFocus}><Download size={14} />下载</button></header><pre>{focusScript}</pre></article>
                <article><header><Languages size={15} /><span>{project.treeId}_l_simp_chinese.yml</span><button onClick={exportLocalisation}><Download size={14} />下载</button></header><pre>{localisation}</pre></article>
              </div>
            </div>
          )}
        </section>

        <aside className="utility-rail" aria-label="导航与导出">
          <section className="utility-card panel-paper minimap-card">
            <div className="utility-heading"><div><span className="eyebrow">NAVIGATOR</span><h2>导航器</h2></div><LocateFixed size={18} /></div>
            <button className="minimap" onClick={fitView} aria-label="点击适应全部国策">
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
              <span>全局布局图 · 点击适应全部节点</span>
            </button>
          </section>

          <section className="utility-card panel-paper project-card">
            <div className="utility-heading"><div><span className="eyebrow">PROJECT</span><h2>项目设置</h2></div><Settings2 size={18} /></div>
            <label>国策树 ID<input value={project.treeId} onChange={(event) => patchProject({ treeId: event.target.value })} /></label>
            <label>国家 TAG<input value={project.countryTag} maxLength={12} onChange={(event) => patchProject({ countryTag: event.target.value.toUpperCase() })} /></label>
          </section>

          <section className="utility-card panel-paper export-card">
            <div className="utility-heading"><div><span className="eyebrow">EXPORT</span><h2>导出文件</h2></div><Download size={18} /></div>
            <button className="export-button primary" onClick={exportFocus}><FileText size={18} /><span><strong>国策脚本</strong><small>common/national_focus · .txt</small></span><Download size={16} /></button>
            <button className="export-button" onClick={exportLocalisation}><Languages size={18} /><span><strong>中文本地化</strong><small>localisation/simp_chinese · .yml</small></span><Download size={16} /></button>
            <button className="copy-all" onClick={copyAll}><Clipboard size={15} />复制两份文件内容</button>
            <button className="copy-all" onClick={() => setPasteImportOpen(true)}><Upload size={15} />粘贴 TXT / YML 内容</button>
            <p className="import-note"><AlertTriangle size={12} />导入仅解析布局、前置、互斥与本地化；高级效果和注释不会被覆盖保存。</p>
          </section>

          <section className={`validation-card ${validation.errors.length ? "has-errors" : validation.warnings.length ? "has-warnings" : ""}`}>
            {validation.errors.length || validation.warnings.length ? <AlertTriangle size={19} /> : <CheckCircle2 size={19} />}
            <div><strong>{validation.errors.length ? `${validation.errors.length} 个错误` : validation.warnings.length ? `${validation.warnings.length} 个提醒` : "可以导出"}</strong><span>{validation.errors[0] ?? validation.warnings[0] ?? `${project.nodes.length} 个国策 · ${prerequisiteEdges.length} 条前置 · ${mutualPairs.length} 条互斥`}</span></div>
          </section>
        </aside>
      </section>

      <footer className="statusbar">
        <span><Link2 size={13} />{prerequisiteEdges.length} 条前置关系</span>
        <span><Ban size={13} />{mutualPairs.length} 条互斥关系</span>
        <span><MousePointer2 size={13} />网格吸附：开启</span>
        <span className="status-spacer" />
        <span>{selected ? `选中：${selected.id}` : "未选择节点"}</span>
        <span>{project.nodes.length} 个国策</span>
      </footer>

      {toast && (
        <div className={`toast ${toast.tone}`} role="status">
          {toast.tone === "success" ? <Check size={17} /> : <AlertTriangle size={17} />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} aria-label="关闭提示"><Minus size={14} /></button>
        </div>
      )}

      {pasteImportOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPasteImportOpen(false);
        }}>
          <section className="import-modal panel-paper" role="dialog" aria-modal="true" aria-labelledby="paste-import-title">
            <div className="import-modal-head">
              <div><span className="eyebrow">TEXT IMPORT</span><h2 id="paste-import-title">粘贴文本导入</h2></div>
              <button onClick={() => setPasteImportOpen(false)} aria-label="关闭粘贴导入"><Minus size={16} /></button>
            </div>
            <div className="import-modal-grid">
              <label>国策树脚本（.txt）<textarea value={focusImportDraft} onChange={(event) => setFocusImportDraft(event.target.value)} placeholder="focus_tree = { ... }" spellCheck={false} /></label>
              <label>简体中文本地化（可选）<textarea value={localisationImportDraft} onChange={(event) => setLocalisationImportDraft(event.target.value)} placeholder={'l_simp_chinese:\n TAG_focus:0 "国策名称"'} spellCheck={false} /></label>
            </div>
            <p className="modal-warning"><AlertTriangle size={14} />导入会替换当前画布；不支持的效果、图标与注释不会保留，请先保存原文件。</p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setPasteImportOpen(false)}>取消</button>
              <button className="primary-button" onClick={importPastedText}><Upload size={15} />解析并导入</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
