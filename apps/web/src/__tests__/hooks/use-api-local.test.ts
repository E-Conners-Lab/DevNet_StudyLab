import {act,renderHook,waitFor} from "@testing-library/react";
import {beforeEach,describe,expect,it,vi} from "vitest";
import {useApi} from "@/hooks/use-api";
const {fetchMock}=vi.hoisted(()=>({fetchMock:vi.fn()}));
vi.mock("@/lib/local/client",()=>({localFetch:fetchMock}));
describe("study resource loading",()=>{
 beforeEach(()=>{fetchMock.mockReset();vi.stubGlobal("fetch",fetchMock);});
 it("supports deferred loading, transforms and explicit retry after failure",async()=>{
  const {result,rerender}=renderHook(({skip})=>useApi<number>({url:"/api/flashcards",skip,transform:(data)=>(data as {total:number}).total}),{initialProps:{skip:true}});
  expect(result.current.isLoading).toBe(false);expect(fetchMock).not.toHaveBeenCalled();fetchMock.mockResolvedValueOnce(Response.json({error:"unavailable"},{status:503}));rerender({skip:false});
  await waitFor(()=>expect(result.current.error).toBe("HTTP 503"));fetchMock.mockResolvedValueOnce(Response.json({total:199}));await act(async()=>result.current.refetch());expect(result.current.data).toBe(199);expect(result.current.error).toBeNull();
 });
 it("returns raw payloads and handles unexpected rejection values",async()=>{
  fetchMock.mockResolvedValueOnce(Response.json({completed:["1.1"]}));const {result}=renderHook(()=>useApi({url:"/api/study/progress"}));await waitFor(()=>expect(result.current.data).toEqual({completed:["1.1"]}));
  fetchMock.mockRejectedValueOnce("unavailable");await act(async()=>result.current.refetch());expect(result.current.error).toBe("Fetch failed");expect(result.current.isLoading).toBe(false);
 });
});
