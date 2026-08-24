import assert from "node:assert/strict";
import test from "node:test";

import {
  findAvailableNodePosition,
  GRID_X,
  NODE_W,
} from "../app/canvas-layout.ts";

test("adjacent HOI4 x coordinates overlap only slightly on the canvas", () => {
  const overlap = NODE_W - GRID_X;
  assert.equal(overlap, 10);
});

test("new positions stay at positive y and prefer a vertical child slot", () => {
  assert.deepEqual(findAvailableNodePosition([], { baseX: 0, baseY: -5 }), { x: 0, y: 1 });
  assert.deepEqual(
    findAvailableNodePosition([{ absX: 0, absY: 1 }], { baseX: 0, baseY: 3 }),
    { x: 0, y: 3 },
  );
});

test("new positions never sit one x unit from another node on the same row", () => {
  const nodes = [{ absX: 1, absY: 3 }];
  const position = findAvailableNodePosition(nodes, { baseX: 0, baseY: 3 });
  assert.deepEqual(position, { x: -2, y: 3 });
  assert.ok(nodes.every((node) => node.absY !== position.y || Math.abs(node.absX - position.x) >= 2));
});

test("a crowded row moves placement to the next positive row", () => {
  const nodes = [-8, -6, -4, -2, 0, 2, 4, 6, 8].map((absX) => ({ absX, absY: 3 }));
  assert.deepEqual(findAvailableNodePosition(nodes, { baseX: 0, baseY: 3 }), { x: 0, y: 5 });
});
