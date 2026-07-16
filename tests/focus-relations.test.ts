import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFocusRelationLines,
  completeMutualGroups,
  normalizeFocusRelations,
  prerequisiteBackupAfterManualEdit,
  restoreAutoMergedPrerequisiteGroups,
  type RelationNode,
} from "../app/focus-relations.ts";

type TestNode = RelationNode & { id: string };

function node(
  uid: string,
  mutuallyExclusiveUids: string[] = [],
  prerequisiteGroups: string[][] = [],
): TestNode {
  return { uid, id: uid.toUpperCase(), mutuallyExclusiveUids, prerequisiteGroups };
}

test("completes every mutual group as a symmetric clique", () => {
  const result = completeMutualGroups([
    node("a", ["b"]),
    node("b", ["c"]),
    node("c"),
  ]);

  assert.deepEqual(result.map((item) => item.mutuallyExclusiveUids), [
    ["b", "c"],
    ["a", "c"],
    ["a", "b"],
  ]);
});

test("merges mutually exclusive AND prerequisites into one OR group", () => {
  const result = normalizeFocusRelations([
    node("a", ["b"]),
    node("b", ["a"]),
    node("downstream", [], [["a"], ["b"]]),
  ]);

  assert.deepEqual(result.find((item) => item.uid === "downstream")?.prerequisiteGroups, [["a", "b"]]);
  assert.deepEqual(result.find((item) => item.uid === "downstream")?.prerequisiteGroupsBeforeMutualMerge, [["a"], ["b"]]);
});

test("restores the original AND groups before a mutual exclusion is removed", () => {
  const merged = normalizeFocusRelations([
    node("a", ["b"]),
    node("b", ["a"]),
    node("downstream", [], [["a"], ["b"]]),
  ]);
  const restored = restoreAutoMergedPrerequisiteGroups(merged).map((item) => ({
    ...item,
    mutuallyExclusiveUids: [],
  }));
  const result = normalizeFocusRelations(restored);

  assert.deepEqual(result.find((item) => item.uid === "downstream")?.prerequisiteGroups, [["a"], ["b"]]);
  assert.equal(result.find((item) => item.uid === "downstream")?.prerequisiteGroupsBeforeMutualMerge, undefined);
});

test("manual prerequisite edits discard the automatic merge backup", () => {
  const merged = normalizeFocusRelations([
    node("a", ["b"]),
    node("b", ["a"]),
    node("downstream", [], [["a"], ["b"]]),
  ]);
  const edited = merged.map((item) => item.uid === "downstream"
    ? {
      ...item,
      prerequisiteGroups: [["a", "b", "x"]],
      prerequisiteGroupsBeforeMutualMerge: prerequisiteBackupAfterManualEdit(item, [["a", "b", "x"]]),
    }
    : item);

  assert.deepEqual(restoreAutoMergedPrerequisiteGroups(edited)
    .find((item) => item.uid === "downstream")?.prerequisiteGroups, [["a", "b", "x"]]);
});

test("keeps the automatic merge backup when an unrelated prerequisite group is added", () => {
  const merged = normalizeFocusRelations([
    node("a", ["b"]),
    node("b", ["a"]),
    node("c"),
    node("downstream", [], [["a"], ["b"]]),
  ]);
  const withEmptyGroup = merged.map((item) => item.uid === "downstream"
    ? {
      ...item,
      prerequisiteGroups: [["a", "b"], []],
      prerequisiteGroupsBeforeMutualMerge: prerequisiteBackupAfterManualEdit(item, [["a", "b"], []]),
    }
    : item);
  const edited = withEmptyGroup.map((item) => item.uid === "downstream"
    ? {
      ...item,
      prerequisiteGroups: [["a", "b"], ["c"]],
      prerequisiteGroupsBeforeMutualMerge: prerequisiteBackupAfterManualEdit(item, [["a", "b"], ["c"]]),
    }
    : item);
  const restored = restoreAutoMergedPrerequisiteGroups(edited).map((item) => ({
    ...item,
    mutuallyExclusiveUids: [],
  }));

  assert.deepEqual(restored.find((item) => item.uid === "downstream")?.prerequisiteGroups, [["a"], ["b"], ["c"]]);
});

test("exports symmetric mutual blocks and one OR prerequisite block", () => {
  const result = normalizeFocusRelations([
    node("a", ["b"]),
    node("b", ["a"]),
    node("downstream", [], [["a"], ["b"]]),
  ]);
  const nodeByUid = new Map(result.map((item) => [item.uid, item]));

  assert.deepEqual(buildFocusRelationLines(nodeByUid.get("a")!, nodeByUid), [
    "\t\tmutually_exclusive = { focus = B }",
  ]);
  assert.deepEqual(buildFocusRelationLines(nodeByUid.get("b")!, nodeByUid), [
    "\t\tmutually_exclusive = { focus = A }",
  ]);
  assert.deepEqual(buildFocusRelationLines(nodeByUid.get("downstream")!, nodeByUid), [
    "\t\tprerequisite = { focus = A focus = B }",
  ]);
});

test("does not weaken partially compatible AND groups", () => {
  const result = normalizeFocusRelations([
    node("a", ["b"]),
    node("b", ["a"]),
    node("x"),
    node("y"),
    node("downstream", [], [["a", "x"], ["b", "y"]]),
  ]);

  assert.deepEqual(result.find((item) => item.uid === "downstream")?.prerequisiteGroups, [["a", "x"], ["b", "y"]]);
});

test("preserves an empty group while the user is choosing a new AND condition", () => {
  const result = normalizeFocusRelations([
    node("a"),
    node("downstream", [], [["a"], []]),
  ]);

  assert.deepEqual(result.find((item) => item.uid === "downstream")?.prerequisiteGroups, [["a"], []]);
});
