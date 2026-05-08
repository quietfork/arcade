// Recursive split-tree data model + manipulation helpers (tmux-style).
//
// Node shapes:
//   { type: 'leaf', paneId }
//   { type: 'split', dir: 'h' | 'v', ratio: 0..1, a: Node, b: Node }
//
// Path: array of 'a' | 'b' steps from root.

export type LeafNode = { type: 'leaf'; paneId: string };
export type SplitDir = 'h' | 'v';
export type SplitNode = { type: 'split'; dir: SplitDir; ratio: number; a: Node; b: Node };
export type Node = LeafNode | SplitNode;
export type Path = ('a' | 'b')[];
export type DropZone = 'l' | 'r' | 't' | 'b';

export function leafIds(node: Node | null, out: string[] = []): string[] {
    if (!node) return out;
    if (node.type === 'leaf') {
        out.push(node.paneId);
        return out;
    }
    leafIds(node.a, out);
    leafIds(node.b, out);
    return out;
}

export type Flat = { paneId: string; path: Path };
export function flatten(node: Node | null, path: Path = [], out: Flat[] = []): Flat[] {
    if (!node) return out;
    if (node.type === 'leaf') {
        out.push({ paneId: node.paneId, path });
        return out;
    }
    flatten(node.a, [...path, 'a'], out);
    flatten(node.b, [...path, 'b'], out);
    return out;
}

export function getNodeAtPath(node: Node | null, path: Path): Node | null {
    if (!node) return null;
    if (path.length === 0) return node;
    if (node.type !== 'split') return null;
    return getNodeAtPath(node[path[0]], path.slice(1));
}

export function setNodeAtPath(node: Node, path: Path, replacement: Node): Node {
    if (path.length === 0) return replacement;
    if (node.type !== 'split') return node;
    const [step, ...rest] = path;
    return { ...node, [step]: setNodeAtPath(node[step], rest, replacement) };
}

// Remove the leaf at `path`. The parent split collapses (the sibling survives).
// Returns null if the resulting tree would be empty.
export function removeAtPath(node: Node | null, path: Path): Node | null {
    if (!node) return null;
    if (path.length === 0) return null;
    if (path.length === 1) {
        // node is the parent split; the sibling survives.
        if (node.type !== 'split') return node;
        return path[0] === 'a' ? node.b : node.a;
    }
    if (node.type !== 'split') return node;
    const [step, ...rest] = path;
    const newChild = removeAtPath(node[step], rest);
    if (newChild === null) return node;
    return { ...node, [step]: newChild };
}

// Insert `leafToInsert` adjacent to the leaf at `targetPath`, on the given side.
export function insertAdjacent(
    node: Node | null,
    targetPath: Path,
    side: DropZone,
    leafToInsert: LeafNode,
): Node | null {
    if (!node) return leafToInsert;
    const target = getNodeAtPath(node, targetPath);
    if (!target) return node;
    const dir: SplitDir = side === 'l' || side === 'r' ? 'h' : 'v';
    const insertFirst = side === 'l' || side === 't';
    const newSplit: SplitNode = {
        type: 'split',
        dir,
        ratio: 0.5,
        a: insertFirst ? leafToInsert : target,
        b: insertFirst ? target : leafToInsert,
    };
    if (targetPath.length === 0) return newSplit;
    return setNodeAtPath(node, targetPath, newSplit);
}

export function updateRatioAtPath(node: Node | null, path: Path, ratio: number): Node | null {
    if (!node) return null;
    if (node.type !== 'split') return node;
    if (path.length === 0) return { ...node, ratio };
    const [step, ...rest] = path;
    return { ...node, [step]: updateRatioAtPath(node[step], rest, ratio) ?? node[step] };
}

