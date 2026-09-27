import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';
import DashboardLayout from '@/app/dashboard/layout';
import StudyPage,{generateStaticParams as studyParams} from '@/app/dashboard/study/[slug]/page';
import LabPage,{generateStaticParams as labParams} from '@/app/dashboard/labs/[slug]/page';
import {StorageNotice} from '@/components/dashboard/storage-notice';
import {Sidebar} from '@/components/dashboard/sidebar';
import {ReviewComplete} from '@/components/flashcards/review-complete';
const nav=vi.hoisted(()=>({replace:vi.fn()}));const snapshot=vi.hoisted(()=>({error:null as string|null}));
vi.mock('next/navigation',()=>({useRouter:()=>nav,usePathname:()=>'/dashboard/study'}));
vi.mock('@/lib/local/use-study',()=>({useStudyStore:()=>snapshot}));
vi.mock('@/app/dashboard/study/[slug]/study-client',()=>({default:()=> <div>Study client</div>}));
vi.mock('@/app/dashboard/labs/[slug]/lab-client',()=>({default:()=> <div>Lab client</div>}));
class ResizeObserverMock {observe(){} unobserve(){} disconnect(){}}
afterEach(()=>{cleanup();vi.unstubAllGlobals();snapshot.error=null;});
describe('local shell',()=>{
 it('links and navigates the entry point to study dashboard',()=>{render(<Home/>);expect(nav.replace).toHaveBeenCalledWith('/dashboard');expect(screen.getByRole('link')).toHaveAttribute('href','/dashboard');});
 it('exports every canonical lab and study route',()=>{expect(studyParams()).toHaveLength(6);expect(labParams()).toHaveLength(7);render(<><StudyPage/><LabPage/></>);expect(screen.getByText('Study client')).toBeInTheDocument();expect(screen.getByText('Lab client')).toBeInTheDocument();});
 it('shows local learner and navigation without account actions',()=>{render(<Sidebar pathname="/dashboard/settings"/>);expect(screen.getByText('Local learner')).toBeInTheDocument();expect(screen.getByRole('link',{name:'Settings'})).toHaveAttribute('href','/dashboard/settings');expect(screen.queryByText('Sign out')).not.toBeInTheDocument();});
 it('renders storage failures with backup recovery navigation',()=>{const view=render(<StorageNotice/>);expect(screen.queryByRole('alert')).not.toBeInTheDocument();snapshot.error='Storage is full';view.rerender(<StorageNotice/>);expect(screen.getByRole('alert')).toHaveTextContent('Storage is full');expect(screen.getByRole('link')).toHaveAttribute('href','/dashboard/settings');});
 it('opens mobile navigation while preserving page content',()=>{vi.stubGlobal('ResizeObserver',ResizeObserverMock);render(<DashboardLayout><h1>Study content</h1></DashboardLayout>);fireEvent.click(screen.getByRole('button',{name:'Open menu'}));expect(screen.getByRole('dialog')).toBeInTheDocument();expect(screen.getByText('Study content')).toBeInTheDocument();});
 it('summarizes completed flashcard sessions and offers return to library',()=>{const done=vi.fn();render(<ReviewComplete dueCardsCount={3} sessionStats={{cardsReviewed:2,correctCount:1,incorrectCount:1,nextReviewTime:new Date().toISOString()}} onEndReview={done} onStartReview={done}/>);expect(screen.getByText('50%')).toBeInTheDocument();fireEvent.click(screen.getAllByRole('button')[0]);expect(done).toHaveBeenCalledOnce();});
});
