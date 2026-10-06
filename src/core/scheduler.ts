import {type State,type AlertEvent,type Slot,getSlots,stamp,addDay,rangeText} from './model';
export const pending=(s:State,id:string)=>!s.records[id];
export function collectDue(state:State,now:number,recover=false):AlertEvent[] {
 const slots=getSlots(state).filter(x=>pending(state,x.id));
 const due:{key:string;at:number;slots:Slot[];kind:'hourly'|'followup'}[]=[];
 for(const slot of slots){
  const at=state.snoozes[slot.id]??slot.remindAt;
  const key=state.snoozes[slot.id]?`snooze:${slot.id}:${at}`:`hourly:${slot.id}`;
  if(at<=now&&!state.deliveries[key])due.push({key,at,slots:[slot],kind:'hourly'});
 }
 const dates=new Set(slots.map(x=>x.workDate));
 for(const date of dates){
  const key=`followup:${date}`;const at=stamp(addDay(date),state.settings.nextDayMinute);
  if(at<=now&&!state.deliveries[key])due.push({key,at,slots:slots.filter(x=>x.workDate===date),kind:'followup'});
 }
 if(!due.length)return [];
 for(const d of due){state.deliveries[d.key]=now;for(const slot of d.slots)if(d.kind==='hourly')delete state.snoozes[slot.id];}
 const ids=[...new Set(due.flatMap(d=>d.slots.map(x=>x.id)))];
 if(recover||due.length>1||due.some(d=>now-d.at>60_000))return [{id:`recovery:${now}`,kind:'recovery',slotIds:ids,title:'놓친 확인을 모아봤어요',body:`확인이 필요한 초과근무 ${ids.length}구간이 있어요. 기록을 확인해 주세요.`}];
 const d=due[0];return [{id:d.key,kind:d.kind,slotIds:ids,title:d.kind==='followup'?'어제 초과근무, 확인하셨나요?':'초과근무 확인할 시간이에요',body:d.kind==='followup'?`미확인 ${ids.length}구간이 있어요. 완료하거나 사유를 남겨 주세요.`:`${rangeText(d.slots[0])} · 인사랑 확인 후 완료를 눌러 주세요.`}];
}
