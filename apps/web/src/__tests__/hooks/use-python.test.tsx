import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { getRunnerOrigin, usePython } from '@/hooks/use-python';
afterEach(()=>{cleanup();vi.useRealTimers();document.head.replaceChildren();});
function setup(){
 const view=renderHook(usePython);const frame=document.createElement('iframe');document.body.append(frame);
 view.result.current.frameRef.current=frame;
 const post=vi.spyOn(frame.contentWindow!,'postMessage');
 const receive=(data:unknown,origin='http://127.0.0.1:4319',source:Window|null=frame.contentWindow)=>act(()=>window.dispatchEvent(new MessageEvent('message',{data,origin,source})));
 receive({v:1,type:'ready'});
 return {...view,frame,post,receive};
}
describe('isolated Python protocol', () => {
 it('rejects messages from another origin or window', () => {
  const {result} = renderHook(usePython);
  act(() => window.dispatchEvent(new MessageEvent('message', {origin:'https://evil.test',data:{v:1,type:'ready'}})));
  expect(result.current.ready).toBe(false);
  act(() => window.dispatchEvent(new MessageEvent('message', {origin:'http://127.0.0.1:4319',data:{v:1,type:'ready'}})));
  expect(result.current.ready).toBe(false);
 });
 it('refuses to run until the isolated frame is ready', () => {
  const {result} = renderHook(usePython);act(() => result.current.run('print(1)'));
  expect(result.current.output).toMatch(/not ready/i);expect(result.current.running).toBe(false);
 });
 it('accepts only active-id output from the exact runner and bounds output',()=>{
  const {result,post,receive,frame}=setup();
  act(()=>result.current.run('print(1)'));const id=post.mock.calls[0][0].id;
  expect(post).toHaveBeenCalledWith({v:1,type:'run',id,code:'print(1)'},'http://127.0.0.1:4319');
  receive({v:1,type:'output',id:'wrong',text:'intrusion'});
  receive({v:1,type:'output',id,text:'intrusion'},'https://evil.test');
  receive({v:2,type:'output',id,text:'intrusion'});
  expect(result.current.output).toBe('');
  receive({v:1,type:'output',id,text:'1\n'});expect(result.current.output).toBe('1\n');
  receive({v:1,type:'output',id,text:'x'.repeat(100000)});expect(result.current.output).toHaveLength(65536);
  receive({v:1,type:'status',id,status:'done'});expect(result.current.success).toBe(true);expect(result.current.running).toBe(false);
  act(()=>result.current.clear());expect(result.current.output).toBe('');frame.remove();
 });
 it('cancels a run, ignores stale results, and handles terminal errors',()=>{
  const {result,post,receive,frame}=setup();act(()=>result.current.cancel());
  act(()=>result.current.run('while True: pass'));const id=post.mock.calls[0][0].id;
  act(()=>result.current.run('duplicate'));expect(post).toHaveBeenCalledTimes(1);
  act(()=>result.current.cancel());expect(result.current.output).toMatch(/cancelled/);
  receive({v:1,type:'status',id,status:'done'});expect(result.current.success).toBe(false);
  act(()=>result.current.run('raise Exception()'));const nextId=post.mock.calls[2][0].id;
  receive({v:1,type:'status',id:nextId,status:'error',message:'Python error'});expect(result.current.output).toContain('Python error');frame.remove();
 });
 it('rejects oversized code and resets a stalled runner',()=>{
  vi.useFakeTimers();const {result,post,frame}=setup();
  act(()=>result.current.run('x'.repeat(131073)));expect(result.current.output).toContain('128 KiB');expect(post).not.toHaveBeenCalled();
  act(()=>result.current.run('print(1)'));act(()=>vi.advanceTimersByTime(45000));
  expect(result.current.frameKey).toBe(1);expect(result.current.ready).toBe(false);expect(result.current.output).toContain('restarted');frame.remove();
 });
 it('reads only a loopback runner origin from metadata',()=>{
  const meta=document.createElement('meta');meta.name='studylab-runner-origin';
  meta.content='https://evil.test';document.head.replaceChildren(meta);expect(getRunnerOrigin()).toBe('http://127.0.0.1:4319');
  meta.content='http://127.0.0.1:4321';expect(getRunnerOrigin()).toBe('http://127.0.0.1:4321');
 });
});
