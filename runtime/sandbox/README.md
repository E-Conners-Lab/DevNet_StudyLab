# Offline Python boundary

The study app lives on `http://127.0.0.1:4318`. This frame and its disposable
module Worker live on `http://127.0.0.1:4319`. Both listeners bind loopback only.
Never put this frame on the study origin or embed secrets in its assets.

Python's JavaScript bridge is deliberately available. Isolation comes from browser
origins and the worker's HTTP Content-Security-Policy, not Python import filters.
The runner has no endpoints that read host files, execute host commands, proxy
network calls, or accept application writes. A new worker provides a fresh virtual
filesystem for every run. The main application receives only bounded text/status.

The frame response requires `default-src 'none'; script-src 'self'; worker-src
'self'; connect-src 'none'; frame-ancestors http://127.0.0.1:4318; base-uri 'none';
form-action 'none'`. The worker response requires `default-src 'none'; script-src
'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'none'`. These must be HTTP
headers, including on `/worker.mjs`; a page-only CSP does not establish the worker
boundary. No `unsafe-eval`, remote script sources, or CORS grants are required.

Frame embedding uses `sandbox="allow-scripts allow-same-origin"` **only with the
separate origin**. Both ends validate the sender origin and window identity. Ports
do not isolate cookies: no credentials belong in the runner origin or its static
responses. The runner has no `/api` routes. The app must not expose a generic proxy.

Protocol version 1: the frame announces `{v:1,type:"ready"}`. The app sends
`{v:1,type:"run",id:<UUID>,code:<text>}` or `{v:1,type:"cancel",id:<UUID>}`. Responses
are `{v:1,type:"status",id,status,message?}` and
`{v:1,type:"output",id,stream:"stdout"|"stderr",text}`. Loading/running are the only
nonterminal statuses. UI code accepts only its current run ID and renders text.

Limits: 128 KiB UTF-8 source, 30-second startup, 10-second execution, 64 KiB output,
512 worker messages and one worker at a time. Duplicate worker readiness cannot
reset the watchdog. The UI should also reset an unresponsive frame after 45 seconds.
These protect ordinary loops/output. Browser memory/CPU exhaustion is still
possible; this is not an OS/container sandbox or an environment for running hostile
third-party programs. There is no access to host files unless a future maintainer
adds and separately reviews such a capability.

Build assets using `node runtime/prepare-python.mjs`. Its committed manifest pins
every asset and notice by SHA-256 and exact size. Release archives include the cache;
the browser never fetches a CDN. Missing files fail closed. Pyodide is unmodified
314.0.7 (Python 3.14.2 / Emscripten 5.0.3), with PyYAML 6.0.3, Jinja2 3.1.6 and
MarkupSafe 3.0.3. Other third-party imports and network/device labs are not supported.

Upstream source and notices:

- Pyodide, MPL-2.0: https://github.com/pyodide/pyodide/tree/314.0.7
- Pyodide recipes: https://github.com/pyodide/pyodide-recipes/releases/tag/314-20260911
- CPython: https://github.com/python/cpython/tree/v3.14.2
- Emscripten: https://github.com/emscripten-core/emscripten/tree/5.0.3
- Dependency source URLs and complete bundled license notices are pinned in
  `runtime/pyodide-manifest.json` and shipped in `runtime/vendor/pyodide/`.

Security applicability: SEC-05/07/23/36 apply to message validation/versioning and
the separate local server; SEC-09/10/25 to the documented server headers;
SEC-12/18/20/22/27/32 to no secret/host-file capabilities; SEC-29/30 to pinned assets.
Authentication/password/JWT/upload metadata/container controls are N/A to this
static, secret-free worker. AI-1 through AI-4 are N/A: Python execution does not use
a model or expose tool execution to the tutor. Repository/CI controls remain the
release pipeline's responsibility.
