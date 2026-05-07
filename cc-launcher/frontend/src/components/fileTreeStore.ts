// Module-level cache + open-state for the Explorer file tree.
//
// Lives outside React so the tree retains its expanded folders and loaded
// directory contents even when the ExplorerView is unmounted (e.g. when the
// user switches to the Workspace tab and back).
//
// Each FileTreeNode hydrates its initial state from this store on mount and
// writes back when the user toggles or loads.

import { ListDir } from '../../wailsjs/go/main/FileBrowser';
import { main } from '../../wailsjs/go/models';

const cache = new Map<string, main.FileEntry[]>();
const inFlight = new Map<string, Promise<main.FileEntry[]>>();
// Map<path, isOpen>. Presence in the map distinguishes "explicitly toggled by
// the user" from "never visited" so callers can apply per-node defaults.
const openMap = new Map<string, boolean>();

export function getCached(path: string): main.FileEntry[] | null {
    return cache.has(path) ? cache.get(path)! : null;
}

export async function loadDir(path: string): Promise<main.FileEntry[]> {
    if (cache.has(path)) return cache.get(path)!;
    const existing = inFlight.get(path);
    if (existing) return existing;
    const promise = ListDir(path)
        .then((entries) => {
            const arr = entries ?? [];
            cache.set(path, arr);
            inFlight.delete(path);
            return arr;
        })
        .catch((err) => {
            inFlight.delete(path);
            throw err;
        });
    inFlight.set(path, promise);
    return promise;
}

export function invalidate(path: string) {
    cache.delete(path);
    inFlight.delete(path);
}

export function resetAll() {
    cache.clear();
    inFlight.clear();
    openMap.clear();
}

export function isOpen(path: string): boolean {
    return openMap.get(path) === true;
}

export function hasOpenState(path: string): boolean {
    return openMap.has(path);
}

export function setOpen(path: string, open: boolean) {
    openMap.set(path, open);
}
