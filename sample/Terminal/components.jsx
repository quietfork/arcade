// Reusable components for Multiplex prototype

const Icon = {
  Plus: () => <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M6 2v8M2 6h8"/></svg>,
  X: () => <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M3 3l6 6M9 3l-6 6"/></svg>,
  Min: () => <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M3 6h6"/></svg>,
  Max: () => <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="3" y="3" width="6" height="6"/></svg>,
  SplitH: () => <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1"><rect x="1.5" y="1.5" width="9" height="9"/><path d="M6 1.5v9"/></svg>,
  SplitV: () => <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1"><rect x="1.5" y="1.5" width="9" height="9"/><path d="M1.5 6h9"/></svg>,
  Close: () => <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1"><rect x="1.5" y="1.5" width="9" height="9"/><path d="M4 4l4 4M8 4l-4 4"/></svg>,
  Bell: () => <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1"><path d="M3 5a3 3 0 016 0v2.5l1 1.5H2l1-1.5V5z"/><path d="M5 10a1 1 0 002 0"/></svg>,
  Layout: () => <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1"><rect x="1.5" y="1.5" width="4" height="9"/><rect x="6.5" y="1.5" width="4" height="4"/><rect x="6.5" y="6.5" width="4" height="4"/></svg>,
  Side: () => <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1"><rect x="1.5" y="1.5" width="9" height="9"/><path d="M4.5 1.5v9"/></svg>,
};

function Badge({ status, children }) {
  const label = children || ({
    idle: 'idle',
    run: 'running',
    done: 'done',
    err: 'awaiting',
  })[status];
  return (
    <span className={`badge ${status}`}>
      <span className="b-dot"></span>
      {label}
    </span>
  );
}

// ------- Terminal body renderers -------

function TermBody({ kind, sess }) {
  const Body = TermBodies[kind] || TermBodies.body_idle;
  return <div className="term"><Body sess={sess} /></div>;
}

