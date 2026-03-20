// src/physics/Pathfinding.ts
// A* pathfinding on 2D grid for ARAM lane

import { Structure } from '../entity/Structure';
import { LANE_X_MIN, LANE_X_MAX, LANE_Z_MIN, LANE_Z_MAX } from '../config/GameBalance';

export { LANE_X_MIN, LANE_X_MAX, LANE_Z_MIN, LANE_Z_MAX };

/** グリッドセルサイズ（1ブロック=1セル） */
// Grid resolution: 1 block = 1 cell

interface Node {
  x: number;
  z: number;
  g: number; // start→ここまでのコスト
  h: number; // ヒューリスティック（ゴールまでの推定コスト）
  f: number; // g + h
  parent: Node | null;
}

/**
 * 構造物の占有マップを生成する。
 * trueのセルは通行不可。
 */
export function buildObstacleMap(structures: Structure[]): Set<string> {
  const blocked = new Set<string>();
  for (const s of structures) {
    if (!s.isAlive) continue;
    // 構造物のAABBをグリッドセルに変換（1ブロックの余裕を持たせる）
    const minX = Math.floor(s.x) - 1;
    const maxX = Math.floor(s.x + s.width) + 1;
    const minZ = Math.floor(s.z) - 1;
    const maxZ = Math.floor(s.z + s.depth) + 1;
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        blocked.add(`${x},${z}`);
      }
    }
  }
  return blocked;
}

/**
 * A*パスファインディング。
 * 2Dグリッド上でstartからgoalへの最短経路を計算する。
 * @returns ウェイポイント配列（start除外、goal含む）。到達不可能な場合は空配列。
 */
export function findPath(
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number,
  blocked: Set<string>,
): { x: number; z: number }[] {
  const sx = Math.round(startX);
  const sz = Math.round(startZ);
  const gx = Math.round(goalX);
  const gz = Math.round(goalZ);

  // ゴールがブロックされている場合、最も近い非ブロックセルをゴールにする
  let finalGX = gx;
  let finalGZ = gz;
  if (blocked.has(`${gx},${gz}`)) {
    let bestDist = Infinity;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        const tx = gx + dx;
        const tz = gz + dz;
        if (!blocked.has(`${tx},${tz}`) && tx >= LANE_X_MIN && tx <= LANE_X_MAX) {
          const d = Math.abs(dx) + Math.abs(dz);
          if (d < bestDist) {
            bestDist = d;
            finalGX = tx;
            finalGZ = tz;
          }
        }
      }
    }
  }

  if (sx === finalGX && sz === finalGZ) return [];

  const open = new Map<string, Node>();
  const closed = new Set<string>();

  const startNode: Node = {
    x: sx,
    z: sz,
    g: 0,
    h: heuristic(sx, sz, finalGX, finalGZ),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  open.set(`${sx},${sz}`, startNode);

  // 8方向移動（直線+斜め）
  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  const costs = [1, 1, 1, 1, 1.414, 1.414, 1.414, 1.414];

  let iterations = 0;
  const MAX_ITERATIONS = 5000; // パフォーマンス制限（ARAMレーン210ブロック対応）

  while (open.size > 0 && iterations < MAX_ITERATIONS) {
    iterations++;

    // f値が最小のノードを取得
    let current: Node | null = null;
    let bestF = Infinity;
    for (const node of open.values()) {
      if (node.f < bestF) {
        bestF = node.f;
        current = node;
      }
    }
    if (!current) break;

    const key = `${current.x},${current.z}`;
    open.delete(key);
    closed.add(key);

    // ゴール到達
    if (current.x === finalGX && current.z === finalGZ) {
      return reconstructPath(current);
    }

    // 隣接ノード展開
    for (let i = 0; i < dirs.length; i++) {
      const nx = current.x + dirs[i][0];
      const nz = current.z + dirs[i][1];
      const nKey = `${nx},${nz}`;

      // 範囲外チェック
      if (nx < LANE_X_MIN || nx > LANE_X_MAX || nz < LANE_Z_MIN || nz > LANE_Z_MAX) continue;
      if (closed.has(nKey)) continue;
      if (blocked.has(nKey)) continue;

      // 斜め移動時、両隣がブロックされていないか確認（角切り防止）
      if (i >= 4) {
        const dx = dirs[i][0];
        const dz = dirs[i][1];
        if (
          blocked.has(`${current.x + dx},${current.z}`) ||
          blocked.has(`${current.x},${current.z + dz}`)
        )
          continue;
      }

      const g = current.g + costs[i];
      const existing = open.get(nKey);
      if (existing && g >= existing.g) continue;

      const h = heuristic(nx, nz, finalGX, finalGZ);
      const node: Node = { x: nx, z: nz, g, h, f: g + h, parent: current };
      open.set(nKey, node);
    }
  }

  // パスが見つからない場合 → 空配列を返す（ミニオンはリトライ待機）
  return [];
}

function heuristic(x1: number, z1: number, x2: number, z2: number): number {
  // チェビシェフ距離（8方向移動に適合）
  return Math.max(Math.abs(x1 - x2), Math.abs(z1 - z2));
}

function reconstructPath(node: Node): { x: number; z: number }[] {
  const path: { x: number; z: number }[] = [];
  let current: Node | null = node;
  while (current && current.parent) {
    path.unshift({ x: current.x + 0.5, z: current.z + 0.5 }); // セル中心
    current = current.parent;
  }
  // パスを間引く（直線部分を省略）
  return simplifyPath(path);
}

/** 直線上の中間ウェイポイントを省略 */
function simplifyPath(path: { x: number; z: number }[]): { x: number; z: number }[] {
  if (path.length <= 2) return path;
  const result = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const prev = result[result.length - 1];
    const next = path[i + 1];
    const dx1 = path[i].x - prev.x;
    const dz1 = path[i].z - prev.z;
    const dx2 = next.x - path[i].x;
    const dz2 = next.z - path[i].z;
    // 方向が変わるポイントのみ保持
    if (Math.abs(dx1 - dx2) > 0.01 || Math.abs(dz1 - dz2) > 0.01) {
      result.push(path[i]);
    }
  }
  result.push(path[path.length - 1]);
  return result;
}
