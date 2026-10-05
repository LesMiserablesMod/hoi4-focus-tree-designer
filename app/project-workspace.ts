/** All TAG projects are saved together; editor history is kept separately per session. */
export type ProjectWorkspace<T> = {
  format: "hoi4-focus-workspace";
  version: 1;
  activeProjectId: string;
  projects: { id: string; project: T }[];
};

export const WORKSPACE_STORAGE_KEY = "hoi4-focus-tree-workspace-v1";

export function singleProjectWorkspace<T>(project: T, id = "initial-project"): ProjectWorkspace<T> {
  return { format: "hoi4-focus-workspace", version: 1, activeProjectId: id, projects: [{ id, project }] };
}

export function snapshotWorkspace<T>(workspace: ProjectWorkspace<T>, project: T): ProjectWorkspace<T> {
  return { ...workspace, projects: workspace.projects.map((entry) => entry.id === workspace.activeProjectId ? { ...entry, project } : entry) };
}

export function normalizeWorkspace<T>(value: unknown, normalize: (project: unknown) => T | null): ProjectWorkspace<T> | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ProjectWorkspace<unknown>>;
  if (raw.format !== "hoi4-focus-workspace" || raw.version !== 1 || !Array.isArray(raw.projects) || !raw.projects.length) return null;
  const projects: ProjectWorkspace<T>["projects"] = [];
  for (const entry of raw.projects) {
    if (!entry || typeof entry.id !== "string" || !entry.id || projects.some((item) => item.id === entry.id)) return null;
    const project = normalize(entry.project);
    if (!project) return null;
    projects.push({ id: entry.id, project });
  }
  if (!projects.some((entry) => entry.id === raw.activeProjectId)) return null;
  return { format: "hoi4-focus-workspace", version: 1, activeProjectId: raw.activeProjectId!, projects };
}

export function validateNewTag(tag: string, treeId: string, projects: { countryTag: string; treeId: string }[]): "tag" | "treeId" | "duplicateTag" | "duplicateTreeId" | null {
  if (!/^[A-Z][A-Z0-9]{2}$/.test(tag)) return "tag";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(treeId)) return "treeId";
  if (projects.some((project) => project.countryTag.toUpperCase() === tag)) return "duplicateTag";
  if (projects.some((project) => project.treeId === treeId)) return "duplicateTreeId";
  return null;
}
