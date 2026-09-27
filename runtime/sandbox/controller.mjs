/** Treat every message from Python's worker as hostile, including status messages. */
const LIMITS = Object.freeze({ codeBytes: 128 * 1024, outputBytes: 64 * 1024, chunkChars: 4096, messages: 512, startupMs: 30_000, runMs: 10_000 });
const ID_PATTERN = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const bytes = (text) => new TextEncoder().encode(text).byteLength;

export function createSandboxController({
  postToParent,
  createWorker,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let active = null;
  const status = (id, value, message) => postToParent({ v: 1, type: 'status', id, status: value, ...(message ? { message } : {}) });

  function finish(value, message) {
    if (!active) return;
    const previous = active;
    active = null;
    clearTimer(previous.timer);
    previous.worker.terminate();
    status(previous.id, value, message);
  }

  function onWorkerMessage(token, data) {
    if (!active || active.token !== token) return;
    active = { ...active, messages: active.messages + 1 };
    if (active.messages > LIMITS.messages) return finish('output-limit', 'Python produced too many messages.');
    if (!data || typeof data !== 'object') return;
    if (data.type === 'error' && typeof data.text === 'string') return finish('error', data.text.slice(0, 1000));
    if (data.type === 'ready' && active.phase === 'loading') {
      clearTimer(active.timer);
      const code = active.code;
      active = { ...active, phase: 'running', code: '', timer: setTimer(() => finish('timeout', 'Python reached the 10-second execution limit.'), LIMITS.runMs) };
      status(active.id, 'running');
      active.worker.postMessage({ type: 'run', code });
      return;
    }
    if (active.phase !== 'running') return;
    if (data.type === 'done') return finish('done');
    if (data.type !== 'output' || !['stdout', 'stderr'].includes(data.stream) || typeof data.text !== 'string') return;
    if (data.text.length > LIMITS.chunkChars || active.outputBytes + bytes(data.text) > LIMITS.outputBytes) {
      return finish('output-limit', 'Python reached the 64 KiB output limit.');
    }
    active = { ...active, outputBytes: active.outputBytes + bytes(data.text) };
    postToParent({ v: 1, type: 'output', id: active.id, stream: data.stream, text: data.text });
  }

  function start(command) {
    if (typeof command.code !== 'string' || bytes(command.code) > LIMITS.codeBytes) {
      status(command.id, 'error', 'Python code must be text no larger than 128 KiB.');
      return;
    }
    finish('cancelled', 'A new run replaced the previous run.');
    const token = Symbol('run');
    let worker;
    try { worker = createWorker(); } catch { status(command.id, 'error', 'This browser could not start the Python worker.'); return; }
    active = { id: command.id, token, worker, code: command.code, phase: 'loading', messages: 0, outputBytes: 0, timer: setTimer(() => finish('timeout', 'The local Python runtime did not load within 30 seconds.'), LIMITS.startupMs) };
    worker.onmessage = ({ data }) => onWorkerMessage(token, data);
    worker.onerror = (event) => {
      event.preventDefault?.();
      if (active?.token === token) finish('error', 'The Python worker stopped unexpectedly. Run it again to start a fresh session.');
    };
    status(command.id, 'loading');
  }

  function handleCommand(command) {
    if (!command || typeof command !== 'object' || command.v !== 1 || typeof command.id !== 'string' || !ID_PATTERN.test(command.id)) return;
    if (command.type === 'run') start(command);
    else if (command.type === 'cancel' && active?.id === command.id) finish('cancelled', 'Python execution cancelled.');
  }

  return Object.freeze({ handleCommand, dispose: () => finish('cancelled') });
}
