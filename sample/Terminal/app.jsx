// Multiplex — main app (free-form tmux-style splits with drag-to-resize)
const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ----------------- workspace tree -----------------
   Node:
     { type: 'leaf', sessId }
     { type: 'split', dir: 'h'|'v', ratio: 0..1, a: node, b: node }
*/

const initialTree = {
  type: 'split', dir: 'h', ratio: 0.5,
  a: {
    type: 'split', dir: 'v', ratio: 0.55,
    a: { type: 'leaf', sessId: 's1', wsId: 'ws1' },
    b: { type: 'leaf', sessId: 's3', wsId: 'ws1' },
  },
  b: {
    type: 'split', dir: 'v', ratio: 0.5,
    a: { type: 'leaf', sessId: 's4', wsId: 'ws1' },
    b: { type: 'leaf', sessId: 's6', wsId: 'ws2' },
  },
};

function leafIds(node, out=[]) {
  if (!node) return out;
  if (node.type === 'leaf') { out.push(node.sessId); return out; }
  leafIds(node.a, out); leafIds(node.b, out); return out;
}

function replaceLeaf(node, sessId, newNode) {
  if (!node) return node;
  if (node.type === 'leaf') return node.sessId === sessId ? newNode : node;
  return { ...node, a: replaceLeaf(node.a, sessId, newNode), b: replaceLeaf(node.b, sessId, newNode) };
}

function removeLeaf(node, sessId) {
  if (!node) return null;
  if (node.type === 'leaf') return node.sessId === sessId ? null : node;
  const a = removeLeaf(node.a, sessId);
  const b = removeLeaf(node.b, sessId);
  if (!a) return b;
  if (!b) return a;
  return { ...node, a, b };
}

// path-based helpers (path is array of 'a'|'b' steps from root)
function getNodeAtPath(node, path) {
  if (!node) return null;
  if (path.length === 0) return node;
  const [step, ...rest] = path;
  return getNodeAtPath(node[step], rest);
}

function setNodeAtPath(node, path, replacement) {
  if (path.length === 0) return replacement;
  const [step, ...rest] = path;
  return { ...node, [step]: setNodeAtPath(node[step], rest, replacement) };
}

// remove a leaf by path; collapse parent split, returning the new root
function removeAtPath(node, path) {
  if (path.length === 0) return null; // remove root
  if (path.length === 1) {
    // parent is `node` (a split); the sibling survives
    const sibling = path[0] === 'a' ? node.b : node.a;
    return sibling;
  }
  const [step, ...rest] = path;
  const newChild = removeAtPath(node[step], rest);
  if (newChild === null) {
    // shouldn't happen since path>=2 means we collapse one level above
    return node;
  }
  return { ...node, [step]: newChild };
}

// insert a leaf next to the leaf at targetPath, on the given side
// side: 'l' | 'r' | 't' | 'b'
function insertAdjacent(node, targetPath, side, leafToInsert) {
  const target = getNodeAtPath(node, targetPath);
  if (!target) return node;
  const dir = (side === 'l' || side === 'r') ? 'h' : 'v';
  const insertFirst = (side === 'l' || side === 't');
  const newSplit = {
    type: 'split', dir, ratio: 0.5,
    a: insertFirst ? leafToInsert : target,
    b: insertFirst ? target : leafToInsert,
  };
  if (targetPath.length === 0) return newSplit;
  return setNodeAtPath(node, targetPath, newSplit);
}

// update a split node's ratio by tracing a path of 'a'/'b' steps
function updateRatioAtPath(node, path, ratio) {
  if (!node || node.type === 'leaf') return node;
  if (path.length === 0) return { ...node, ratio };
  const [step, ...rest] = path;
  if (step === 'a') return { ...node, a: updateRatioAtPath(node.a, rest, ratio) };
  return { ...node, b: updateRatioAtPath(node.b, rest, ratio) };
}

/* ----------------- pane ----------------- */

