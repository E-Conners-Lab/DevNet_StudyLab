import { cleanup,fireEvent,render,screen } from '@testing-library/react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {TutorSidebar} from '@/components/tutor/tutor-sidebar';
class ResizeObserverMock {observe(){} unobserve(){} disconnect(){}}
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('temporary tutor history',()=>{
 it('shows age/domain context and supports selection and deletion without exposing credentials',()=>{
  vi.stubGlobal('ResizeObserver',ResizeObserverMock);const select=vi.fn(),remove=vi.fn(),newChat=vi.fn();
  const conversations=[0,600000,7200000,172800000,864000000].map((age,index)=>({id:String(index),title:'Chat '+index,domain:index===0?'apis':null,messages:[],timestamp:new Date(Date.now()-age)}));
  render(<TutorSidebar conversations={conversations} activeConversationId="0" filterDomain="apis" onFilterDomain={()=>{}} onNewChat={newChat} onSelectConversation={select} onDeleteConversation={remove}/>);
  expect(screen.getByText('Just now')).toBeInTheDocument();expect(screen.getByText('10m ago')).toBeInTheDocument();expect(screen.getByText('2h ago')).toBeInTheDocument();expect(screen.getByText('2d ago')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Chat 0'));expect(select).toHaveBeenCalledWith(conversations[0]);
  fireEvent.keyDown(screen.getByText('Chat 1').closest('[role=button]')!,{key:'Enter'});expect(select).toHaveBeenLastCalledWith(conversations[1]);
  fireEvent.click(screen.getByRole('button',{name:'Delete conversation: Chat 1'}));expect(remove).toHaveBeenCalledWith('1',expect.anything());
  fireEvent.click(screen.getByRole('button',{name:'New Chat'}));expect(newChat).toHaveBeenCalledOnce();
 });
});
