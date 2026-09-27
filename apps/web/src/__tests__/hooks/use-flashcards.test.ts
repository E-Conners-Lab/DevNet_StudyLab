import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useFlashcards } from '@/hooks/use-flashcards';
import { resetStudyProgress,importStudyProgress,exportStudyProgress } from '@/lib/local/store';
import { flashcards } from '@/lib/local/catalog';
const memory = new Map<string,string>();
const storage = {getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>{memory.set(key,value);}};
beforeEach(()=>{Object.defineProperty(window,'localStorage',{configurable:true,value:storage});resetStudyProgress();});
afterEach(cleanup);
describe('flashcard learning sessions',()=>{
 it('classifies future, mastered and learning cards and supports navigation',async()=>{
  const future=new Date(Date.now()+86400000).toISOString(),last=new Date().toISOString();
  const state=JSON.parse(exportStudyProgress());state.flashcards={
    [flashcards[0].id]:{flashcardId:flashcards[0].id,repetitions:4,ease:2.5,interval:30,nextReview:future,lastReview:last,quality:5},
    [flashcards[1].id]:{flashcardId:flashcards[1].id,repetitions:1,ease:2.5,interval:1,nextReview:future,lastReview:last,quality:4}};
  importStudyProgress(JSON.stringify(state));const {result}=renderHook(useFlashcards);
  await waitFor(()=>expect(result.current.isLoading).toBe(false));
  expect(result.current.stats.mastered).toBe(1);expect(result.current.stats.learning).toBe(1);expect(result.current.dueCards).toHaveLength(flashcards.length-2);
  expect(result.current.getCardProgress('unknown')).toBeNull();
  expect(result.current.getCardProgress(flashcards[0].id)?.interval).toBe(30);
  act(()=>result.current.startReview(flashcards[0].domainSlug));expect(result.current.reviewQueue.every(card=>card.domainSlug===flashcards[0].domainSlug)).toBe(true);
  act(()=>result.current.nextCard());expect(result.current.reviewIndex).toBe(1);
  act(()=>result.current.prevCard());expect(result.current.reviewIndex).toBe(0);
  act(()=>result.current.rateCard(result.current.reviewCard!.id,0));expect(result.current.sessionStats.incorrectCount).toBe(1);
  act(()=>result.current.rateCard(result.current.reviewCard!.id,5));expect(result.current.sessionStats.correctCount).toBe(1);
  act(()=>result.current.endReview());expect(result.current.isReviewActive).toBe(false);
 });
 it('surfaces blocked storage while retaining exportable progress',async()=>{
  const {result}=renderHook(useFlashcards);await waitFor(()=>expect(result.current.isLoading).toBe(false));
  act(()=>result.current.startReview());
  Object.defineProperty(window,'localStorage',{configurable:true,value:{...storage,setItem:()=>{throw new Error('full');}}});
  act(()=>result.current.rateCard(result.current.reviewCard!.id,4));
  expect(result.current.error).toContain('could not be saved');expect(result.current.reviewIndex).toBe(0);
  expect(Object.keys(JSON.parse(exportStudyProgress()).flashcards)).toHaveLength(1);
 });
});
