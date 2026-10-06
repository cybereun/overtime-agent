import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import {emptyState,validDate,getSlots,type State} from '../src/core/model';
const finite=z.number().finite();
const date=z.string().refine(validDate,'날짜가 올바르지 않습니다.');
const range=z.object({start:finite,end:finite}).strict().refine(r=>r.end>r.start&&r.end-r.start<=86400_000,'구간은 24시간 이내여야 합니다.');
const ids=z.array(z.string().max(80)).min(1).max(2000);
const settings=z.object({nextDayMinute:z.number().int().min(0).max(1439),sound:z.boolean(),autoStart:z.boolean(),onboarded:z.boolean()}).strict();
export const stateSchema=z.object({version:z.literal(1),days:z.array(z.object({date,ranges:z.array(range),exclusions:z.array(range)}).strict()).max(10000),records:z.record(z.string(),z.object({status:z.enum(['done','reason']),reason:z.string().max(500).optional(),updatedAt:finite}).strict()),deliveries:z.record(z.string(),finite),snoozes:z.record(z.string(),finite),settings}).strict();
export const commandSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('interpret'),text:z.string().max(1000),date}).strict(),
 z.object({type:z.literal('confirm'),draftId:z.string().max(100)}).strict(),
 z.object({type:z.literal('discard'),draftId:z.string().max(100)}).strict(),
 z.object({type:z.literal('record'),ids,status:z.enum(['done','reason','pending']),reason:z.string().trim().min(1).max(500).optional()}).strict(),
 z.object({type:z.literal('replaceDay'),date,ranges:z.array(range).min(1).max(24)}).strict(),
 z.object({type:z.literal('deleteDay'),date}).strict(),
 z.object({type:z.literal('settings'),sound:z.boolean().optional(),autoStart:z.boolean().optional(),onboarded:z.boolean().optional(),nextDayMinute:z.number().int().min(0).max(1439).optional()}).strict(),
 z.object({type:z.literal('snooze'),ids}).strict(),
 z.object({type:z.literal('hidePopup')}).strict(),z.object({type:z.literal('show'),date:date.optional()}).strict(),z.object({type:z.literal('test')}).strict(),
 z.object({type:z.literal('checkUpdate')}).strict(),z.object({type:z.literal('downloadUpdate')}).strict(),z.object({type:z.literal('installUpdate')}).strict(),z.object({type:z.literal('hideUpdate')}).strict()
]);
export class Store {
 readonly file:string; warning='';
 constructor(dir:string){fs.mkdirSync(dir,{recursive:true});this.file=path.join(dir,'overtime.json');}
 load():State {
  if(!fs.existsSync(this.file))return emptyState();
  try{return this.read(this.file);}catch{
   const preserved=`${this.file}.invalid-${Date.now()}`;fs.copyFileSync(this.file,preserved);
   try{const state=this.read(`${this.file}.bak`);this.warning='최근 저장 파일을 읽지 못해 이전 백업을 복구했습니다. 원본 파일은 보존했어요.';return state;}
   catch{this.warning='기록 파일을 읽지 못해 빈 상태로 시작합니다. 원본 파일은 앱 데이터 폴더에 보존했어요.';return emptyState();}
  }
 }
 private read(file:string):State {const state=stateSchema.parse(JSON.parse(fs.readFileSync(file,'utf8'))) as State;getSlots(state);return state;}
 save(state:State) {
  stateSchema.parse(state);
  const tmp=`${this.file}.tmp`;
  const fd=fs.openSync(tmp,'w');try{fs.writeFileSync(fd,JSON.stringify(state,null,2),'utf8');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  if(fs.existsSync(this.file))fs.copyFileSync(this.file,`${this.file}.bak`);
  fs.renameSync(tmp,this.file);
 }
}
