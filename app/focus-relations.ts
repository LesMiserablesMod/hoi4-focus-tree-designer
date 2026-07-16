export type RelationNode = {
  uid: string;
  prerequisiteGroups: string[][];
  prerequisiteGroupsBeforeMutualMerge?: string[][];
  mutuallyExclusiveUids: string[];
};

function cloneGroups(groups: string[][]) {
  return groups.map((group) => [...group]);
}

function sameUidSet(first: string[], second: string[]) {
  const firstSet = new Set(first);
  const secondSet = new Set(second);
  return firstSet.size === secondSet.size && [...firstSet].every((uid) => secondSet.has(uid));
}

export function prerequisiteBackupAfterManualEdit<T extends RelationNode>(
  node: T,
  nextGroups: string[][],
) {
  const backup = node.prerequisiteGroupsBeforeMutualMerge;
  if (!backup) return undefined;

  const unusedBackupIndexes = new Set(backup.map((_, index) => index));
  const expansions = node.prerequisiteGroups.map((currentGroup) => {
    const currentUids = new Set(currentGroup);
    const candidateIndexes = [...unusedBackupIndexes].filter((index) =>
      backup[index].length
        ? backup[index].every((uid) => currentUids.has(uid))
        : currentGroup.length === 0,
    );
    const candidateUnion = new Set(candidateIndexes.flatMap((index) => backup[index]));
    const isExactExpansion = sameUidSet([...candidateUnion], currentGroup);
    if (!isExactExpansion) return { groups: [currentGroup], wasAutoMerged: false };
    candidateIndexes.forEach((index) => unusedBackupIndexes.delete(index));
    return {
      groups: candidateIndexes.map((index) => backup[index]),
      wasAutoMerged: candidateIndexes.length > 1,
    };
  });

  const unusedCurrentIndexes = new Set(node.prerequisiteGroups.map((_, index) => index));
  let hasRestorableMerge = false;
  const nextBackup = nextGroups.flatMap((nextGroup) => {
    const matchingIndex = [...unusedCurrentIndexes].find((index) =>
      sameUidSet(node.prerequisiteGroups[index], nextGroup),
    );
    if (matchingIndex === undefined) return [nextGroup];
    unusedCurrentIndexes.delete(matchingIndex);
    const expansion = expansions[matchingIndex];
    if (expansion.wasAutoMerged) hasRestorableMerge = true;
    return expansion.wasAutoMerged ? expansion.groups : [nextGroup];
  });

  return hasRestorableMerge ? cloneGroups(nextBackup) : undefined;
}

export function restoreAutoMergedPrerequisiteGroups<T extends RelationNode>(nodes: T[]): T[] {
  return nodes.map((node) => {
    if (!node.prerequisiteGroupsBeforeMutualMerge) return node;
    return {
      ...node,
      prerequisiteGroups: cloneGroups(node.prerequisiteGroupsBeforeMutualMerge),
      prerequisiteGroupsBeforeMutualMerge: undefined,
    };
  });
}

export function completeMutualGroups<T extends RelationNode>(nodes: T[]): T[] {
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

export function prerequisiteGroupsAreFullyMutual<T extends RelationNode>(
  firstGroup: string[],
  secondGroup: string[],
  nodeByUid: ReadonlyMap<string, T>,
) {
  return firstGroup.length > 0
    && secondGroup.length > 0
    && firstGroup.every((firstUid) => secondGroup.every((secondUid) =>
      nodeByUid.get(firstUid)?.mutuallyExclusiveUids.includes(secondUid),
    ));
}

export function normalizeFocusRelations<T extends RelationNode>(nodes: T[]): T[] {
  const completedMutuals = completeMutualGroups(nodes);
  const nodeByUid = new Map(completedMutuals.map((node) => [node.uid, node]));

  return completedMutuals.map((node) => {
    const groups = node.prerequisiteGroups.map((group) => [...new Set(group)]);
    const originalGroups = cloneGroups(groups);
    const existingBackup = node.prerequisiteGroupsBeforeMutualMerge
      ? cloneGroups(node.prerequisiteGroupsBeforeMutualMerge)
      : undefined;
    let didMerge = false;
    let merged = true;

    // Separate prerequisite blocks are AND conditions in HOI4. If two entire
    // blocks are mutually exclusive, they can never both be satisfied and are
    // necessarily two alternatives of the same OR branch instead.
    while (merged) {
      merged = false;
      outer: for (let firstIndex = 0; firstIndex < groups.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < groups.length; secondIndex += 1) {
          if (!prerequisiteGroupsAreFullyMutual(groups[firstIndex], groups[secondIndex], nodeByUid)) continue;
          groups[firstIndex] = [...new Set([...groups[firstIndex], ...groups[secondIndex]])];
          groups.splice(secondIndex, 1);
          didMerge = true;
          merged = true;
          break outer;
        }
      }
    }

    return {
      ...node,
      prerequisiteGroups: groups,
      prerequisiteGroupsBeforeMutualMerge: didMerge
        ? existingBackup ?? originalGroups
        : existingBackup,
    };
  });
}

export function buildFocusRelationLines<T extends RelationNode & { id: string }>(
  node: T,
  nodeByUid: ReadonlyMap<string, T>,
) {
  const prerequisiteLines = node.prerequisiteGroups
    .map((group) => group.map((uid) => nodeByUid.get(uid)?.id).filter(Boolean) as string[])
    .filter((group) => group.length)
    .map((group) => `\t\tprerequisite = { ${group.map((id) => `focus = ${id}`).join(" ")} }`);
  const mutuallyExclusiveIds = node.mutuallyExclusiveUids
    .map((uid) => nodeByUid.get(uid)?.id)
    .filter(Boolean) as string[];

  return [
    ...prerequisiteLines,
    ...(mutuallyExclusiveIds.length
      ? [`\t\tmutually_exclusive = { ${mutuallyExclusiveIds.map((id) => `focus = ${id}`).join(" ")} }`]
      : []),
  ];
}
