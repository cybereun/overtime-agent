export type Range = { start: number; end: number };
export type Workday = { date: string; ranges: Range[]; exclusions: Range[] };
export type Slot = Range & { id: string; workDate: string; remindAt: number };
export type RecordEntry = { status: 'done' | 'reason'; reason?: string; updatedAt: number };
export type State = {
  version: 1; days: Workday[]; records: Record<string, RecordEntry>;
  deliveries: Record<string, number>; snoozes: Record<string, number>;
  settings: { nextDayMinute: number; sound: boolean; autoStart: boolean; onboarded: boolean };
};
export type Proposal =
 | {kind:'register';date:string;ranges:Range[]}
 | {kind:'exclude';date:string;range:Range}
 | {kind:'changeEnd';date:string;end:number}
 | {kind:'cancel';date:string}
 | {kind:'settings';minute:number};
export type AlertEvent = { id: string; kind:'hourly'|'followup'|'recovery'|'test'; slotIds:string[]; title:string; body:string };
export const MINUTE=60_000;
export const emptyState=():State=>({version:1,days:[],records:{},deliveries:{},snoozes:{},settings:{nextDayMinute:540,sound:true,autoStart:false,onboarded:false}});
export const dayKey=(time:number=Date.now())=>new Date(time+9*3600_000).toISOString().slice(0,10);
export const stamp=(date:string,minute=0)=>Date.parse(`${date}T00:00:00+09:00`)+minute*MINUTE;
export const addDay=(date:string,n=1)=>dayKey(stamp(date)+n*86400_000);
export const timeText=(time:number)=>new Date(time+9*3600_000).toISOString().slice(11,16);
export const rangeText=(r:Range)=>`${timeText(r.start)}~${dayKey(r.start)!==dayKey(r.end)?'다음 날 ':''}${timeText(r.end)}`;
export function validDate(date:string) { const n=stamp(date);return /^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(n)&&dayKey(n)===date; }
export function mergeRanges(ranges:Range[]):Range[] {
 const out:Range[]=[];
 for(const r of [...ranges].sort((a,b)=>a.start-b.start)) {
  if(!Number.isFinite(r.start)||!Number.isFinite(r.end)||r.end<=r.start)throw new Error('시작·종료 시간을 확인해 주세요.');
  const last=out.at(-1);if(last&&r.start<=last.end) last.end=Math.max(last.end,r.end);else out.push({...r});
 } return out;
}
export function subtractRanges(ranges:Range[],exclusions:Range[]):Range[] {
 let out=mergeRanges(ranges);
 for(const x of mergeRanges(exclusions))out=out.flatMap(r=> x.end<=r.start||x.start>=r.end?[r]:[{start:r.start,end:Math.min(r.end,x.start)},{start:Math.max(r.start,x.end),end:r.end}].filter(a=>a.end>a.start));
 return out;
}
export function getSlots(state:State):Slot[] {
 // Overlapping registrations across calendar days also form a single timeline.
 const active=state.days.flatMap(d=>subtractRanges(d.ranges,d.exclusions));
 const slots:Slot[]=[];
 for(const r of mergeRanges(active))for(let start=r.start;start<r.end;start+=60*MINUTE){const end=Math.min(start+60*MINUTE,r.end);slots.push({id:`${start}-${end}`,start,end,remindAt:start+(end-start)/2,workDate:dayKey(start)});}
 return slots;
}
export function applyProposal(state:State,proposal:Proposal):State {
 const s=structuredClone(state);
 if(proposal.kind==='settings') { if(!Number.isInteger(proposal.minute)||proposal.minute<0||proposal.minute>=1440)throw new Error('알림 시각이 올바르지 않습니다.');s.settings.nextDayMinute=proposal.minute;return s; }
 if(!validDate(proposal.date))throw new Error('날짜를 확인해 주세요.');
 const day=s.days.find(d=>d.date===proposal.date);
 if(proposal.kind==='cancel')s.days=s.days.filter(d=>d.date!==proposal.date);
 else if(proposal.kind==='register') {
  if(!proposal.ranges.length)throw new Error('근무 시간을 입력해 주세요.');
  for(const r of proposal.ranges)if(r.start<stamp(proposal.date)||r.start>=stamp(proposal.date)+86400_000||r.end-r.start>86400_000)throw new Error('근무 구간은 시작일부터 최대 24시간까지 가능합니다.');
  if(day)day.ranges=mergeRanges([...day.ranges,...proposal.ranges]);else s.days.push({date:proposal.date,ranges:mergeRanges(proposal.ranges),exclusions:[]});
 } else if(!day)throw new Error('해당 날짜에 등록된 초과근무가 없습니다.');
 else if(proposal.kind==='exclude') {
  if(!day.ranges.some(r=>proposal.range.start>=r.start&&proposal.range.end<=r.end))throw new Error('제외 시간은 등록된 근무 구간 안에 있어야 합니다.');
  day.exclusions=mergeRanges([...day.exclusions,proposal.range]);
 } else {
  if(day.ranges.length!==1)throw new Error('복수 구간은 근무 카드의 수정 버튼으로 바꿔 주세요.');
  if(!Number.isFinite(proposal.end)||proposal.end<=day.ranges[0].start||proposal.end-day.ranges[0].start>86400_000)throw new Error('종료 시간은 시작 이후 24시간 이내여야 합니다.');
  day.ranges[0].end=proposal.end; day.exclusions=day.exclusions.map(x=>({start:x.start,end:Math.min(x.end,proposal.end)})).filter(x=>x.end>x.start);
 }
 s.days.sort((a,b)=>a.date.localeCompare(b.date));
 const ids=new Set(getSlots(s).map(x=>x.id));
 for(const key of Object.keys(s.records))if(!ids.has(key))delete s.records[key];
 for(const key of Object.keys(s.snoozes))if(!ids.has(key))delete s.snoozes[key];
 return s;
}
export function proposalText(p:Proposal):string {
 if(p.kind==='settings')return `다음 날 확인 알림을 ${String(Math.floor(p.minute/60)).padStart(2,'0')}:${String(p.minute%60).padStart(2,'0')}로 변경할까요?`;
 if(p.kind==='cancel')return `${p.date} 초과근무와 예약 알림을 취소할까요?`;
 if(p.kind==='exclude')return `${p.date} ${rangeText(p.range)}를 근무에서 제외할까요?`;
 if(p.kind==='changeEnd')return `${p.date} 종료 시간을 ${timeText(p.end)}로 바꿀까요?`;
 return `${p.date} ${p.ranges.map(rangeText).join(', ')} 초과근무를 등록할까요?`;
}
