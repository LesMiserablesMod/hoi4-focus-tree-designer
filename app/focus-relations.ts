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
  forcedByUid: ReadonlyMap<string, ReadonlySet<string>> = buildForcedCompletionMap(nodeByUid),
) {
  return firstGroup.length > 0
    && secondGroup.length > 0
    && firstGroup.every((firstUid) => secondGroup.every((secondUid) => {
      const firstForced = forcedByUid.get(firstUid) ?? new Set([firstUid]);
      const secondForced = forcedByUid.get(secondUid) ?? new Set([secondUid]);

      return [...firstForced].some((firstRequiredUid) =>
        [...secondForced].some((secondRequiredUid) =>
          nodeByUid.get(firstRequiredUid)?.mutuallyExclusiveUids.includes(secondRequiredUid)
          || nodeByUid.get(secondRequiredUid)?.mutuallyExclusiveUids.includes(firstRequiredUid),
        ),
      );
    }));
}

function prerequisiteDependencyComponents<T extends RelationNode>(nodeByUid: ReadonlyMap<string, T>) {
  let nextIndex = 0;
  const indexes = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];

  const visit = (uid: string) => {
    indexes.set(uid, nextIndex);
    lowLinks.set(uid, nextIndex);
    nextIndex += 1;
    stack.push(uid);
    onStack.add(uid);

    const parents = [...new Set(nodeByUid.get(uid)?.prerequisiteGroups.flat() ?? [])]
      .filter((parentUid) => nodeByUid.has(parentUid))
      .sort();
    parents.forEach((parentUid) => {
      if (!indexes.has(parentUid)) {
        visit(parentUid);
        lowLinks.set(uid, Math.min(lowLinks.get(uid)!, lowLinks.get(parentUid)!));
      } else if (onStack.has(parentUid)) {
        lowLinks.set(uid, Math.min(lowLinks.get(uid)!, indexes.get(parentUid)!));
      }
    });

    if (lowLinks.get(uid) !== indexes.get(uid)) return;
    const component: string[] = [];
    let memberUid: string;
    do {
      memberUid = stack.pop()!;
      onStack.delete(memberUid);
      component.push(memberUid);
    } while (memberUid !== uid);
    components.push(component.sort());
  };

  [...nodeByUid.keys()].sort().forEach((uid) => {
    if (!indexes.has(uid)) visit(uid);
  });

  const componentByUid = new Map<string, number>();
  components.forEach((component, componentIndex) => {
    component.forEach((uid) => componentByUid.set(uid, componentIndex));
  });
  const indegree = new Map(components.map((_, index) => [index, 0]));
  const dependents = new Map(components.map((_, index) => [index, new Set<number>()]));
  nodeByUid.forEach((node) => {
    const nodeComponent = componentByUid.get(node.uid)!;
    new Set(node.prerequisiteGroups.flat()).forEach((parentUid) => {
      const parentComponent = componentByUid.get(parentUid);
      if (parentComponent === undefined || parentComponent === nodeComponent) return;
      if (dependents.get(parentComponent)?.has(nodeComponent)) return;
      dependents.get(parentComponent)?.add(nodeComponent);
      indegree.set(nodeComponent, (indegree.get(nodeComponent) ?? 0) + 1);
    });
  });

  const componentKey = (index: number) => components[index][0] ?? "";
  const ready = [...indegree]
    .filter(([, count]) => count === 0)
    .map(([index]) => index)
    .sort((first, second) => componentKey(first).localeCompare(componentKey(second)));
  const orderedComponents: string[][] = [];
  while (ready.length) {
    const componentIndex = ready.shift()!;
    orderedComponents.push(components[componentIndex]);
    dependents.get(componentIndex)?.forEach((dependentIndex) => {
      const nextCount = (indegree.get(dependentIndex) ?? 0) - 1;
      indegree.set(dependentIndex, nextCount);
      if (nextCount === 0) {
        ready.push(dependentIndex);
        ready.sort((first, second) => componentKey(first).localeCompare(componentKey(second)));
      }
    });
  }

  return orderedComponents;
}

function forcedCompletionUids<T extends RelationNode>(
  uid: string,
  groups: string[][],
  nodeByUid: ReadonlyMap<string, T>,
  forcedByUid: ReadonlyMap<string, ReadonlySet<string>>,
) {
  const forced = new Set([uid]);

  // Every prerequisite block must pass, but only one member inside a block
  // must pass. An ancestor is therefore forced only when every OR option in
  // at least one required block needs it. This keeps the inference safe.
  groups.forEach((group) => {
    const alternatives = [...new Set(group.filter((parentUid) => nodeByUid.has(parentUid)))];
    if (!alternatives.length) return;

    const alternativeRequirements = alternatives.map(
      (parentUid) => forcedByUid.get(parentUid) ?? new Set([parentUid]),
    );
    const requiredByEveryAlternative = new Set(alternativeRequirements[0]);
    alternativeRequirements.slice(1).forEach((requirements) => {
      requiredByEveryAlternative.forEach((requiredUid) => {
        if (!requirements.has(requiredUid)) requiredByEveryAlternative.delete(requiredUid);
      });
    });
    requiredByEveryAlternative.forEach((requiredUid) => forced.add(requiredUid));
  });

  return forced;
}

