import {act,renderHook} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import {useStudyStore} from "./use-study";
import {studyStore} from "./store";
afterEach(()=>vi.unstubAllGlobals());
it("notifies visible study UI about saved progress and recoverable storage failures",()=>{
 let values:Record<string,string>={};const setItem=vi.fn((key:string,value:string)=>{values={...values,[key]:value};});
 vi.stubGlobal("localStorage",{getItem:(key:string)=>values[key]??null,setItem});
 const {result,unmount}=renderHook(()=>useStudyStore());
 act(()=>studyStore.setObjective("1.1",true));expect(result.current.state.objectives).toEqual(["1.1"]);expect(result.current.error).toBeNull();
 setItem.mockImplementationOnce(()=>{throw new Error("quota");});act(()=>{expect(()=>studyStore.setObjective("1.2",true)).toThrow();});
 expect(result.current.error).toMatch(/could not be saved/i);expect(result.current.state.objectives).toEqual(["1.1","1.2"]);unmount();
});
