export const GRID_X = 208;
export const GRID_Y = 154;
export const NODE_W = 218;
export const NODE_H = 126;

export type PositionedNode = {
  absX: number;
  absY: number;
};

type PlacementOptions = {
  baseX: number;
  baseY: number;
};

const HORIZONTAL_OFFSETS = [0, 2, -2, 4, -4, 6, -6, 8, -8];

/**
 * Finds a nearby grid position while keeping nodes on the same row at least
 * two HOI4 x units apart. New rows remain in the positive y range.
 */
export function findAvailableNodePosition(nodes: PositionedNode[], options: PlacementOptions) {
  const firstY = Math.max(1, Math.round(options.baseY));
  const baseX = Math.round(options.baseX);
  const rowsToTry = Math.max(20, nodes.length + 1);

  for (let row = 0; row < rowsToTry; row += 1) {
    const y = firstY + row * 2;
    for (const offset of HORIZONTAL_OFFSETS) {
      const x = baseX + offset;
      const hasSafeHorizontalSpacing = nodes.every(
        (node) => node.absY !== y || Math.abs(node.absX - x) >= 2,
      );
      if (hasSafeHorizontalSpacing) return { x, y };
    }
  }

  return { x: baseX, y: firstY + rowsToTry * 2 };
}