// Drop one leaf next to another by paneId (re-finds the target after the source
// has been removed, since paths can shift when the source's parent collapses).
export function moveLeaf(
    node: Node | null,
    sourcePaneId: string,
    targetPaneId: string,
    side: DropZone,
): Node | null {
    if (!node) return null;
    if (sourcePaneId === targetPaneId) return node;

    const all = flatten(node);
    const source = all.find((f) => f.paneId === sourcePaneId);
    if (!source) return node;

    let next = removeAtPath(node, source.path);
    if (!next) return node;

    const remaining = flatten(next);
    const target = remaining.find((f) => f.paneId === targetPaneId);
    if (!target) return node;

    return insertAdjacent(next, target.path, side, { type: 'leaf', paneId: sourcePaneId });
}

// Find the path to a given leaf by paneId.
export function findPath(node: Node | null, paneId: string, path: Path = []): Path | null {
    if (!node) return null;
    if (node.type === 'leaf') return node.paneId === paneId ? path : null;
    return findPath(node.a, paneId, [...path, 'a']) ?? findPath(node.b, paneId, [...path, 'b']);
}

// Remove a leaf by paneId (safe wrapper around removeAtPath).
export function removeLeaf(node: Node | null, paneId: string): Node | null {
    const p = findPath(node, paneId);
    if (!p) return node;
    return removeAtPath(node, p);
}

// Append a new leaf to the right of the entire tree (default add).
export function appendLeaf(node: Node | null, paneId: string): Node {
    const leaf: LeafNode = { type: 'leaf', paneId };
    if (!node) return leaf;
    return { type: 'split', dir: 'h', ratio: 0.5, a: node, b: leaf };
}

// ── Layout computation ──
// All coordinates are fractions of the workspace area (0..1).

export interface Box { x: number; y: number; w: number; h: number; }
export type BoxMap = Map<string, Box>;

export function computeBoxes(
    node: Node | null,
    x = 0, y = 0, w = 1, h = 1,
    out: BoxMap = new Map(),
): BoxMap {
    if (!node) return out;
    if (node.type === 'leaf') {
        out.set(node.paneId, { x, y, w, h });
        return out;
    }
    if (node.dir === 'h') {
        const aw = w * node.ratio;
        computeBoxes(node.a, x, y, aw, h, out);
        computeBoxes(node.b, x + aw, y, w - aw, h, out);
    } else {
        const ah = h * node.ratio;
        computeBoxes(node.a, x, y, w, ah, out);
        computeBoxes(node.b, x, y + ah, w, h - ah, out);
    }
    return out;
}

export interface DividerSpec {
    path: Path;
    dir: SplitDir;
    ratio: number;
    parentBox: Box;
}

export function computeDividers(
    node: Node | null,
    x = 0, y = 0, w = 1, h = 1,
    path: Path = [],
    out: DividerSpec[] = [],
): DividerSpec[] {
    if (!node || node.type !== 'split') return out;
    out.push({ path, dir: node.dir, ratio: node.ratio, parentBox: { x, y, w, h } });
    if (node.dir === 'h') {
        const aw = w * node.ratio;
        computeDividers(node.a, x, y, aw, h, [...path, 'a'], out);
        computeDividers(node.b, x + aw, y, w - aw, h, [...path, 'b'], out);
    } else {
        const ah = h * node.ratio;
        computeDividers(node.a, x, y, w, ah, [...path, 'a'], out);
        computeDividers(node.b, x, y + ah, w, h - ah, [...path, 'b'], out);
    }
    return out;
}

// ── Persistence helpers ──

// Serialize tree to a plain JSON object (already plain since it has no cycles).
export function serialize(node: Node | null): any {
    return node;
}

// Validate a deserialized object is a well-formed tree, else return null.
export function deserialize(obj: any): Node | null {
    if (!obj || typeof obj !== 'object') return null;
    if (obj.type === 'leaf' && typeof obj.paneId === 'string') {
        return { type: 'leaf', paneId: obj.paneId };
    }
    if (obj.type === 'split' && (obj.dir === 'h' || obj.dir === 'v')) {
        const a = deserialize(obj.a);
        const b = deserialize(obj.b);
        if (!a || !b) return null;
        const ratio = typeof obj.ratio === 'number' ? Math.min(0.95, Math.max(0.05, obj.ratio)) : 0.5;
        return { type: 'split', dir: obj.dir, ratio, a, b };
    }
    return null;
}
