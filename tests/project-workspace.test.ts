import assert from "node:assert/strict";
import test from "node:test";
import { normalizeWorkspace, singleProjectWorkspace, snapshotWorkspace, validateNewTag } from "../app/project-workspace.ts";

type Project = { countryTag: string; treeId: string; nodes: string[]; sourceText?: string };
const original: Project = { countryTag: "FRA", treeId: "FRA_focus", nodes: ["FRA_A"], sourceText: "completion_reward = { add_stability = 0.1 }" };
const normalize = (value: unknown): Project | null => value && typeof value === "object" && Array.isArray((value as Project).nodes) ? value as Project : null;

test("legacy project migrates without losing imported source, then survives a second TAG and a reload", () => {
  const migrated = singleProjectWorkspace(original);
  const expanded = { ...migrated, activeProjectId: "ger", projects: [...migrated.projects, { id: "ger", project: { countryTag: "GER", treeId: "GER_focus", nodes: [] } }] };
  const saved = snapshotWorkspace(expanded, { countryTag: "GER", treeId: "GER_focus", nodes: ["GER_A"] });
  const restored = normalizeWorkspace(JSON.parse(JSON.stringify(saved)), normalize)!;
  assert.equal(restored.activeProjectId, "ger");
  assert.deepEqual(restored.projects[0].project, original);
  assert.deepEqual(restored.projects[1].project.nodes, ["GER_A"]);
  assert.deepEqual(migrated.projects, [{ id: "initial-project", project: original }]);
});

test("empty TAG project can be saved and restored", () => {
  const empty = { countryTag: "YUN", treeId: "YUN_focus", nodes: [] };
  assert.deepEqual(normalizeWorkspace(JSON.parse(JSON.stringify(singleProjectWorkspace(empty))), normalize)?.projects[0].project, empty);
});

test("invalid workspace entries cannot silently disappear on restore", () => {
  const valid = singleProjectWorkspace(original);
  assert.equal(normalizeWorkspace({ ...valid, activeProjectId: "missing" }, normalize), null);
  assert.equal(normalizeWorkspace({ ...valid, projects: [...valid.projects, ...valid.projects] }, normalize), null);
  assert.equal(normalizeWorkspace({ ...valid, projects: [...valid.projects, { id: "bad", project: {} }] }, normalize), null);
  assert.equal(normalizeWorkspace({ ...valid, version: 2 }, normalize), null);
});

test("new TAG validation prevents colliding projects and unsafe output names", () => {
  assert.equal(validateNewTag("GER", "GER_focus", [original]), null);
  assert.equal(validateNewTag("D01", "D01_focus", [original]), null);
  assert.equal(validateNewTag("fra", "FRA_new", [original]), "tag");
  assert.equal(validateNewTag("FR", "FRA_new", [original]), "tag");
  assert.equal(validateNewTag("GER", "../FRA", [original]), "treeId");
  assert.equal(validateNewTag("FRA", "FRA_new", [original]), "duplicateTag");
  assert.equal(validateNewTag("GER", "FRA_focus", [original]), "duplicateTreeId");
});
