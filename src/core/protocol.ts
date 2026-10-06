import type { State, AlertEvent, Proposal } from './model';
import type { ParseResult } from './parser';
export type UpdateState={status:'disabled'|'idle'|'checking'|'current'|'available'|'downloading'|'ready'|'installing'|'error';currentVersion:string;version?:string;percent?:number;error?:string};
export type Snapshot={state:State;alert:AlertEvent|null;desktop:boolean;storageWarning?:string;update?:UpdateState};
export type Command=
 | {type:'interpret';text:string;date:string}
 | {type:'confirm';draftId:string}
 | {type:'discard';draftId:string}
 | {type:'record';ids:string[];status:'done'|'reason'|'pending';reason?:string}
 | {type:'replaceDay';date:string;ranges:{start:number;end:number}[]}
 | {type:'deleteDay';date:string}
 | {type:'settings';sound?:boolean;autoStart?:boolean;onboarded?:boolean;nextDayMinute?:number}
 | {type:'snooze';ids:string[]}
 | {type:'hidePopup'}|{type:'show';date?:string}|{type:'test'};
export type UpdateCommand={type:'checkUpdate'|'downloadUpdate'|'installUpdate'|'hideUpdate'};
export type Reply={snapshot:Snapshot;parsed?:ParseResult;draftId?:string;proposal?:Proposal;error?:string};
export type Bridge={snapshot:()=>Promise<Snapshot>;command:(command:Command|UpdateCommand)=>Promise<Reply>;subscribe:(callback:(snapshot:Snapshot)=>void)=>()=>void;onNavigate:(callback:(date:string)=>void)=>()=>void};
declare global {interface Window{overtime?:Bridge}}
