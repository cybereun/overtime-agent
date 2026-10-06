import { describe, it, expect } from 'vitest';
import { emptyState, applyProposal, getSlots, stamp, dayKey } from '../src/core/model';
import { parseCommand } from '../src/core/parser';
import { collectDue } from '../src/core/scheduler';

const date = '2026-10-07';
const register = (ranges: [number, number][]) => applyProposal(emptyState(), {kind:'register', date, ranges: ranges.map(([a,b])=>({start:stamp(date,a),end:stamp(date,b)}))});
describe('근무 구간', () => {
  it('18~21시 midpoint', () => { const s=getSlots(register([[1080,1260]])); expect(s.map(x=>dayKey(x.start))).toEqual([date,date,date]); expect(s.map(x=>x.remindAt)).toEqual([1110,1170,1230].map(x=>stamp(date,x))); });
  it('마지막 부분과 자정 넘김',()=> { const s=getSlots(register([[1380,1510]])); expect(s.map(x=>(x.end-x.start)/60000)).toEqual([60,60,10]); expect(dayKey(s[1].start)).toBe('2026-10-08'); });
  it('겹치는 시간 합침',()=>expect(getSlots(register([[1080,1200],[1140,1260]])).length).toBe(3));
  it('제외 후 다시 분할, unchanged completion retained',()=> {let s=register([[1080,1260]]); const id=getSlots(s)[0].id; s.records[id]={status:'done',updatedAt:1}; s=applyProposal(s,{kind:'exclude',date,range:{start:stamp(date,1140),end:stamp(date,1170)}}); const slots=getSlots(s); expect(slots.map(x=>(x.end-x.start)/60000)).toEqual([60,60,30]); expect(s.records[id].status).toBe('done');});
});
describe('대화 해석',()=> {
  const parse=(text:string,s=emptyState())=>parseCommand(text,date,s);
  it('explicit Korean PM inherited',()=> {const p=parse('오늘 오후 6시부터 9시까지 초과근무'); expect(p.kind).toBe('proposal'); if(p.kind==='proposal'&&p.proposal.kind==='register') expect(p.proposal.ranges).toEqual([{start:stamp(date,1080),end:stamp(date,1260)}]);});
  it('24-hour',()=>expect(parse('오늘 18시부터 21시까지').kind).toBe('proposal'));
  it('explicit 24-hour clock on edit screen',()=> {expect(parse('06:00~09:00').kind).toBe('proposal');expect(parse('18:00~21:00').kind).toBe('proposal');});
  it('ambiguous short hours clarified',()=>expect(parse('내일 6~9시, 18~22시').kind).toBe('clarify'));
  it('morning plus explicit evening',()=> {const p=parse('내일 오전 6~9시, 18~22시'); expect(p.kind).toBe('proposal'); if(p.kind==='proposal'&&p.proposal.kind==='register') expect(p.proposal.ranges.length).toBe(2);});
  it('meal exclusion',()=> {const p=parse('오늘 저녁 7시에 식사 30분 제외',register([[1080,1260]])); expect(p.kind).toBe('proposal'); if(p.kind==='proposal'&&p.proposal.kind==='exclude') expect(p.proposal.range).toEqual({start:stamp(date,1140),end:stamp(date,1170)});});
  it('change end / cancel / next-day time',()=> {const s=register([[1080,1260]]); expect(parse('오늘 종료 시간을 22시로 바꿔',s).kind).toBe('proposal'); expect(parse('내일 알림 취소').kind).toBe('proposal'); const p=parse('다음 날 확인 알림을 오전 10시로 바꿔'); expect(p.kind).toBe('proposal'); if(p.kind==='proposal')expect(p.proposal).toEqual({kind:'settings',minute:600});});
  it('invalid hours and date rejected',()=> {expect(parse('오늘 25~26시').kind).toBe('error');expect(parse('2026-02-30 18~21시').kind).toBe('error');});
  it('overnight explicit hours',()=> {const p=parse('오늘 23시부터 다음 날 오전 2시까지');expect(p.kind).toBe('proposal');if(p.kind==='proposal'&&p.proposal.kind==='register')expect(p.proposal.ranges[0].end).toBe(stamp(date,1560));});
});
describe('예약',()=> {
 it('due once and completion suppressed',()=> {const s=register([[1080,1260]]);const now=stamp(date,1110);expect(collectDue(s,now,false).length).toBe(1);expect(collectDue(s,now,false).length).toBe(0);s.records[getSlots(s)[1].id]={status:'done',updatedAt:now};expect(collectDue(s,stamp(date,1170),false).length).toBe(0);});
 it('missed reminders recovered into one',()=> {const s=register([[1080,1260]]);const events=collectDue(s,stamp(date,1280),true);expect(events.length).toBe(1);expect(events[0].kind).toBe('recovery');expect(events[0].slotIds.length).toBe(3);expect(collectDue(s,stamp(date,1280),true)).toEqual([]);});
 it('next morning pending only and once',()=> {const s=register([[1080,1260]]);collectDue(s,stamp(date,1280),true);const slots=getSlots(s);s.records[slots[0].id]={status:'done',updatedAt:1};s.records[slots[1].id]={status:'reason',reason:'외근',updatedAt:1};const now=stamp('2026-10-08',540);const e=collectDue(s,now,false);expect(e.length).toBe(1);expect(e[0].kind).toBe('followup');expect(e[0].slotIds).toEqual([slots[2].id]);expect(collectDue(s,now,false)).toEqual([]);});
 it('snooze survives restart and disappears after cancel',()=> {let s=register([[1080,1140]]);const id=getSlots(s)[0].id;collectDue(s,stamp(date,1110),false);s.snoozes[id]=stamp(date,1120);expect(collectDue(s,stamp(date,1115),true)).toEqual([]);expect(collectDue(s,stamp(date,1120),false).length).toBe(1);s=applyProposal(s,{kind:'cancel',date});expect(collectDue(s,stamp('2026-10-08',540),true)).toEqual([]);});
 it('no next-day alert if all resolved',()=> {const s=register([[1080,1140]]);s.records[getSlots(s)[0].id]={status:'done',updatedAt:1};expect(collectDue(s,stamp('2026-10-08',540),true)).toEqual([]);});
});
