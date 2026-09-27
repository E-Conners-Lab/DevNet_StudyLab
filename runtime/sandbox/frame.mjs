import { createSandboxController } from './controller.mjs';

// Ports separate browser origins; this frame must NEVER be served on the study origin.
const STUDY_ORIGIN = 'http://127.0.0.1:4318';
const RUNNER_ORIGIN = 'http://127.0.0.1:4319';

if (location.origin === RUNNER_ORIGIN && window.parent !== window) {
  const controller = createSandboxController({
    postToParent: (message) => window.parent.postMessage(message, STUDY_ORIGIN),
    createWorker: () => new Worker('/worker.mjs', { type: 'module', name: 'isolated-python' }),
  });
  window.addEventListener('message', (event) => {
    if (event.origin !== STUDY_ORIGIN || event.source !== window.parent) return;
    controller.handleCommand(event.data);
  });
  window.addEventListener('pagehide', () => controller.dispose());
  window.parent.postMessage({ v: 1, type: 'ready' }, STUDY_ORIGIN);
}