const TermBodies = {
  body_idle: ({ sess }) => (
    <>
      <div className="ln muted">claude-code 0.8.4 — connected · model: claude-sonnet-4.5</div>
      <div className="ln muted">cwd: {sess.cwd}</div>
      <div className="ln muted">git: {sess.branch} (clean)</div>
      <div className="ln muted">────────────────────────────────────────────────────</div>
      <div className="ln dim">type a message, drop a file, or run `/help`</div>
      <div className="ln" style={{ marginTop: 16 }}>
        <span className="prompt">› </span><span className="cursor"></span>
      </div>
    </>
  ),

  body_run: ({ sess }) => (
    <>
      <div className="ln muted">cwd: {sess.cwd} · {sess.branch}</div>
      <div className="ln" style={{ marginTop: 8 }}>
        <span className="prompt">› </span>
        <span>Split the router into per-method handlers and add table-driven tests.</span>
      </div>
      <div className="tool-call">
        <div className="tc-head">read · internal/router/router.go</div>
        <div className="ln dim">  214 lines · matched 3 patterns</div>
      </div>
      <div className="tool-call">
        <div className="tc-head">edit · internal/router/handler.go</div>
        <div className="ln"><span className="diff-rem">{'- func (r *Router) Handle(w http.ResponseWriter, req *http.Request) {'}</span></div>
        <div className="ln"><span className="diff-add">{'+ func (r *Router) routeGET(w http.ResponseWriter, req *http.Request) {'}</span></div>
        <div className="ln"><span className="diff-add">{'+ func (r *Router) routePOST(w http.ResponseWriter, req *http.Request) {'}</span></div>
        <div className="ln dim">  +37 / -12 lines</div>
      </div>
      <div className="ln em" style={{ marginTop: 8 }}>
        I'll split this into <span className="em">routeGET</span>, <span className="em">routePOST</span>, and{' '}
        <span className="em">routeDELETE</span> handlers, then add tests covering the
      </div>
      <div className="ln em">edge cases we discussed (trailing slashes, query params, 405 responses).</div>
      <div className="ln" style={{ marginTop: 12 }}>
        <span className="dim">working on </span>
        <span className="em">internal/router/handler.go</span>
        <span className="dim"> · 3 of 7 files</span>
        <span className="spinner"> ▍</span>
      </div>
    </>
  ),

  body_run2: ({ sess }) => (
    <>
      <div className="ln muted">cwd: {sess.cwd} · {sess.branch}</div>
      <div className="ln" style={{ marginTop: 8 }}>
        <span className="prompt">› </span>
        <span>Make the title bar match the macOS spec but draggable on Linux/Windows too.</span>
      </div>
      <div className="tool-call">
        <div className="tc-head">read · TitleBar.tsx</div>
        <div className="ln dim">  92 lines</div>
      </div>
      <div className="ln em" style={{ marginTop: 8 }}>
        Looking at how <span className="em">--wails-drag</span> currently behaves on each platform.
      </div>
      <div className="ln em">The current layout assumes traffic-light width on macOS — I'll flip to</div>
      <div className="ln em">a platform-aware layout via <span className="em">runtime.Environment.Platform</span>.</div>
      <div className="ln" style={{ marginTop: 12 }}>
        <span className="dim">reading </span>
        <span className="em">TitleBar.tsx</span>
        <span className="spinner"> ▍</span>
      </div>
    </>
  ),

  body_done: ({ sess }) => (
    <>
      <div className="ln muted">cwd: {sess.cwd} · {sess.branch}</div>
      <div className="ln" style={{ marginTop: 8 }}>
        <span className="prompt">› </span>
        <span>Wire up the PTY bridge and add coverage for the resize path.</span>
      </div>
      <div className="tool-call">
        <div className="tc-head">edit · internal/pty/bridge.go</div>
        <div className="ln dim">  +84 / -6 lines</div>
      </div>
      <div className="tool-call">
        <div className="tc-head">write · internal/pty/bridge_test.go</div>
        <div className="ln dim">  new file · 142 lines</div>
      </div>
      <div className="tool-call">
        <div className="tc-head">bash · go test ./internal/pty/...</div>
        <div className="ln ok">  ok  multiplex/internal/pty  0.412s · 14 tests</div>
      </div>
      <div className="ln em" style={{ marginTop: 8 }}>
        Done. The bridge now forwards SIGWINCH cleanly, and there's a regression
      </div>
      <div className="ln em">test for the race between resize and write that bit us last week.</div>
      <div className="box" style={{ marginTop: 10 }}>
        <div className="ln dim">summary</div>
        <div className="ln">2 files changed · +226 / -6 lines · 14/14 tests passing</div>
      </div>
      <div className="ln" style={{ marginTop: 12 }}>
        <span className="prompt">› </span><span className="cursor"></span>
      </div>
    </>
  ),

  body_err: ({ sess }) => (
    <>
      <div className="ln muted">cwd: {sess.cwd} · {sess.branch}</div>
      <div className="ln" style={{ marginTop: 8 }}>
        <span className="prompt">› </span>
        <span>Find why the auth e2e is flaking on CI but not locally.</span>
      </div>
      <div className="tool-call">
        <div className="tc-head">bash · pnpm test:e2e --filter auth</div>
        <div className="ln dim">  spawning chromium · 12 specs</div>
      </div>
      <div className="box warn" style={{ borderColor: 'var(--fg-2)', borderStyle: 'dashed' }}>
        <div className="ln em">awaiting confirmation</div>
        <div className="ln dim" style={{ marginTop: 4 }}>
          this command will run for ~3 minutes and write to ./test-results.
        </div>
        <div className="ln" style={{ marginTop: 8 }}>
          <span className="dim">[ </span>
          <span className="em">y</span>
          <span className="dim"> ] approve   [ </span>
          <span>n</span>
          <span className="dim"> ] cancel   [ </span>
          <span>e</span>
          <span className="dim"> ] edit command</span>
        </div>
      </div>
      <div className="ln" style={{ marginTop: 8 }}>
        <span className="prompt">› </span><span className="cursor"></span>
      </div>
    </>
  ),
};

window.Icon = Icon;
window.Badge = Badge;
window.TermBody = TermBody;
