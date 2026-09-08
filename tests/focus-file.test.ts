import assert from 'node:assert/strict';
import test from 'node:test';
import { readFocusTree, uniqueFocusId, decodeLocalisation } from '../app/focus-file.ts';
import { renderFocusScriptBlock, renderImportedTree, renameFocusReferences, topLevelBlockBodies, topLevelScalar } from '../app/hoi4-script.ts';
import { normalizeFocusRelations } from '../app/focus-relations.ts';

const source = `# source header
@pos = -2
@duration = 0.5
focus_tree = {
 id = QA_tree
 country = { factor = 100 modifier = { add = 25 original_tag = FRA } }
 default = yes
 continuous_focus_position = { x = 500 y = 700 }
 shared_focus = SHARED_root
 focus = { id = QA_A x = @pos y = 1 cost = @duration completion_reward = { add_stability = 0.1 } }
 # between nodes
 focus = { id = QA_B x = 2 y = 3 cost = 0 prerequisite = { focus = QA_A # focus = QA_B
 } available = { has_completed_focus = QA_A } }
}
focus_tree = { id = KEEP default = no focus = { id = KEEP_A x = 0 y = 1 } }
# footer
`;

test('reading resolves variables, retains fractional/zero durations, and ignores commented relations', () => {
  const project = readFocusTree(source);
  assert.equal(project.countryTag, 'FRA');
  assert.equal(project.treeCount, 2);
  assert.equal(project.nodes[0].x, -2);
  assert.equal(project.nodes[0].days, 3.5);
  assert.equal(project.nodes[1].days, 0);
  assert.deepEqual(project.nodes[1].prerequisiteIdGroups, [['QA_A']]);
  assert.equal(project.nodes[0].sourceValues.cost, '@duration');
});

test('edited tree retains country rules, other trees, variables, comments and effects', () => {
  const project = readFocusTree(source);
  const scripts = project.nodes.map((node) => ({sourceId: node.id, script: renderFocusScriptBlock({
    id: node.id === 'QA_A' ? 'QA_renamed' : node.id,
    x: node.id === 'QA_A' ? -4 : node.x, y: node.y,
    cost: node.sourceValues.cost,
    relationLines: node.id === 'QA_B' ? ['\t\tprerequisite = { focus = QA_renamed }'] : [],
    scriptExtras: renameFocusReferences(node.scriptExtras, 'QA_A', 'QA_renamed'),
  })}));
  const output = renderImportedTree(source, 'QA_new_tree', scripts);
  assert.match(output, /original_tag = FRA/);
  assert.match(output, /default = yes/);
  assert.match(output, /continuous_focus_position = \{ x = 500 y = 700 \}/);
  assert.match(output, /shared_focus = SHARED_root/);
  assert.match(output, /@pos = -2/);
  assert.match(output, /cost = @duration/);
  assert.match(output, /cost = 0/);
  assert.match(output, /# between nodes/);
  assert.match(output, /has_completed_focus = QA_renamed/);
  assert.match(output, /add_stability = 0.1/);
  assert.equal(topLevelBlockBodies(output, 'focus_tree')[1], topLevelBlockBodies(source, 'focus_tree')[1]);
  assert.equal(topLevelScalar(topLevelBlockBodies(output, 'focus_tree')[0], 'id'), 'QA_new_tree');
});

test('deleting and adding nodes does not duplicate original slots or erase unrelated fields', () => {
  const output = renderImportedTree(source, 'QA_tree', [{sourceId: 'QA_A', script: 'focus = { id = QA_A x = 4 y = 1 }'}, {script:'focus = { id = QA_new x = 6 y = 1 }'}]);
  const focuses = topLevelBlockBodies(topLevelBlockBodies(output, 'focus_tree')[0], 'focus');
  assert.deepEqual(focuses.map((body) => topLevelScalar(body, 'id')), ['QA_A','QA_new']);
  assert.match(output, /continuous_focus_position/);
  assert.match(output, /id = KEEP_A/);
});

test('unsafe imports fail before a project can replace the current canvas', () => {
  for (const [input, error] of [
    ['focus_tree = { focus = { id = A prerequisite = { focus = MISSING } } }', /MISSING/],
    ['focus_tree = { focus = { id = A } focus = { id = A } }', /Duplicate/],
    ['focus_tree = { focus = { id = A x = @missing } }', /无法解析/],
    ['focus_tree = { focus = { id = A x = 0.5 } }', /integers/],
    ['focus_tree = { focus = { id = A }', /Unclosed/],
  ] as const) assert.throws(() => readFocusTree(input), error);
});

test('renaming updates exact known references, not comments or arbitrary text', () => {
  const output = renameFocusReferences('available = { has_completed_focus = A }\n# has_completed_focus = A\ncustom_tooltip = "A"\nif = { complete_national_focus = "A" }', 'A', 'NEW_A');
  assert.match(output, /has_completed_focus = NEW_A/);
  assert.match(output, /# has_completed_focus = A/);
  assert.match(output, /custom_tooltip = "A"/);
  assert.match(output, /complete_national_focus = "NEW_A"/);
});

test('explicit relation editing can retain non-transitive imported pairs', () => {
  const nodes = ['a','b','c'].map((uid) => ({uid, prerequisiteGroups: [] as string[][], mutuallyExclusiveUids: uid === 'b' ? ['a','c'] : ['b']}));
  const normalized = normalizeFocusRelations(nodes, {preservePairs:true});
  assert.deepEqual(normalized[0].mutuallyExclusiveUids, ['b']);
  assert.deepEqual(normalized[2].mutuallyExclusiveUids, ['b']);
});

test('new IDs do not collide and literal escaped newlines stay literal', () => {
  assert.equal(uniqueFocusId([{id:'A_copy'},{id:'A_copy_2'}], 'A_copy'), 'A_copy_3');
  assert.equal(decodeLocalisation(String.raw`literal \\n / real \n / quote \"`), 'literal \\n / real \n / quote "');
});

test('comments may separate equals from a block without corrupting parsing', () => {
  const project = readFocusTree('focus_tree = # tree\n { id = A_tree focus = { id = A x = 0 y = 1 available = # condition\n { has_completed_focus = A } } }');
  assert.match(project.nodes[0].scriptExtras, /has_completed_focus = A/);
});