function solveComponentForcedUids<T extends RelationNode>(
  component: string[],
  groupsByUid: ReadonlyMap<string, string[][]>,
  nodeByUid: ReadonlyMap<string, T>,
  knownForcedByUid: ReadonlyMap<string, ReadonlySet<string>>,
) {
  let current = new Map(component.map((uid) => [uid, new Set([uid]) as ReadonlySet<string>]));

  // The equations are monotone and sets can only grow, so this reaches an
  // order-independent least fixed point even when an OR path exits a cycle.
  while (true) {
    const context = new Map<string, ReadonlySet<string>>(knownForcedByUid);
    current.forEach((forced, uid) => context.set(uid, forced));
    const next = new Map(component.map((uid) => [
      uid,
      forcedCompletionUids(uid, groupsByUid.get(uid) ?? [], nodeByUid, context) as ReadonlySet<string>,
    ]));
    const changed = component.some((uid) => {
      const previous = current.get(uid)!;
      const updated = next.get(uid)!;
      return previous.size !== updated.size || [...previous].some((requiredUid) => !updated.has(requiredUid));
    });
    current = next;
    if (!changed) return current;
  }
}

export function buildForcedCompletionMap<T extends RelationNode>(nodeByUid: ReadonlyMap<string, T>) {
  const forcedByUid = new Map<string, ReadonlySet<string>>();
  prerequisiteDependencyComponents(nodeByUid).forEach((component) => {
    const isSelfCycle = component.length === 1
      && nodeByUid.get(component[0])?.prerequisiteGroups.flat().includes(component[0]);
    if (component.length === 1 && !isSelfCycle) {
      const uid = component[0];
      const node = nodeByUid.get(uid)!;
      forcedByUid.set(uid, forcedCompletionUids(uid, node.prerequisiteGroups, nodeByUid, forcedByUid));
      return;
    }

    const groupsByUid = new Map(component.map((uid) => [uid, nodeByUid.get(uid)!.prerequisiteGroups]));
    solveComponentForcedUids(component, groupsByUid, nodeByUid, forcedByUid)
      .forEach((forced, uid) => forcedByUid.set(uid, forced));
  });
  return forcedByUid;
}

export function normalizeFocusRelations<T extends RelationNode>(nodes: T[]): T[] {
  // Always re-derive automatic OR merges from the user's original groups.
  // This lets descendant merges split again when an ancestor is edited.
  const completedMutuals = completeMutualGroups(restoreAutoMergedPrerequisiteGroups(nodes));
  const nodeByUid = new Map(completedMutuals.map((node) => [node.uid, node]));
  const forcedByUid = new Map<string, ReadonlySet<string>>();
  const normalizedByUid = new Map<string, T>();

  const normalizeNode = (node: T, relationContext: ReadonlyMap<string, ReadonlySet<string>>) => {
    const groups = node.prerequisiteGroups.map((group) => [...new Set(group)]);
    const originalGroups = cloneGroups(groups);
    let didMerge = false;
    let merged = true;

    // Separate prerequisite blocks are AND conditions in HOI4. If two entire
    // blocks are mutually exclusive, they can never both be satisfied and are
    // necessarily two alternatives of the same OR branch instead.
    while (merged) {
      merged = false;
      outer: for (let firstIndex = 0; firstIndex < groups.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < groups.length; secondIndex += 1) {
          if (!prerequisiteGroupsAreFullyMutual(groups[firstIndex], groups[secondIndex], nodeByUid, relationContext)) continue;
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
        ? originalGroups
        : undefined,
    };
  };

  prerequisiteDependencyComponents(nodeByUid).forEach((component) => {
    const isSelfCycle = component.length === 1
      && nodeByUid.get(component[0])?.prerequisiteGroups.flat().includes(component[0]);
    if (component.length === 1 && !isSelfCycle) {
      const uid = component[0];
      const normalized = normalizeNode(nodeByUid.get(uid)!, forcedByUid);
      normalizedByUid.set(uid, normalized);
      forcedByUid.set(uid, forcedCompletionUids(uid, normalized.prerequisiteGroups, nodeByUid, forcedByUid));
      return;
    }

    // Inside a dependency cycle, merge only relationships justified without
    // circular inference. The fixed-point result is then available to every
    // downstream component.
    const conservativeContext = new Map<string, ReadonlySet<string>>(forcedByUid);
    component.forEach((uid) => conservativeContext.set(uid, new Set([uid])));
    const normalizedComponent = component.map((uid) => normalizeNode(nodeByUid.get(uid)!, conservativeContext));
    normalizedComponent.forEach((node) => normalizedByUid.set(node.uid, node));
    const groupsByUid = new Map(normalizedComponent.map((node) => [node.uid, node.prerequisiteGroups]));
    solveComponentForcedUids(component, groupsByUid, nodeByUid, forcedByUid)
      .forEach((forced, uid) => forcedByUid.set(uid, forced));
  });

  return completedMutuals.map((node) => normalizedByUid.get(node.uid) ?? node);
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
