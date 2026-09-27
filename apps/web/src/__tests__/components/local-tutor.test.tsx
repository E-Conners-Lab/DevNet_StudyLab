import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Tutor from '@/app/dashboard/tutor/page';
const network=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/lib/local/client',async importOriginal=>{const actual=await importOriginal<typeof import('@/lib/local/client')>();const store=await import('@/lib/local/store');return {...actual,localFetch:actual.createLocalFetch(store.createStudyStore(()=>({getItem:()=>null,setItem:()=>{}})),network.fetch)};});
class ResizeObserverMock {observe(){} unobserve(){} disconnect(){}}
beforeEach(()=>{vi.stubGlobal('ResizeObserver',ResizeObserverMock);Element.prototype.scrollIntoView=vi.fn();network.fetch.mockReset();network.fetch.mockImplementation(async (url:string)=>url.endsWith('/session')?Response.json({csrfToken:'csrf',aiConfigured:true}):new Response('A REST API uses HTTP methods.'));});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('optional BYOK tutor',()=>{
 it('shows privacy/setup notice and sends a selected prompt through the local bridge',async()=>{
  render(<Tutor/>);
  expect(screen.getByText(/Messages are sent to Anthropic/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:/Explain REST API authentication methods/}));
  const input=screen.getByRole('textbox',{name:'Message to AI tutor'});
  expect(input).toHaveValue('Explain REST API authentication methods');
  fireEvent.keyDown(input,{key:'Enter'});
  expect(await screen.findByText('A REST API uses HTTP methods.')).toBeInTheDocument();
  expect(network.fetch).toHaveBeenCalledWith('/api/v1/tutor',expect.objectContaining({method:'POST'}));
  fireEvent.click(screen.getByRole('button',{name:'New Chat'}));
  expect(screen.getByText('Automation AI Tutor')).toBeInTheDocument();
 });
 it('shows an actionable error when no key is configured',async()=>{
  network.fetch.mockImplementation(async(url:string)=>url.endsWith('/session')?Response.json({csrfToken:'csrf',aiConfigured:false}):Response.json({error:'AI tutor not configured. Set ANTHROPIC_API_KEY in your launcher environment.'},{status:503}));
  render(<Tutor/>);
  fireEvent.change(screen.getByRole('textbox',{name:'Message to AI tutor'}),{target:{value:'Explain JSON'}});
  fireEvent.click(screen.getByRole('button',{name:'Send message'}));
  expect(await screen.findByText(/not configured|ANTHROPIC_API_KEY|not enabled/i)).toBeInTheDocument();
 });
});
