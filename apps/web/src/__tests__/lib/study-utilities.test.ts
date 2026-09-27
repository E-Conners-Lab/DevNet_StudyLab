import {afterEach,describe,expect,it,vi} from "vitest";
import {DEVNET_DOMAINS,getDomainBySlug,getDomainByNumber,domainSlugToNumber,domainNumberToSlug,getDomainSelectOptions,getDomainTabItems,SLUG_TO_STUDY_FILE,NUMBER_TO_SLUG} from "@/lib/domains";
import {getDifficultyClasses,getStatusBadge,formatRelativeDate} from "@/lib/ui-constants";
describe("study domain and review presentation",()=>{
 afterEach(()=>vi.useRealTimers());
 it("maps every curriculum domain consistently and rejects missing domains",()=>{
  expect(DEVNET_DOMAINS.reduce((sum,domain)=>sum+domain.weight,0)).toBe(100);
  for(const domain of DEVNET_DOMAINS){
   expect(getDomainBySlug(domain.slug)).toEqual(domain);expect(getDomainByNumber(domain.number)).toEqual(domain);
   expect(domainSlugToNumber(domain.slug)).toBe(domain.number);expect(domainNumberToSlug(domain.number)).toBe(domain.slug);
   expect(NUMBER_TO_SLUG[domain.number]).toBe(domain.slug);expect(SLUG_TO_STUDY_FILE[domain.slug]).toContain(domain.slug);
  }
  expect(getDomainBySlug(null)).toBeUndefined();expect(getDomainByNumber(null)).toBeUndefined();expect(domainSlugToNumber("unknown")).toBeNull();expect(domainNumberToSlug(99)).toBeNull();
  expect(getDomainSelectOptions()).toHaveLength(7);expect(getDomainSelectOptions(false)).toHaveLength(6);expect(getDomainTabItems()).toHaveLength(7);expect(getDomainTabItems(false)).toHaveLength(6);
 });
 it("distinguishes new, learning and mastered flashcards at the review threshold",()=>{
  expect(getStatusBadge(undefined,false).label).toBe("New");expect(getStatusBadge(undefined,true).label).toBe("Learning");expect(getStatusBadge(21,true).label).toBe("Learning");expect(getStatusBadge(22,true).label).toBe("Mastered");
  expect(getDifficultyClasses("easy")).toContain("emerald");expect(getDifficultyClasses("unknown")).toContain("zinc");
 });
 it("shows overdue, daily, weekly and monthly review dates",()=>{
  vi.useFakeTimers();const now=new Date("2026-09-27T12:00:00Z");vi.setSystemTime(now);
  const at=(days:number)=>new Date(now.getTime()+days*86400000).toISOString();
  expect(formatRelativeDate(at(-1))).toBe("Today");expect(formatRelativeDate(at(0))).toBe("Today");expect(formatRelativeDate(at(1))).toBe("Tomorrow");expect(formatRelativeDate(at(3))).toBe("In 3 days");expect(formatRelativeDate(at(7))).toBe("In 1 weeks");expect(formatRelativeDate(at(30))).toBe("In 1 months");
 });
});
