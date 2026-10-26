/**
 * Minimal raw-CDP client for targets Playwright does not expose.
 *
 * Chrome exposes the real Side Panel as its own WebContents target, but
 * Playwright's CDP attach only lists ordinary tab targets. This client talks
 * to the browser-level debugger socket directly so the panel can be driven.
 *
 * Clicks go through `Input.dispatchMouseEvent`, which is the same trusted
 * input path DevTools uses: the resulting DOM event has `isTrusted === true`,
 * which is exactly what the capture start requires. `element.click()` from
 * `Runtime.evaluate` would NOT be trusted.
 */

export class RawCdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    this.sessions = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) {
        if (message.sessionId && message.method) {
          this.sessions.get(message.sessionId)?._emit(message.method, message.params ?? {});
        }
        return;
      }
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      if (message.error) entry.reject(new Error(`${message.error.message} (${entry.method})`));
      else entry.resolve(message.result);
    });
  }

  static async connect(cdpHttpUrl) {
    const version = await (await fetch(`${cdpHttpUrl}/json/version`)).json();
    const socket = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return new RawCdp(socket);
  }

  send(method, params = {}, sessionId) {
    const id = ++this.nextId;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify(payload));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }

  async targets() {
    const { targetInfos } = await this.send("Target.getTargets");
    return targetInfos;
  }

  async attach(targetId) {
    const { sessionId } = await this.send("Target.attachToTarget", { targetId, flatten: true });
    const session = new Session(this, sessionId, targetId);
    this.sessions.set(sessionId, session);
    return session;
  }

  async attachToFirstMatching(predicate) {
    const infos = await this.targets();
    const info = infos.find(predicate);
    if (!info) throw new Error(`no target matched; saw ${JSON.stringify(infos.map((i) => `${i.type}:${i.url}`))}`);
    const session = await this.attach(info.targetId);
    return { session, info };
  }

  close() {
    this.socket.close();
  }
}

export class Session {
  constructor(client, sessionId, targetId) {
    this.client = client;
    this.sessionId = sessionId;
    this.targetId = targetId;
    this.listeners = new Map();
  }

  send(method, params) {
    return this.client.send(method, params, this.sessionId);
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? new Set();
    listeners.add(listener);
    this.listeners.set(method, listeners);
    return () => listeners.delete(listener);
  }

  _emit(method, params) {
    for (const listener of this.listeners.get(method) ?? []) listener(params);
  }

  async detach() {
    await this.client.send("Target.detachFromTarget", { sessionId: this.sessionId });
    this.client.sessions.delete(this.sessionId);
  }

  /** Evaluate an expression in the page and return its JSON value. */
  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    }
    return result.result?.value;
  }

  /** Click an element by CSS selector with a TRUSTED input event. */
  async trustedClick(selector, { timeoutMs = 8000 } = {}) {
    const rect = await this.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      // The real side panel is a narrow strip: the control can be scrolled
      // out of the viewport, so bring it back before measuring.
      el.scrollIntoView({ block: "center", inline: "center" });
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return null;
      const inViewport =
        r.left >= 0 && r.top >= 0 &&
        r.right <= (window.innerWidth || 0) && r.bottom <= (window.innerHeight || 0);
      return {
        x: r.left + r.width / 2, y: r.top + r.height / 2,
        inViewport, rect: { l: r.left, t: r.top, w: r.width, h: r.height },
        viewport: { w: window.innerWidth, h: window.innerHeight }
      };
    })()`);
    if (!rect) throw new Error(`selector not found or not visible: ${selector}`);
    if (!rect.inViewport) {
      throw new Error(
        `selector is outside the side-panel viewport: ${JSON.stringify(rect)}`
      );
    }
    const base = { x: rect.x, y: rect.y, button: "left", clickCount: 1, buttons: 1 };
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...base, buttons: 0 });
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", ...base });
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...base, buttons: 0 });
    return true;
  }
}
