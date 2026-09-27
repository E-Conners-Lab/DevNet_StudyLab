import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from '@/app/dashboard/page';
import Study from '@/app/dashboard/study/page';
import Guide from '@/app/dashboard/study/[slug]/study-client';
import Labs from '@/app/dashboard/labs/page';
import Lab from '@/app/dashboard/labs/[slug]/lab-client';
import Practice from '@/app/dashboard/practice/page';
import Flashcards from '@/app/dashboard/flashcards/page';
import { resetStudyProgress, getStudySnapshot, importStudyProgress, exportStudyProgress } from '@/lib/local/store';
import { blueprint, flashcards, labs, studyGuides } from '@/lib/local/catalog';
const nav = vi.hoisted(() => ({slug:'python-data-parsing', push:vi.fn()}));
vi.mock('next/navigation',()=>({useParams:()=>({slug:nav.slug}),useRouter:()=>({push:nav.push}),useSearchParams:()=>new URLSearchParams()}));
class ResizeObserverMock {observe(){} unobserve(){} disconnect(){}}
const memory = new Map<string,string>();
const storage = {getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>{memory.set(key,value);}};
beforeEach(()=>{vi.stubGlobal('ResizeObserver',ResizeObserverMock);Object.defineProperty(window,'localStorage',{configurable:true,value:storage});resetStudyProgress();nav.push.mockClear();});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('self-contained learning pages',()=>{
 it('shows returning learner exam and lab progress rather than samples',async()=>{
  const state=JSON.parse(exportStudyProgress());const now=new Date().toISOString();
  state.objectives=['1.1'];state.labs={'python-data-parsing':{draft:'print(1)',completed:true,updatedAt:now},'git-basics':{draft:'print(2)',completed:false,updatedAt:now}};
  state.examAttempts=[{id:'11111111-1111-4111-8111-111111111111',examId:'sample-exam-1',score:80,totalQuestions:40,domainFilter:null,startedAt:new Date(Date.now()-7200000).toISOString(),completedAt:now},{id:'22222222-2222-4222-8222-222222222222',examId:'sample-exam-1',score:40,totalQuestions:10,domainFilter:'software-dev',startedAt:new Date(Date.now()-1200000).toISOString(),completedAt:now}];
  importStudyProgress(JSON.stringify(state));const view=render(<Dashboard/>);await waitFor(()=>expect(screen.getByText('80%')).toBeInTheDocument());view.unmount();
  const practice=render(<Practice/>);await waitFor(()=>expect(screen.getByText('2h 0m')).toBeInTheDocument());expect(screen.getByText('20m')).toBeInTheDocument();practice.unmount();
  render(<Labs/>);await waitFor(()=>expect(screen.getAllByRole('button',{name:'Continue'})).toHaveLength(1));
 });
 it('offers useful missing-guide and missing-lab messages',async()=>{nav.slug='missing';const view=render(<Guide/>);expect(await screen.findByText(/not found/)).toBeInTheDocument();view.unmount();render(<Lab/>);expect(await screen.findByText(/not found/)).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Back to Labs'}));expect(nav.push).toHaveBeenCalledWith('/dashboard/labs');});
 it('labels labs requiring host or network access as download-only',async()=>{nav.slug='rest-api-client';render(<Lab/>);expect(await screen.findByRole('button',{name:'Download-only lab'})).toBeDisabled();expect(screen.getByText(/Download-only exercise/)).toBeInTheDocument();});

 it('exposes every bundled objective for completion',()=>{
  render(<Study/>);
  for(const domain of blueprint.domains)fireEvent.click(screen.getByRole('button',{name:new RegExp(domain.name)}));
  expect(screen.getAllByRole('button',{name:/^Mark complete:/})).toHaveLength(blueprint.domains.reduce((total,domain)=>total+domain.objectives.length,0));
 });
 it('starts dashboard without fabricated accomplishments',async()=>{
  render(<Dashboard/>);
  expect(await screen.findByText('Curriculum Progress')).toBeInTheDocument();
  await waitFor(()=>expect(screen.getAllByText('0%').length).toBeGreaterThan(0));
  expect(screen.queryByText('7 days')).not.toBeInTheDocument();
  expect(screen.queryByText('85%')).not.toBeInTheDocument();
 });
 it('expands domains and persists completed objectives',async()=>{
  render(<Study/>);
  fireEvent.click(screen.getByRole('button',{name:/Software Development/}));
  fireEvent.click(screen.getByRole('button',{name:'Mark complete: 1.1'}));
  await waitFor(()=>expect(getStudySnapshot().state.objectives).toContain('1.1'));
  fireEvent.click(screen.getByRole('button',{name:'Mark incomplete: 1.1'}));
  await waitFor(()=>expect(getStudySnapshot().state.objectives).not.toContain('1.1'));
 });
 it('reads bundled study guides with collapsible topic details',async()=>{
  nav.slug=studyGuides[0].slug;render(<Guide/>);
  expect(await screen.findByRole('heading',{name:studyGuides[0].name})).toBeInTheDocument();
  const topic=studyGuides[0].keyTopics[0];
  expect(screen.getByText(topic.summary)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:new RegExp(topic.objectiveCode)}));
  expect(screen.queryByText(topic.summary)).not.toBeInTheDocument();
 });
 it('lists only unstarted labs for a new learner and routes to a lab',async()=>{
  render(<Labs/>);
  expect(screen.getByText('Python Data Parsing with JSON, XML & YAML')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button',{name:'Start'})[0]);
  expect(nav.push).toHaveBeenCalledWith(expect.stringContaining('/dashboard/labs/'));
 });
 it('initializes a lab with starter code, persists drafts, reveals solution, and marks completion',async()=>{
  nav.slug='python-data-parsing';render(<Lab/>);
  const editor=await screen.findByRole('textbox',{name:'Python code'});
  expect(editor).toHaveValue(labs.find(l=>l.slug===nav.slug)!.starterCode);
  fireEvent.change(editor,{target:{value:'print("local draft")'}});
  expect(getStudySnapshot().state.labs[nav.slug].draft).toBe('print("local draft")');
  fireEvent.click(screen.getByRole('button',{name:'Mark complete'}));
  expect(getStudySnapshot().state.labs[nav.slug].completed).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Show Solution'}));
  await waitFor(()=>expect(document.querySelector('pre.p-4')?.textContent).toBe(labs.find(l=>l.slug===nav.slug)!.solutionCode));
  fireEvent.click(screen.getByRole('button',{name:'Hide Solution'}));
  fireEvent.click(screen.getByRole('button',{name:'Reset'}));
  expect(editor).toHaveValue(labs.find(l=>l.slug===nav.slug)!.starterCode);
 });
 it('starts an exam without invented exam history',async()=>{
  render(<Practice/>);
  expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  expect(screen.queryByText('+5%')).not.toBeInTheDocument();
  expect(screen.queryByText('+10%')).not.toBeInTheDocument();
  expect(screen.queryByText('Feb 25, 2026')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:/Start Full Exam/}));
  expect(nav.push).toHaveBeenCalledWith(expect.stringContaining('examId=sample-exam-1'));
 });
 it('browses, searches, and reviews flashcards while persisting ratings',async()=>{
  render(<Flashcards/>);
  const search=await screen.findByPlaceholderText('Search cards...');
  fireEvent.change(search,{target:{value:'nomatchunlikely'}});
  expect(screen.getByText('No cards found matching your search.')).toBeInTheDocument();
  fireEvent.change(search,{target:{value:''}});
  fireEvent.click(screen.getByText(flashcards[0].question));
  expect(screen.getByText(flashcards[0].answer)).toBeInTheDocument();
  fireEvent.click(screen.getByText(flashcards[0].question));
  fireEvent.click(screen.getByRole('button',{name:/Start Review/}));
  fireEvent.keyDown(window,{code:'Space',key:' '});
  fireEvent.click(screen.getByRole('button',{name:/Good/}));
  expect(Object.keys(getStudySnapshot().state.flashcards)).toHaveLength(1);
 });
});
