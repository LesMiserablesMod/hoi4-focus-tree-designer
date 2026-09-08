type EditableNode = {
  uid: string;
  absX: number;
  absY: number;
  days: number;
  prerequisiteGroups: string[][];
  prerequisiteGroupsBeforeMutualMerge?: string[][];
  mutuallyExclusiveUids: string[];
  relativeToUid: string | null;
};

/** Only the requested field changes; imported scripts and relations stay attached. */
export function setSelectionDays<T extends EditableNode>(nodes: T[], uids: string[], days: number): T[] {
  if (!Number.isSafeInteger(days) || days < 1) return nodes;
  const selected = new Set(uids);
  return nodes.map((node) => selected.has(node.uid) && node.days !== days ? { ...node, days } : node);
}

/** Arrange in spatial order, using the primary node's row/column and two grid units. */
export function arrangeSelection<T extends EditableNode>(nodes: T[], uids: string[], primaryUid: string, axis: "row" | "column"): T[] {
  const selected = new Set(uids);
  const members = nodes.filter((node) => selected.has(node.uid));
  if (members.length < 2) return nodes;
  const primary = members.find((node) => node.uid === primaryUid) ?? members[0];
  members.sort((a, b) => axis === "row"
    ? a.absX - b.absX || a.absY - b.absY || a.uid.localeCompare(b.uid)
    : a.absY - b.absY || a.absX - b.absX || a.uid.localeCompare(b.uid));
  const start = Math.min(...members.map((node) => axis === "row" ? node.absX : node.absY));
  const positions = new Map(members.map((node, index) => [node.uid, axis === "row"
    ? { absX: start + index * 2, absY: primary.absY }
    : { absX: primary.absX, absY: start + index * 2 }]));
  return nodes.map((node) => {
    const position = positions.get(node.uid);
    return position && (node.absX !== position.absX || node.absY !== position.absY) ? { ...node, ...position } : node;
  });
}

/** Remove a selection and all managed references, including recoverable AND groups. */
export function removeSelection<T extends EditableNode>(nodes: T[], uids: string[]): T[] {
  const selected = new Set(uids);
  if (!nodes.some((node) => selected.has(node.uid)) || nodes.every((node) => selected.has(node.uid))) return nodes;
  const cleanGroups = (groups: string[][]) => groups.map((group) => group.filter((uid) => !selected.has(uid))).filter((group) => group.length);
  return nodes.filter((node) => !selected.has(node.uid)).map((node) => ({
    ...node,
    prerequisiteGroups: cleanGroups(node.prerequisiteGroups),
    prerequisiteGroupsBeforeMutualMerge: node.prerequisiteGroupsBeforeMutualMerge && cleanGroups(node.prerequisiteGroupsBeforeMutualMerge),
    mutuallyExclusiveUids: node.mutuallyExclusiveUids.filter((uid) => !selected.has(uid)),
    relativeToUid: node.relativeToUid && selected.has(node.relativeToUid) ? null : node.relativeToUid,
  }));
}

export function findFocuses<T extends { id: string; name: string }>(nodes: T[], query: string): T[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return nodes.filter((node) => {
    const text = `${node.id} ${node.name}`.toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });
}
