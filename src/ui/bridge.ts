import {type Bridge,type Snapshot,type Reply} from '../core/protocol';
import {emptyState} from '../core/model';
// Browser preview is deliberately read-only: no false promise of background reminders.
const preview:Snapshot={state:emptyState(),alert:null,desktop:false};
export const bridge:Bridge=window.overtime??{
 snapshot:async()=>preview,
 command:async()=>({snapshot:preview,error:'실제 설정과 알림은 Windows 설치 앱에서 사용할 수 있어요.'} satisfies Reply),
 subscribe:()=>()=>{},onNavigate:()=>()=>{}
};
