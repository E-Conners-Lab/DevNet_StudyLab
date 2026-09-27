import { loadPyodide } from './assets/pyodide.mjs';

// CSP on this response is the boundary. Python has unrestricted JS interop
// within this worker; it must have no study-origin or external network access.
const send = (message) => globalThis.postMessage(message);
function output(stream, text) {
  const value = `${text}\n`;
  for (let offset = 0; offset < value.length; offset += 4096) {
    send({ type: 'output', stream, text: value.slice(offset, offset + 4096) });
  }
}

try {
  const python = await loadPyodide({
    indexURL: './assets/',
    packages: ['pyyaml', 'jinja2'],
    stdout: (text) => output('stdout', text),
    stderr: (text) => output('stderr', text),
  });
  globalThis.onmessage = async ({ data }) => {
    if (data?.type !== 'run' || typeof data.code !== 'string') return;
    // The controlling frame permits exactly one run per disposable worker.
    globalThis.onmessage = null;
    try {
      await python.runPythonAsync(data.code);
      send({ type: 'done' });
    } catch (error) {
      send({ type: 'error', text: String(error).slice(0, 1000) });
    }
  };
  send({ type: 'ready' });
} catch {
  send({ type: 'error', text: 'The bundled Python runtime could not load. Check that the complete release archive was extracted.' });
}
