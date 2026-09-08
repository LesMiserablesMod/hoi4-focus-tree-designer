import assert from "node:assert/strict";
import test from "node:test";
import { arrangeSelection, findFocuses, removeSelection, setSelectionDays } from "../app/editor-actions.ts";
import { normalizeFocusRelations } from "../app/focus-relations.ts";

const node = (uid: string, absX = 0, absY = 1) => ({
  uid, id: `TAG_${uid}`, name: uid === "a" ? "工业复兴" : uid,
  days: 70, absX, absY,
  prerequisiteGroups: [] as string[][],
  prerequisiteGroupsBeforeMutualMerge: undefined as string[][] | undefined,
  mutuallyExclusiveUids: [] as string[],
  relativeToUid: null as string | null,
  scriptExtras: "\n completion_reward = { add_stability = 0.1 } # keep exactly\n",
});

test("batch duration preserves imported effects and mutual branch semantics", () => {
  const a = { ...node("a"), mutuallyExclusiveUids: ["b"] };
  const b = { ...node("b", 2), mutuallyExclusiveUids: ["a"] };
  const c = { ...node("c", 1, 3), prerequisiteGroups: [["a", "b"]], prerequisiteGroupsBeforeMutualMerge: [["a"], ["b"]] };
  const original = [a, b, c];
  const updated = normalizeFocusRelations(setSelectionDays(original, ["a", "b"], 35));
  assert.deepEqual(updated.map((item) => item.days), [35, 35, 70]);
  assert.equal(updated[0].scriptExtras, a.scriptExtras);
  assert.deepEqual(updated[2].prerequisiteGroups, [["a", "b"]]);
  assert.deepEqual(updated[2].prerequisiteGroupsBeforeMutualMerge, [["a"], ["b"]]);
  assert.equal(original[0].days, 70, "the original snapshot remains usable for undo");
});

test("invalid batch days are a no-op", () => {
  const nodes = [node("a")];
  for (const days of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(setSelectionDays(nodes, ["a"], days), nodes);
  }
});

test("arrangement uses spatial order, two units, and the primary row or column", () => {
  const nodes = [node("c", 8, 7), node("a", -2, 1), node("b", 3, 4), node("other", 20, 10)];
  const row = arrangeSelection(nodes, ["c", "a", "b"], "b", "row");
  assert.deepEqual(row.slice(0, 3).map(({ absX, absY }) => [absX, absY]), [[2, 4], [-2, 4], [0, 4]]);
  const column = arrangeSelection(nodes, ["c", "a", "b"], "b", "column");
  assert.deepEqual(column.slice(0, 3).map(({ absX, absY }) => [absX, absY]), [[3, 5], [3, 1], [3, 3]]);
  assert.equal(row[3], nodes[3]);
  assert.equal(row[0].scriptExtras, nodes[0].scriptExtras);
  assert.equal(nodes[0].absX, 8);
});

test("deletion cleans managed references and backups without moving surviving nodes", () => {
  const c = { ...node("c", 3, 5), prerequisiteGroups: [["a", "b"], ["d"]], prerequisiteGroupsBeforeMutualMerge: [["a"], ["b"], ["d"]], mutuallyExclusiveUids: ["b"], relativeToUid: "a" };
  const nodes = [node("a"), node("b"), c, node("d")];
  const remaining = removeSelection(nodes, ["a", "b"]);
  assert.deepEqual(remaining.map((item) => item.uid), ["c", "d"]);
  assert.deepEqual(remaining[0].prerequisiteGroups, [["d"]]);
  assert.deepEqual(remaining[0].prerequisiteGroupsBeforeMutualMerge, [["d"]]);
  assert.deepEqual(remaining[0].mutuallyExclusiveUids, []);
  assert.equal(remaining[0].relativeToUid, null);
  assert.deepEqual([remaining[0].absX, remaining[0].absY], [3, 5]);
  assert.equal(remaining[0].scriptExtras, c.scriptExtras);
  assert.equal(c.relativeToUid, "a", "original snapshot is not mutated");
  assert.equal(removeSelection(nodes, nodes.map((item) => item.uid)), nodes, "keep one node");
});

test("search matches case-insensitive IDs and multilingual names without changing the graph", () => {
  const nodes = [node("a"), node("b")];
  assert.deepEqual(findFocuses(nodes, "tag_A 工业"), [nodes[0]]);
  assert.deepEqual(findFocuses(nodes, "   "), []);
  assert.deepEqual(findFocuses(nodes, "missing"), []);
  assert.equal(nodes.length, 2);
});