function Pane({ sess, wsId, ws, focused, onFocus, onSplit, onClose, paneKey, onDragStart, onDragEnd, onDropOnPane, dragActive, isDragSource }) {
  const [over, setOver] = useState(null);
  const headerRef = useRef(null);

  const handleHeaderDragStart = (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/x-pane-key', paneKey);
    onDragStart && onDragStart(paneKey);
  };
  const handleHeaderDragEnd = () => onDragEnd && onDragEnd();

  const allowDrop = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const onZoneEnter = (zone) => () => setOver(zone);
  const onZoneLeave = () => setOver(null);
  const onZoneDrop = (zone) => (e) => {
    e.preventDefault();
    setOver(null);
    onDropOnPane && onDropOnPane(paneKey, zone);
  };

  return (
    <div className={`pane ${focused ? 'focused' : ''} ${isDragSource ? 'drag-source' : ''}`} data-ws={wsId} onMouseDown={onFocus}>
      <div className={`pane-header ${isDragSource ? 'dragging' : ''}`}
           ref={headerRef}
           draggable
           onDragStart={handleHeaderDragStart}
           onDragEnd={handleHeaderDragEnd}>
        <div className="pane-title">
          <span className="pane-id">[{sess.id.toUpperCase()}]</span>
          <span>{sess.name}</span>
          <Badge status={sess.status} />
          {ws && (
            <span className="ws-chip" data-ws={wsId}>
              <span className="ws-glyph"></span>{ws.name}
            </span>
          )}
        </div>
        <div className="pane-cwd mono" style={{ fontSize: 10, color: 'var(--fg-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {sess.cwd} · {sess.branch}
        </div>
        <div className="pane-actions">
          <button className="pane-btn" title="split right" onClick={(e) => { e.stopPropagation(); onSplit('h', e.currentTarget); }}>
            <Icon.SplitH />
          </button>
          <button className="pane-btn" title="split down" onClick={(e) => { e.stopPropagation(); onSplit('v', e.currentTarget); }}>
            <Icon.SplitV />
          </button>
          <button className="pane-btn" title="close" onClick={(e) => { e.stopPropagation(); onClose(); }}>
            <Icon.Close />
          </button>
        </div>
      </div>
      <TermBody kind={sess.body} sess={sess} />
      <div className="pane-fab">
        <button title="split right" onClick={(e) => { e.stopPropagation(); onSplit('h', e.currentTarget); }}><Icon.SplitH /></button>
        <button title="split down"  onClick={(e) => { e.stopPropagation(); onSplit('v', e.currentTarget); }}><Icon.SplitV /></button>
      </div>
      <div className="pane-input">
        <span className="pi-prompt">›</span>
        <input placeholder={sess.status === 'run' ? 'esc to interrupt · enter to queue' : 'type a message…'} />
        <span className="pi-hint">⌘↵ send</span>
      </div>
      {dragActive && !isDragSource && (
        <div className="pane-droplayer active">
          {['l','t','c','b','r'].map(z => (
            <div key={z}
                 className={`drop-zone dz-${z} ${over === z ? 'over' : ''}`}
                 onDragEnter={onZoneEnter(z)}
                 onDragOver={allowDrop}
                 onDragLeave={onZoneLeave}
                 onDrop={onZoneDrop(z)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------- divider with drag-to-resize ----------------- */

function Divider({ dir, path, onResize }) {
  const [dragging, setDragging] = useState(false);

  const startDrag = (e) => {
    e.preventDefault();
    setDragging(true);
    // The parent split element is two ancestors up: divider → split
    const splitEl = e.currentTarget.parentElement;
    const rect = splitEl.getBoundingClientRect();

    const move = (ev) => {
      let r;
      if (dir === 'h') r = (ev.clientX - rect.left) / rect.width;
      else             r = (ev.clientY - rect.top) / rect.height;
      r = Math.max(0.1, Math.min(0.9, r));
      onResize(path, r);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = dir === 'h' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return <div className={`split-divider ${dragging ? 'dragging' : ''}`} onMouseDown={startDrag} />;
}

/* ----------------- tree renderer ----------------- */

function TreeNode({ node, focusedId, setFocusedId, onSplitLeaf, onCloseLeaf, onResize, dragState, onDragStart, onDragEnd, onDropOnPane, path = [] }) {
  if (!node) return null;
  if (node.type === 'leaf') {
    const sess = SESSIONS.find(s => s.id === node.sessId);
    const ws = WORKSPACES.find(w => w.id === node.wsId);
    if (!sess) return null;
    const paneKey = path.join('') || 'r';
    return (
      <Pane
        sess={sess}
        wsId={node.wsId}
        ws={ws}
        focused={focusedId === sess.id}
        onFocus={() => setFocusedId(sess.id)}
        onSplit={(dir, anchor) => onSplitLeaf(sess.id, node.wsId, dir, anchor)}
        onClose={() => onCloseLeaf(path)}
        paneKey={path.join(',')}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDropOnPane={onDropOnPane}
        dragActive={!!dragState}
        isDragSource={dragState && dragState.sourcePath.join(',') === path.join(',')}
      />
    );
  }
  const ratio = node.ratio ?? 0.5;
  const aPct = `${(ratio * 100).toFixed(2)}%`;
  const bPct = `${((1 - ratio) * 100).toFixed(2)}%`;
  const aStyle = node.dir === 'h' ? { width: aPct, flex: 'none' } : { height: aPct, flex: 'none' };
  const bStyle = node.dir === 'h' ? { width: bPct, flex: 'none' } : { height: bPct, flex: 'none' };

  return (
    <div className={`split ${node.dir}`}>
      <div style={{ ...aStyle, display: 'flex', minWidth: 0, minHeight: 0 }}>
        <TreeNode node={node.a} focusedId={focusedId} setFocusedId={setFocusedId}
                  onSplitLeaf={onSplitLeaf} onCloseLeaf={onCloseLeaf} onResize={onResize}
                  dragState={dragState} onDragStart={onDragStart} onDragEnd={onDragEnd} onDropOnPane={onDropOnPane}
                  path={[...path, 'a']} />
      </div>
      <Divider dir={node.dir} path={path} onResize={onResize} />
      <div style={{ ...bStyle, display: 'flex', minWidth: 0, minHeight: 0 }}>
        <TreeNode node={node.b} focusedId={focusedId} setFocusedId={setFocusedId}
                  onSplitLeaf={onSplitLeaf} onCloseLeaf={onCloseLeaf} onResize={onResize}
                  dragState={dragState} onDragStart={onDragStart} onDragEnd={onDragEnd} onDropOnPane={onDropOnPane}
                  path={[...path, 'b']} />
      </div>
    </div>
  );
}

/* ----------------- split picker popover ----------------- */

function SplitPicker({ anchor, currentWsId, onPick, onClose }) {
  const ref = useRef(null);
  const [pickedWs, setPickedWs] = useState(currentWsId);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: Math.min(r.right - 240, window.innerWidth - 250) });
  }, [anchor]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [onClose]);

  const wsSessions = SESSIONS.filter(s => s.workspace === pickedWs);

  return (
    <div className="split-picker" ref={ref} style={{ position: 'fixed', top: pos.top, left: pos.left }}>
      <div className="sp-head">add session to split</div>
      <div className="sp-section">
        <div className="sp-label">workspace</div>
        {WORKSPACES.map(w => (
          <div key={w.id} className="sp-row" onClick={() => setPickedWs(w.id)}
               style={{ background: w.id === pickedWs ? 'var(--bg-3)' : 'transparent', color: w.id === pickedWs ? 'var(--fg-0)' : undefined }}>
            <span className="ws-chip" data-ws={w.id}><span className="ws-glyph"></span>{w.name}</span>
            <span style={{ flex: 1 }}></span>
            <span className="sp-id">{w.count}</span>
          </div>
        ))}
      </div>
      <div className="sp-section">
        <div className="sp-label">session</div>
        {wsSessions.map(s => (
          <div key={s.id} className="sp-row" onClick={() => onPick(s.id, pickedWs)}>
            <span className="sp-id">[{s.id.toUpperCase()}]</span>
            <span style={{ flex: 1 }}>{s.name}</span>
            <Badge status={s.status} />
          </div>
        ))}
        <div className="sp-row" style={{ color: 'var(--fg-2)' }} onClick={() => onPick('__new__', pickedWs)}>
          <span className="sp-id">+</span>
          <span style={{ flex: 1 }}>new session in {WORKSPACES.find(w=>w.id===pickedWs)?.name}</span>
        </div>
      </div>
    </div>
  );
}

/* ----------------- tabs layout ----------------- */

function TabsLayout({ tabs, focusedId, setFocusedId, onCloseSession }) {
  // tabs: [{ sessId, wsId }]
  const [activeIdx, setActiveIdx] = useState(0);
  const active = tabs[activeIdx] || tabs[0];
  const sess = active && SESSIONS.find(s => s.id === active.sessId);
  const ws = active && WORKSPACES.find(w => w.id === active.wsId);

  return (
    <div className="workspace" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="tabs">
        {tabs.map((t, i) => {
          const s = SESSIONS.find(x => x.id === t.sessId);
          const w = WORKSPACES.find(x => x.id === t.wsId);
          if (!s) return null;
          return (
            <div key={`${t.wsId}-${t.sessId}-${i}`}
              className={`tab ${s.status} ${i === activeIdx ? 'active' : ''}`}
              onClick={() => { setActiveIdx(i); setFocusedId(s.id); }}>
              <span className="tab-dot" />
              <span>[{s.id.toUpperCase()}]</span>
              <span style={{ color: 'inherit' }}>{s.name}</span>
              {w && <span className="ws-chip" data-ws={t.wsId} style={{ marginLeft: 4 }}><span className="ws-glyph"></span>{w.name}</span>}
              <span className="tab-x" onClick={(e) => { e.stopPropagation(); onCloseSession(s.id); }}>×</span>
            </div>
          );
        })}
        <div className="tab-add" title="new session"><Icon.Plus /></div>
      </div>
      <div className="panes-area">
        {sess ? (
          <Pane
            sess={sess}
            wsId={active.wsId}
            ws={ws}
            focused={true}
            onFocus={() => setFocusedId(sess.id)}
            onSplit={() => {}}
            onClose={() => onCloseSession(sess.id)}
          />
        ) : null}
      </div>
    </div>
  );
}

/* ----------------- split (tmux) layout ----------------- */

function SplitLayout({ tree, setTree, focusedId, setFocusedId, picker, setPicker }) {
  const [dragState, setDragState] = useState(null); // { sourcePath: [...] }

  const handleSplitRequest = (sessId, currentWsId, dir, anchor) => {
    setPicker({ sessId, currentWsId, dir, anchor });
  };

  const handleClose = (path) => {
    setTree(prev => {
      if (!prev) return prev;
      if (path.length === 0) return null;
      return removeAtPath(prev, path);
    });
  };

  const handleResize = useCallback((path, ratio) => {
    setTree(prev => updateRatioAtPath(prev, path, ratio));
  }, [setTree]);

  const onDragStart = (paneKey) => {
    const sourcePath = paneKey === 'r' || paneKey === '' ? [] : paneKey.split(',');
    setDragState({ sourcePath });
  };
  const onDragEnd = () => setDragState(null);

  const onDropOnPane = (targetKey, zone) => {
    if (!dragState) return;
    const sourcePath = dragState.sourcePath;
    const targetPath = targetKey === 'r' || targetKey === '' ? [] : targetKey.split(',');
    setDragState(null);
    if (sourcePath.join(',') === targetPath.join(',')) return;
    if (zone === 'c') return; // center swap not implemented; ignore for now

    setTree(prev => {
      const sourceLeaf = getNodeAtPath(prev, sourcePath);
      if (!sourceLeaf || sourceLeaf.type !== 'leaf') return prev;
      // Remove source first
      let next = removeAtPath(prev, sourcePath);
      // Adjust target path: any step that was 'b' on a parent shared with source's 'a' may have collapsed.
      // Easiest: re-find target by scanning leaves that match the old node.
      const targetLeaf = getNodeAtPath(prev, targetPath);
      if (!targetLeaf) return prev;
      const adjustedPath = findLeafPath(next, targetLeaf);
      if (!adjustedPath) return prev;
      next = insertAdjacent(next, adjustedPath, zone, { ...sourceLeaf });
      return next;
    });
  };

  return (
    <div className="workspace">
      <div className="panes-area" style={{ height: '100%' }}>
        <div className="panes-root">
          <TreeNode
            node={tree}
            focusedId={focusedId}
            setFocusedId={setFocusedId}
            onSplitLeaf={handleSplitRequest}
            onCloseLeaf={handleClose}
            onResize={handleResize}
            dragState={dragState}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDropOnPane={onDropOnPane}
          />
        </div>
      </div>
    </div>
  );
}

// find a path to a specific leaf node (object identity)
function findLeafPath(node, target, path = []) {
  if (!node) return null;
  if (node === target) return path;
  if (node.type === 'leaf') {
    if (node.sessId === target.sessId && node.wsId === target.wsId) return path;
    return null;
  }
  return findLeafPath(node.a, target, [...path, 'a']) || findLeafPath(node.b, target, [...path, 'b']);
}

/* ----------------- sidebar ----------------- */

function Sidebar({ workspaces, shownWs, toggleWs, focusedId, setFocusedId, paneList }) {
  return (
    <div className="sidebar">
      <div className="side-section">
        <div className="side-head">
          <span>workspaces</span>
          <button title="new workspace">+</button>
        </div>
        <div style={{ fontSize: 9, color: 'var(--fg-3)', padding: '0 0 6px', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.05em' }}>
          click to toggle · multi-select
        </div>
        <div className="ws-list">
          {workspaces.map((w) => {
            const isShown = shownWs.has(w.id);
            return (
              <div key={w.id} className={`ws-item ${isShown ? 'active shown' : ''}`} onClick={() => toggleWs(w.id)}>
                <span className="ws-mark" />
                <span>{w.name}</span>
                <span className="num">{w.count}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="side-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="side-head">
          <span>active panes · {paneList.length}</span>
          <button title="new session">+</button>
        </div>
        <div className="session-list">
          {paneList.map(({ sessId, wsId, key }) => {
            const s = SESSIONS.find(x => x.id === sessId);
            const w = WORKSPACES.find(x => x.id === wsId);
            if (!s) return null;
            return (
              <div key={key}
                   className={`sess-item ${focusedId === s.id ? 'focused' : ''}`}
                   onClick={() => setFocusedId(s.id)}>
                <div className="sess-item-head">
                  <span className="id">[{s.id.toUpperCase()}]</span>
                  <span className="name">{s.name}</span>
                  <Badge status={s.status} />
                </div>
                <div className="sess-item-path">
                  {w && <span className="ws-chip" data-ws={wsId} style={{ marginRight: 6 }}><span className="ws-glyph"></span>{w.name}</span>}
                  {s.cwd}
                </div>
                <div className="sess-item-path" style={{ fontSize: 10 }}>
                  ⎇ {s.branch}{s.activeTask ? ` · ${s.activeTask}` : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ----------------- tasks tray ----------------- */

function TasksTray({ tasks, sessions, onClose, setFocusedId }) {
  return (
    <div className="tasks-tray">
      <div className="tasks-head">
        <span>running tasks · {tasks.filter(t => t.state === 'run' || t.state === 'wait').length}</span>
        <span className="close" onClick={onClose}>×</span>
      </div>
      <div className="tasks-list">
        {tasks.map(t => {
          const sess = sessions.find(s => s.id === t.sess);
          return (
            <div key={t.id} className="task-item" onClick={() => setFocusedId(t.sess)}>
              <div className="task-row1">
                <span className="src">[{t.sess.toUpperCase()}]</span>
                <span style={{ flex: 1 }}>{t.label}</span>
                <Badge status={t.state === 'run' ? 'run' : t.state === 'wait' ? 'err' : 'done'}>
                  {t.state}
                </Badge>
              </div>
              <div className="task-row2">{sess?.cwd}</div>
              <div className="task-row3">
                <span>step {t.step}</span><span>·</span><span>{t.age}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------- title bar ----------------- */

function TitleBar({ ws, onToggleSidebar, onLayoutCycle, layout }) {
  return (
    <div className="titlebar">
      <div className="traffic">
        <button className="btn" title="close"><Icon.X /></button>
        <button className="btn" title="minimize"><Icon.Min /></button>
        <button className="btn" title="maximize"><Icon.Max /></button>
      </div>
      <div className="title-text mono">
        multiplex · <b>{ws?.name || '—'}</b> · {layout}
      </div>
      <div className="titlebar-actions">
        <button className="tb-btn" onClick={onToggleSidebar}><Icon.Side /> sidebar</button>
        <button className="tb-btn" onClick={onLayoutCycle}><Icon.Layout /> {layout}</button>
      </div>
    </div>
  );
}

/* ----------------- status bar ----------------- */

function StatusBar({ stats, onTasksClick, tasksOpen, layout, theme, paneCount }) {
  return (
    <div className="statusbar mono">
      <div className="seg"><span>multiplex</span></div>
      <div className="seg"><span>panes</span><b>{paneCount}</b></div>
      <div className="seg"><span>running</span><b>{stats.run}</b></div>
      <div className="seg"><span>idle</span><b>{stats.idle}</b></div>
      <div className="seg"><span>awaiting</span><b>{stats.err}</b></div>
      <div className="sp" />
      <div className="seg"><span>tokens</span><b>{stats.tokens}</b></div>
      <div className="seg"><span>layout</span><b>{layout}</b></div>
      <div className="seg"><span>theme</span><b>{theme}</b></div>
      <button className="sb-btn seg" onClick={onTasksClick}>
        <Icon.Bell /><span>{tasksOpen ? 'hide' : 'show'} tasks</span>
      </button>
    </div>
  );
}

/* ----------------- App root ----------------- */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "layout": "split",
  "theme": "dark",
  "sidebar": true,
  "showTasks": true
}/*EDITMODE-END*/;

// flatten the tree into [{ sessId, wsId, key }] for sidebar list
function flattenTree(node, path = [], out = []) {
  if (!node) return out;
  if (node.type === 'leaf') {
    out.push({ sessId: node.sessId, wsId: node.wsId, key: path.join('') || 'r' });
    return out;
  }
  flattenTree(node.a, [...path, 'a'], out);
  flattenTree(node.b, [...path, 'b'], out);
  return out;
}

function App() {
  const [tw, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [shownWs, setShownWs] = useState(new Set(['ws1', 'ws2']));
  const [focusedId, setFocusedId] = useState('s1');
  const [tree, setTree] = useState(initialTree);
  const [tasksOpen, setTasksOpen] = useState(true);
  const [picker, setPicker] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tw.theme);
  }, [tw.theme]);

  const toggleWs = (id) => {
    setShownWs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const stats = {
    run: SESSIONS.filter(s => s.status === 'run').length,
    idle: SESSIONS.filter(s => s.status === 'idle').length,
    err: SESSIONS.filter(s => s.status === 'err').length,
    tokens: '146.2k',
  };

  const onCloseSession = (id) => {
    setTree(prev => removeLeaf(prev, id) || { type: 'leaf', sessId: SESSIONS[0].id, wsId: SESSIONS[0].workspace });
  };

  const onLayoutCycle = () => {
    const order = ['split', 'tabs'];
    const next = order[(order.indexOf(tw.layout) + 1) % order.length];
    setTweak('layout', next);
  };

  // confirm the picker -> insert a split into the tree
  const confirmPick = (sessId, wsId) => {
    if (!picker) return;
    const realSessId = sessId === '__new__' ? `s${Date.now()}` : sessId;
    setTree(prev => replaceLeaf(prev, picker.sessId, {
      type: 'split', dir: picker.dir, ratio: 0.5,
      a: { type: 'leaf', sessId: picker.sessId, wsId: picker.currentWsId },
      b: { type: 'leaf', sessId: realSessId, wsId },
    }));
    setFocusedId(realSessId);
    setPicker(null);
  };

  const paneList = flattenTree(tree);
  const tabsList = paneList; // tabs view shows every pane in the tree as a tab

  const layoutPanes = (() => {
    if (tw.layout === 'tabs')
      return <TabsLayout tabs={tabsList} focusedId={focusedId} setFocusedId={setFocusedId} onCloseSession={onCloseSession} />;

    return (
      <SplitLayout
        tree={tree}
        setTree={setTree}
        focusedId={focusedId}
        setFocusedId={setFocusedId}
        picker={picker}
        setPicker={setPicker}
      />
    );
  })();

  const headerWsLabel = (() => {
    const ids = [...shownWs];
    if (ids.length === 1) return WORKSPACES.find(w => w.id === ids[0])?.name || '—';
    return `${ids.length} workspaces`;
  })();

  return (
    <>
      <div className="app">
        <TitleBar
          ws={{ name: headerWsLabel }}
          onToggleSidebar={() => setTweak('sidebar', !tw.sidebar)}
          onLayoutCycle={onLayoutCycle}
          layout={tw.layout}
        />
        <div className={`main ${tw.sidebar ? '' : 'no-sidebar'}`}>
          <Sidebar
            workspaces={WORKSPACES}
            shownWs={shownWs}
            toggleWs={toggleWs}
            focusedId={focusedId}
            setFocusedId={setFocusedId}
            paneList={paneList}
          />
          <div style={{ position: 'relative', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {layoutPanes}
            {picker && (
              <SplitPicker
                anchor={picker.anchor}
                currentWsId={picker.currentWsId}
                onPick={confirmPick}
                onClose={() => setPicker(null)}
              />
            )}
            {tasksOpen && tw.showTasks && (
              <TasksTray
                tasks={TASKS}
                sessions={SESSIONS}
                onClose={() => setTasksOpen(false)}
                setFocusedId={setFocusedId}
              />
            )}
          </div>
        </div>
        <StatusBar
          stats={stats}
          onTasksClick={() => setTasksOpen(o => !o)}
          tasksOpen={tasksOpen && tw.showTasks}
          layout={tw.layout}
          theme={tw.theme}
          paneCount={tw.layout === 'tabs' ? 1 : paneList.length}
        />
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Layout">
          <TweakRadio
            label="Mode"
            value={tw.layout}
            onChange={(v) => setTweak('layout', v)}
            options={[
              { label: 'Split', value: 'split' },
              { label: 'Tabs', value: 'tabs' },
            ]}
          />
          <TweakToggle label="Sidebar" value={tw.sidebar} onChange={(v) => setTweak('sidebar', v)} />
          <TweakToggle label="Tasks tray" value={tw.showTasks} onChange={(v) => setTweak('showTasks', v)} />
          <TweakButton onClick={() => setTree(initialTree)}>Reset split layout</TweakButton>
        </TweakSection>
        <TweakSection title="Theme">
          <TweakRadio
            label="Theme"
            value={tw.theme}
            onChange={(v) => setTweak('theme', v)}
            options={[
              { label: 'Dark', value: 'dark' },
              { label: 'Light', value: 'light' },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

// strip leaves whose sessId is missing from data (defensive)
function filterTreeBy(node) {
  if (!node) return null;
  if (node.type === 'leaf') return SESSIONS.find(s => s.id === node.sessId) ? node : null;
  const a = filterTreeBy(node.a), b = filterTreeBy(node.b);
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  return { ...node, a, b };
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
