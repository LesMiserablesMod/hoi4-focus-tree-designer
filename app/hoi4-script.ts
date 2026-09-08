const MANAGED_FOCUS_FIELDS = new Set([
  "id",
  "x",
  "y",
  "relative_position_id",
  "cost",
  "prerequisite",
  "mutually_exclusive",
]);

type AssignmentSpan = {
  key: string;
  start: number;
  end: number;
  valueStart: number;
  valueEnd: number;
  isBlock: boolean;
};

function isIdentifierCharacter(character: string) {
  return /[A-Za-z0-9_.:@-]/.test(character);
}

function isEscaped(text: string, index: number) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) slashCount += 1;
  return slashCount % 2 === 1;
}

function quotedValueEnd(text: string, quoteIndex: number) {
  for (let cursor = quoteIndex + 1; cursor < text.length; cursor += 1) {
    if (text[cursor] === '"' && !isEscaped(text, cursor)) return cursor + 1;
  }
  throw new Error("Unclosed quoted string / 字符串缺少结束引号");
}

function bracedValueEnd(text: string, openIndex: number) {
  let depth = 0;
  let inQuote = false;
  let inComment = false;

  for (let cursor = openIndex; cursor < text.length; cursor += 1) {
    const character = text[cursor];
    if (inComment) {
      if (character === "\n") inComment = false;
      continue;
    }
    if (!inQuote && character === "#") {
      inComment = true;
      continue;
    }
    if (character === '"' && !isEscaped(text, cursor)) inQuote = !inQuote;
    if (inQuote) continue;
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return cursor + 1;
    }
  }

  throw new Error("Unclosed script block / 脚本缺少右花括号");
}

