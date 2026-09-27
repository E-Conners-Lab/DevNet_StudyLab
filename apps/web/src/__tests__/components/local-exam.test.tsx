import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Exam from '@/app/dashboard/practice/exam/page';
import { TimerDisplay, MultipleSelectInput, DragDropInput, FillBlankInput, ResultsView, type ExamQuestion } from '@/app/dashboard/practice/exam/exam-ui';
import { resetStudyProgress,getStudySnapshot } from '@/lib/local/store';
const nav=vi.hoisted(()=>({push:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:nav.push}),useSearchParams:()=>new URLSearchParams('examId=sample-exam-1')}));
class ResizeObserverMock {observe(){} unobserve(){} disconnect(){}}
const memory = new Map<string,string>();
const storage = {getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>{memory.set(key,value);}};
beforeEach(()=>{vi.stubGlobal('ResizeObserver',ResizeObserverMock);Object.defineProperty(window,'localStorage',{configurable:true,value:storage});resetStudyProgress();});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const question:ExamQuestion={id:'q1',type:'multiple_select',text:'Choose',objective:'1.1',difficulty:'easy',options:['First','Second']};
describe('exam study flow',()=>{
 it('answers, flags, navigates and grades an exam into local history',async()=>{
  render(<Exam/>);
  const answer=await screen.findAllByRole('radio');fireEvent.click(answer[0]);
  fireEvent.click(screen.getByRole('button',{name:/Flag/}));
  fireEvent.click(screen.getByRole('button',{name:'Next'}));
  expect(screen.getByText('Question 2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Previous'}));
  expect(screen.getByText('Question 1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Submit Exam'}));
  expect(await screen.findByText('Question Review')).toBeInTheDocument();
  expect(getStudySnapshot().state.examAttempts).toHaveLength(1);
  fireEvent.click(screen.getByRole('button',{name:'Back to Practice'}));
  expect(nav.push).toHaveBeenCalledWith('/dashboard/practice');
 // Keep the complete bundled exam and its review; allow for CI coverage overhead.
 },15_000);
 it('handles multiple select toggles by pointer and keyboard',()=>{
  const change=vi.fn();const view=render(<MultipleSelectInput question={question} value={[]} onChange={change}/>);
  fireEvent.click(screen.getByRole('button',{name:/First/}));expect(change).toHaveBeenLastCalledWith(['A']);
  view.rerender(<MultipleSelectInput question={question} value={['A']} onChange={change}/>);
  fireEvent.keyDown(screen.getByRole('button',{name:/First/}),{key:'Enter'});expect(change).toHaveBeenLastCalledWith([]);
  view.rerender(<MultipleSelectInput question={question} value={['A']} onChange={change} disabled/>);
  fireEvent.click(screen.getByRole('button',{name:/Second/}));expect(change).toHaveBeenCalledTimes(2);
 });
 it('reorders answers without mutating the original options',()=>{
  const change=vi.fn();render(<DragDropInput question={question} value={[]} onChange={change}/>);
  expect(screen.getByRole('button',{name:'Move First up'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Move First down'}));expect(change).toHaveBeenLastCalledWith(['Second','First']);
  fireEvent.click(screen.getByRole('button',{name:'Move Second up'}));expect(change).toHaveBeenLastCalledWith(['Second','First']);
  expect(question.options).toEqual(['First','Second']);
 });
 it('records typed answers and renders timer warning ranges',()=>{
  const change=vi.fn();const view=render(<FillBlankInput value="" onChange={change}/>);
  fireEvent.change(screen.getByPlaceholderText('Type your answer...'),{target:{value:'JSON'}});expect(change).toHaveBeenCalledWith('JSON');
  view.rerender(<TimerDisplay timeLeft={601}/>);expect(screen.getByText('10:01')).toBeInTheDocument();
  view.rerender(<TimerDisplay timeLeft={301}/>);expect(screen.getByText('5:01')).toBeInTheDocument();
  view.rerender(<TimerDisplay timeLeft={5}/>);expect(screen.getByText('0:05')).toBeInTheDocument();
 });
 it('shows passing results and array answers with explanations',()=>{
  render(<ResultsView examData={{id:"example",title:"Example exam",timeLimit:30,questions:[question]}} results={{score:100,totalCorrect:1,totalQuestions:1,passed:true,domainBreakdown:[{domain:'Software',correct:1,total:1,percentage:100}],questionResults:[{questionId:'q1',text:'Example',userAnswer:['A','B'],correctAnswer:['A','B'],correct:true,explanation:'Both apply'}]}} onBack={()=>{}}/>);
  expect(screen.getByText('Both apply')).toBeInTheDocument();
  expect(screen.getAllByText('A, B').length).toBeGreaterThan(0);
 });
});
