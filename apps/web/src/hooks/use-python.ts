"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_RUNNER = "http://127.0.0.1:4319";
export function getRunnerOrigin() {
  const configured = typeof document !== "undefined" ? document.querySelector<HTMLMetaElement>('meta[name="studylab-runner-origin"]')?.content : undefined;
  return configured && /^http:\/\/127\.0\.0\.1:\d+$/.test(configured) ? configured : DEFAULT_RUNNER;
}
const MAX_OUTPUT = 64 * 1024;
const MAX_CODE = 128 * 1024;
const WATCHDOG_MS = 45_000;
const TERMINAL = new Set(["done", "error", "timeout", "cancelled", "output-limit"]);

/** The only bridge into the separate-origin, disposable Python worker. */
export function usePython() {
  const runnerOrigin = getRunnerOrigin();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const activeId = useRef<string | null>(null);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("");
  const [success, setSuccess] = useState<boolean | null>(null);
  const [frameKey, setFrameKey] = useState(0);

  const finish = useCallback((ok: boolean) => {
    activeId.current = null;
    if (watchdog.current) clearTimeout(watchdog.current);
    watchdog.current = null;
    setRunning(false);
    setSuccess(ok);
  }, []);
  const cancel = useCallback(() => {
    if (!activeId.current) return;
    frameRef.current?.contentWindow?.postMessage({v:1, type:"cancel", id:activeId.current}, runnerOrigin);
    finish(false);
    setOutput(previous => `${previous}\nExecution cancelled.`.slice(0, MAX_OUTPUT));
  }, [finish, runnerOrigin]);

  useEffect(() => {
    let ownedWindow: Window | null = null;
    const receive = (event: MessageEvent) => {
      const frameWindow = frameRef.current?.contentWindow;
      if (!frameWindow || event.origin !== runnerOrigin || event.source !== frameWindow) return;
      ownedWindow = frameWindow;
      const data = event.data;
      if (!data || typeof data !== "object" || data.v !== 1) return;
      if (data.type === "ready") { setReady(true); return; }
      if (!activeId.current || data.id !== activeId.current) return;
      if (data.type === "output" && typeof data.text === "string") {
        setOutput(previous => `${previous}${data.text}`.slice(0, MAX_OUTPUT));
      } else if (data.type === "status" && TERMINAL.has(data.status)) {
        if (typeof data.message === "string") setOutput(previous => `${previous}\n${data.message}`.slice(0, MAX_OUTPUT));
        finish(data.status === "done");
      }
    };
    window.addEventListener("message", receive);
    return () => {
      window.removeEventListener("message", receive);
      if (watchdog.current) clearTimeout(watchdog.current);
      if (activeId.current) ownedWindow?.postMessage({v:1,type:"cancel",id:activeId.current}, runnerOrigin);
    };
  }, [finish, runnerOrigin]);

  const run = useCallback((code: string) => {
    if (activeId.current) return;
    if (!ready || !frameRef.current?.contentWindow) { setOutput("Python sandbox is not ready. Wait a moment or reload this page."); return; }
    if (new TextEncoder().encode(code).byteLength > MAX_CODE) { setOutput("Code exceeds the 128 KiB limit."); return; }
    const id = crypto.randomUUID();
    activeId.current = id;
    setRunning(true); setSuccess(null); setOutput("");
    frameRef.current.contentWindow.postMessage({v:1,type:"run",id,code}, runnerOrigin);
    watchdog.current = setTimeout(() => {
      finish(false); setReady(false); setFrameKey(previous => previous + 1);
      setOutput("Python sandbox stopped responding and was restarted. Try running again.");
    }, WATCHDOG_MS);
  }, [ready, finish, runnerOrigin]);
  const clear = useCallback(() => { setOutput(""); setSuccess(null); }, []);
  return { runnerOrigin, frameRef, frameKey, ready, running, output, success, run, cancel, clear };
}
