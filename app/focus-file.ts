import { preserveUnmanagedFocusScript, resolveScriptNumber, topLevelBlockBodies, topLevelScalar, topLevelScalars } from './hoi4-script.ts';

export type SourceValues = { cost: string; days: number; x: string; y: string; relativeX: number; relativeY: number; relativeId: string | null };

/** Validate everything before replacing the user's current project. */
export function readFocusTree(text: string) {
  const sourceText = text.replace(/^\uFEFF/, '');
  const treeBlocks = topLevelBlockBodies(sourceText, 'focus_tree');
  if (!treeBlocks.length) throw new Error('No focus_tree / 没有找到国策树');
  const treeBlock = treeBlocks[0];
  const focusBlocks = topLevelBlockBodies(treeBlock, 'focus');
  if (!focusBlocks.length) throw new Error('No editable focus blocks / 该树没有可编辑的 focus 块');
  const ids = new Set<string>();
  const nodes = focusBlocks.map((block, index) => {
    const id = topLevelScalar(block, 'id');
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(id)) throw new Error(`Invalid focus ID / 无效国策 ID: ${id || `#${index + 1}`}`);
    if (ids.has(id)) throw new Error(`Duplicate focus ID / 请先修复重复国策 ID: ${id}`);
    ids.add(id);
    const xToken = topLevelScalar(block, 'x');
    const yToken = topLevelScalar(block, 'y');
    const costToken = topLevelScalar(block, 'cost');
    const contexts = [sourceText, treeBlock, block];
    const x = resolveScriptNumber(xToken, contexts, 0);
    const y = resolveScriptNumber(yToken, contexts, 0);
    const cost = resolveScriptNumber(costToken, contexts, 10);
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) throw new Error(`${id}: Coordinates must be integers / 坐标必须为整数`);
    if (cost < 0) throw new Error(`${id}: Invalid cost / cost 不能为负数`);
    const relativeId = topLevelScalar(block, 'relative_position_id') || null;
    const days = Number((cost * 7).toFixed(6));
    return {
      id, x, y, relativeId, days, artwork: index % 5,
      prerequisiteIdGroups: topLevelBlockBodies(block, 'prerequisite').map((body) => topLevelScalars(body, 'focus')),
      mutuallyExclusiveIds: topLevelBlockBodies(block, 'mutually_exclusive').flatMap((body) => topLevelScalars(body, 'focus')),
      scriptExtras: preserveUnmanagedFocusScript(block),
      sourceValues: { x: xToken, y: yToken, cost: costToken, days, relativeX: x, relativeY: y, relativeId } satisfies SourceValues,
    };
  });
  for (const node of nodes) {
    const refs = [...node.prerequisiteIdGroups.flat(), ...node.mutuallyExclusiveIds, ...(node.relativeId ? [node.relativeId] : [])];
    const missing = [...new Set(refs.filter((id) => !ids.has(id)))];
    if (missing.length) throw new Error(`${node.id}: Unresolved external focuses / 当前树未包含引用的国策: ${missing.join(', ')}. Import a complete tree / 请先补齐依赖定义；当前画布未替换。`);
  }
  const countryBlock = topLevelBlockBodies(treeBlock, 'country')[0] ?? '';
  const conditions = [countryBlock, ...topLevelBlockBodies(countryBlock, 'modifier')];
  const countryTag = conditions.map((body) => topLevelScalar(body, 'tag') || topLevelScalar(body, 'original_tag')).find(Boolean) || 'TAG';
  return { sourceText, treeCount: treeBlocks.length, treeId: topLevelScalar(treeBlock, 'id') || 'imported_focus_tree', countryTag, nodes };
}

export function uniqueFocusId(existing: { id: string }[], base: string) {
  const ids = new Set(existing.map((node) => node.id));
  let candidate = base;
  let index = 2;
  while (ids.has(candidate)) candidate = `${base}_${index++}`;
  return candidate;
}

export function reservedFocusIds(source: string) {
  const otherTrees = topLevelBlockBodies(source, 'focus_tree').slice(1);
  return [...otherTrees.flatMap((tree) => topLevelBlockBodies(tree, 'focus')), ...topLevelBlockBodies(source, 'shared_focus')]
    .map((block) => ({ id: topLevelScalar(block, 'id') })).filter((node) => node.id);
}

export function decodeLocalisation(value: string) {
  return value.replace(/\\(\\|"|n)/g, (_, token: string) => token === 'n' ? '\n' : token);
}
