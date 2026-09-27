import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import Settings from '@/app/dashboard/settings/page';
import { exportStudyProgress, importStudyProgress, resetStudyProgress } from '@/lib/local/store';
vi.mock('@/lib/local/store', () => ({ exportStudyProgress: vi.fn(() => '{}'), importStudyProgress: vi.fn(), resetStudyProgress: vi.fn() }));
beforeEach(()=>vi.clearAllMocks());
afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe('local settings', () => {
 it('explains local storage and optional server-held credentials without account UI', () => {
  render(<Settings />);
  expect(screen.getByText(/TUTOR_ANTHROPIC_KEY and TUTOR_MODEL/)).toBeInTheDocument();
  expect(screen.getByText(/browser profile/i)).toBeInTheDocument();
  expect(screen.queryByText(/Sign Out/i)).not.toBeInTheDocument();
 });
 it('requires explicit confirmation before clearing progress', () => {
  render(<Settings />);
  fireEvent.click(screen.getByRole('button', {name:'Reset progress'}));
  fireEvent.click(screen.getByRole('button', {name:'Cancel'}));
  expect(resetStudyProgress).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name:'Reset progress'}));
  fireEvent.click(screen.getByRole('button', {name:'Delete local progress'}));
  expect(resetStudyProgress).toHaveBeenCalledOnce();
  expect(screen.getByRole('status')).toHaveTextContent('Local progress reset');
 });
 it('exports progress as a downloadable backup',()=>{
  const create=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:test');
  vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
  render(<Settings/>);fireEvent.click(screen.getByRole('button',{name:'Export progress'}));
  expect(exportStudyProgress).toHaveBeenCalledOnce();expect(create).toHaveBeenCalledOnce();
  expect(screen.getByRole('status')).toHaveTextContent('Backup downloaded');
 });
 it('reads a backup but only replaces progress after explicit confirmation',async()=>{
  render(<Settings/>);
  const file={size:2,text:async()=>'{}'};
  fireEvent.change(screen.getByLabelText('Import progress backup'),{target:{files:[file]}});
  fireEvent.click(await screen.findByRole('button',{name:'Replace progress with backup'}));
  expect(importStudyProgress).toHaveBeenCalledWith('{}');
  expect(screen.getByRole('status')).toHaveTextContent('Backup restored');
 });
 it('can cancel import and reports oversized or unreadable files',async()=>{
  render(<Settings/>);const input=screen.getByLabelText('Import progress backup');
  fireEvent.change(input,{target:{files:[{size:2,text:async()=>'{}'}]}});
  fireEvent.click(await screen.findByRole('button',{name:'Cancel import'}));
  expect(importStudyProgress).not.toHaveBeenCalled();
  fireEvent.change(input,{target:{files:[{size:3*1024*1024}]}});
  expect(screen.getByRole('status')).toHaveTextContent('2 MiB');
  fireEvent.change(input,{target:{files:[{size:1,text:async()=>{throw new Error('read')}}]}});
  await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Could not read'));
  fireEvent.change(input,{target:{files:[]}});
 });
 it('shows validation and persistence errors instead of claiming success',()=>{
  vi.mocked(resetStudyProgress).mockImplementationOnce(()=>{throw new Error('Storage unavailable');});
  render(<Settings/>);fireEvent.click(screen.getByRole('button',{name:'Reset progress'}));
  fireEvent.click(screen.getByRole('button',{name:'Delete local progress'}));
  expect(screen.getByRole('status')).toHaveTextContent('Storage unavailable');
 });
});