export function topLevelAssignments(text: string) {
  const assignments: AssignmentSpan[] = [];
  let cursor = 0;
  const skipTrivia = (start: number) => {
    let index = start;
    while (index < text.length) {
      if (/\s/.test(text[index])) index += 1;
      else if (text[index] === "#") {
        const newline = text.indexOf("\n", index);
        index = newline < 0 ? text.length : newline + 1;
      } else break;
    }
    return index;
  };

  while (cursor < text.length) {
    const character = text[cursor];
    if (character === "}") throw new Error("Unexpected closing brace / 多余的右花括号");
    if (character === "#") {
      const newline = text.indexOf("\n", cursor + 1);
      cursor = newline < 0 ? text.length : newline + 1;
      continue;
    }
    if (character === '"') {
      cursor = quotedValueEnd(text, cursor);
      continue;
    }
    if (!isIdentifierCharacter(character)) {
      cursor += 1;
      continue;
    }

    const start = cursor;
    while (cursor < text.length && isIdentifierCharacter(text[cursor])) cursor += 1;
    const key = text.slice(start, cursor);
    const equalsIndex = skipTrivia(cursor);
    if (text[equalsIndex] !== "=") continue;

    const valueIndex = skipTrivia(equalsIndex + 1);
    let end = valueIndex;
    if (text[valueIndex] === "{") {
      end = bracedValueEnd(text, valueIndex);
    } else if (text[valueIndex] === '"') {
      end = quotedValueEnd(text, valueIndex);
    } else {
      while (end < text.length && !/[\s#}]/.test(text[end])) end += 1;
    }

    assignments.push({
      key,
      start,
      end,
      valueStart: valueIndex,
      valueEnd: end,
      isBlock: text[valueIndex] === "{",
    });
    cursor = Math.max(end, cursor + 1);
  }

  return assignments;
}

/** Returns only blocks assigned at the current brace depth. */
export function topLevelBlockBodies(text: string, key: string) {
  return topLevelAssignments(text)
    .filter((assignment) => assignment.key === key && assignment.isBlock)
    .map((assignment) => {
      const hasClosingBrace = text[assignment.valueEnd - 1] === "}";
      return text.slice(
        assignment.valueStart + 1,
        Math.max(assignment.valueStart + 1, assignment.valueEnd - (hasClosingBrace ? 1 : 0)),
      );
    });
}

/** Returns a scalar assigned at the current brace depth, ignoring nested effects. */
export function topLevelScalar(text: string, key: string) {
  const assignment = topLevelAssignments(text)
    .find((candidate) => candidate.key === key && !candidate.isBlock);
  if (!assignment) return "";
  const value = text.slice(assignment.valueStart, assignment.valueEnd);
  return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}

export function topLevelScalars(text: string, key: string) {
  return topLevelAssignments(text).filter((item) => item.key === key && !item.isBlock).map((item) => {
    const value = text.slice(item.valueStart, item.valueEnd);
    return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
  });
}

/** Resolve literal numbers and local @variables; never substitute a guessed value. */
export function resolveScriptNumber(token: string, sources: string[], fallback: number) {
  if (!token) return fallback;
  const variables = new Map<string, string>();
  sources.forEach((source) => topLevelAssignments(source).forEach((item) => {
    if (item.key.startsWith("@") && !item.isBlock) variables.set(item.key, source.slice(item.valueStart, item.valueEnd));
  }));
  const seen = new Set<string>();
  let value = token;
  while (value.startsWith("@")) {
    if (seen.has(value) || !variables.has(value)) throw new Error(`Cannot resolve / 无法解析变量 ${token}`);
    seen.add(value);
    value = variables.get(value)!;
  }
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) throw new Error(`Unsupported numeric value / 不支持的数值 ${token}`);
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Invalid numeric value / 无效数值 ${token}`);
  return number;
}

/** Replace edited focuses in their original slots; retain all other trees and fields. */
export function renderImportedTree(source: string, treeId: string, focuses: { sourceId?: string; script: string }[]) {
  const tree = topLevelAssignments(source).find((item) => item.key === "focus_tree" && item.isBlock);
  if (!tree) throw new Error("Missing focus_tree");
  const body = source.slice(tree.valueStart + 1, tree.valueEnd - 1);
  const bySourceId = new Map(focuses.filter((focus) => focus.sourceId).map((focus) => [focus.sourceId, focus]));
  const used = new Set<string>();
  let output = "";
  let cursor = 0;
  let hasId = false;
  for (const item of topLevelAssignments(body)) {
    if (item.key === "id" && !item.isBlock) {
      output += body.slice(cursor, item.valueStart) + treeId;
      cursor = item.valueEnd;
      hasId = true;
    } else if (item.key === "focus" && item.isBlock) {
      const sourceId = topLevelScalar(body.slice(item.valueStart + 1, item.valueEnd - 1), "id");
      const replacement = bySourceId.get(sourceId);
      output += body.slice(cursor, item.start) + (replacement?.script.trimStart() ?? "");
      cursor = item.end;
      used.add(sourceId);
    }
  }
  output += body.slice(cursor);
  if (!hasId) output = `\n\tid = ${treeId}\n${output}`;
  const added = focuses.filter((focus) => !focus.sourceId || !used.has(focus.sourceId));
  if (added.length) output += `\n${added.map((focus) => focus.script).join("\n\n")}\n`;
  return source.slice(0, tree.valueStart + 1) + output + source.slice(tree.valueEnd - 1);
}

const FOCUS_REFERENCE_KEYS = new Set(["focus", "has_completed_focus", "complete_national_focus", "uncomplete_national_focus", "relative_position_id"]);

/** Update exact recognized references, never comments, prose, or arbitrary identifiers. */
export function renameFocusReferences(source: string, previousId: string, nextId: string): string {
  let output = "";
  let cursor = 0;
  for (const item of topLevelAssignments(source)) {
    if (item.isBlock) {
      output += source.slice(cursor, item.valueStart + 1) + renameFocusReferences(source.slice(item.valueStart + 1, item.valueEnd - 1), previousId, nextId);
      cursor = item.valueEnd - 1;
    } else if (FOCUS_REFERENCE_KEYS.has(item.key)) {
      const value = source.slice(item.valueStart, item.valueEnd);
      if (value === previousId || value === `"${previousId}"`) {
        output += source.slice(cursor, item.valueStart) + (value.startsWith('"') ? `"${nextId}"` : nextId);
        cursor = item.valueEnd;
      }
    }
  }
  return output + source.slice(cursor);
}

/**
 * Removes only the fields controlled by the visual editor from a focus body.
 * Everything else, including nested effects and comments, remains attached to
 * the node and is emitted again on export.
 */
export function preserveUnmanagedFocusScript(focusBody: string) {
  const managedSpans = topLevelAssignments(focusBody)
    .filter(({ key }) => MANAGED_FOCUS_FIELDS.has(key))
    .sort((first, second) => first.start - second.start);
  if (!managedSpans.length) return focusBody.trim();

  let cursor = 0;
  let preserved = "";
  managedSpans.forEach(({ start, end }) => {
    preserved += focusBody.slice(cursor, start);
    cursor = end;
  });
  preserved += focusBody.slice(cursor);

  return preserved
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n")
    .replace(/^(?:[ \t]*\n)+/, "")
    .replace(/[ \t\n]+$/, "");
}

function indentationWidth(line: string) {
  return line.match(/^[ \t]*/)?.[0].length ?? 0;
}

/** Formats preserved source without changing the script tokens it contains. */
export function indentPreservedFocusScript(source: string, indentation = "\t\t") {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (!lines.length) return "";

  const contentLines = lines.filter((line) => line.trim());
  const commonIndent = Math.min(...contentLines.map(indentationWidth));
  return lines
    .map((line) => line.trim() ? `${indentation}${line.slice(commonIndent)}` : "")
    .join("\n");
}

export const DEFAULT_FOCUS_SCRIPT_EXTRAS = `icon = GFX_goal_generic_construct_civ_factory

completion_reward = {
\tadd_political_power = 0
}`;

type RenderFocusScriptOptions = {
  id: string;
  x: number | string;
  y: number | string;
  relativePositionId?: string;
  cost: string;
  relationLines: string[];
  /** Undefined means a new editor node; an empty string means an imported node with no extra fields. */
  scriptExtras?: string;
};

export function renderFocusScriptBlock(options: RenderFocusScriptOptions) {
  const relativeLine = options.relativePositionId
    ? `\n\t\trelative_position_id = ${options.relativePositionId}`
    : "";
  const relationSection = options.relationLines.length
    ? `\n\n${options.relationLines.join("\n")}`
    : "";
  const extraSource = options.scriptExtras ?? DEFAULT_FOCUS_SCRIPT_EXTRAS;
  const extraLines = indentPreservedFocusScript(extraSource);
  const extraSection = extraLines ? `\n\n${extraLines}` : "";

  return `\tfocus = {
\t\tid = ${options.id}
\t\tx = ${options.x}
\t\ty = ${options.y}${relativeLine}
\t\tcost = ${options.cost}${relationSection}${extraSection}
\t}`;
}
