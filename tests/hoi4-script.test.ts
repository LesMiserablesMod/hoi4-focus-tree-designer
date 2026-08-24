import assert from "node:assert/strict";
import test from "node:test";

import {
  indentPreservedFocusScript,
  preserveUnmanagedFocusScript,
  renderFocusScriptBlock,
  topLevelBlockBodies,
  topLevelScalar,
} from "../app/hoi4-script.ts";

test("preserves effects, conditions, icons, and comments while removing managed focus fields", () => {
  const source = `
\t\tid = TAG_complex
\t\ticon = GFX_goal_custom
\t\tx = 1
\t\ty = 3
\t\trelative_position_id = TAG_parent
\t\tcost = 10
\t\tprerequisite = { focus = TAG_parent }
\t\tmutually_exclusive = { focus = TAG_other }

\t\t# x = 900 and id = COMMENT_ONLY must survive
\t\tavailable = {
\t\t\tcustom_trigger_tooltip = {
\t\t\t\ttooltip = "Brace { and # inside a quoted string"
\t\t\t\tx = 44
\t\t\t}
\t\t}

\t\tcompletion_reward = {
\t\t\tif = {
\t\t\t\tlimit = { has_war = no }
\t\t\t\tadd_political_power = 75
\t\t\t}
\t\t}
\t\tai_will_do = { factor = 3 }
\t`;

  const formatted = indentPreservedFocusScript(preserveUnmanagedFocusScript(source));
  assert.equal(formatted, `\t\ticon = GFX_goal_custom

\t\t# x = 900 and id = COMMENT_ONLY must survive
\t\tavailable = {
\t\t\tcustom_trigger_tooltip = {
\t\t\t\ttooltip = "Brace { and # inside a quoted string"
\t\t\t\tx = 44
\t\t\t}
\t\t}

\t\tcompletion_reward = {
\t\t\tif = {
\t\t\t\tlimit = { has_war = no }
\t\t\t\tadd_political_power = 75
\t\t\t}
\t\t}
\t\tai_will_do = { factor = 3 }`);
  ["id", "x", "y", "cost", "relative_position_id"].forEach((key) => {
    assert.equal(topLevelScalar(formatted, key), "");
  });
  assert.deepEqual(topLevelBlockBodies(formatted, "prerequisite"), []);
  assert.deepEqual(topLevelBlockBodies(formatted, "mutually_exclusive"), []);
});

test("top-level parsing ignores fake focuses and relationships in comments or nested effects", () => {
  const tree = `
\t# focus = { id = COMMENT_ONLY }
\tid = TAG_tree
\tfocus = {
\t\tid = TAG_real
\t\tx = 2
\t\ty = 4
\t\tavailable = {
\t\t\t# prerequisite = { focus = TAG_fake }
\t\t\tcustom_trigger = { mutually_exclusive = { focus = TAG_fake } }
\t\t}
\t}
`;

  const focuses = topLevelBlockBodies(tree, "focus");
  assert.equal(focuses.length, 1);
  assert.equal(topLevelScalar(focuses[0], "id"), "TAG_real");
  assert.equal(topLevelScalar(focuses[0], "x"), "2");
  assert.deepEqual(topLevelBlockBodies(focuses[0], "prerequisite"), []);
  assert.deepEqual(topLevelBlockBodies(focuses[0], "mutually_exclusive"), []);
});

test("top-level scalar does not confuse nested managed-looking values with coordinates", () => {
  const focus = `
\tavailable = { x = 99 y = 88 }
\tx = -3
\ty = 5
`;
  assert.equal(topLevelScalar(focus, "x"), "-3");
  assert.equal(topLevelScalar(focus, "y"), "5");
});

test("re-renders managed fields without losing imported completion effects", () => {
  const imported = `
\t\tid = TAG_old
\t\tx = 1
\t\ty = 2
\t\tcost = 10
\t\tcompletion_reward = {
\t\t\tadd_stability = 0.15
\t\t\tadd_political_power = 125
\t\t}
`;
  const script = renderFocusScriptBlock({
    id: "TAG_renamed",
    x: -4,
    y: 6,
    relativePositionId: "TAG_parent",
    cost: "5",
    relationLines: ["\t\tprerequisite = { focus = TAG_parent }"],
    scriptExtras: preserveUnmanagedFocusScript(imported),
  });

  assert.match(script, /id = TAG_renamed/);
  assert.match(script, /x = -4/);
  assert.match(script, /relative_position_id = TAG_parent/);
  assert.match(script, /add_stability = 0\.15/);
  assert.match(script, /add_political_power = 125/);
  assert.doesNotMatch(script, /TAG_old/);
});

test("does not invent extras for an imported empty focus but supplies defaults for new nodes", () => {
  const base = { id: "TAG_test", x: 0, y: 1, cost: "10", relationLines: [] };
  const imported = renderFocusScriptBlock({ ...base, scriptExtras: "" });
  assert.doesNotMatch(imported, /\bicon\s*=/);
  assert.doesNotMatch(imported, /completion_reward/);

  const created = renderFocusScriptBlock(base);
  assert.match(created, /\bicon\s*= GFX_goal_generic_construct_civ_factory/);
  assert.match(created, /completion_reward/);
});
