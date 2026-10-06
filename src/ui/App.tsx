import {useEffect,useRef,useState,type FormEvent} from 'react';
import {bridge} from './bridge';
import {getSlots,dayKey,addDay,timeText,rangeText,proposalText,applyProposal,type Slot,type Proposal,type Workday} from '../core/model';
import type {Snapshot,Command} from '../core/protocol';
import type {ParseResult} from '../core/parser';

type Message={id:number;role:'agent'|'user';text:string;choices?:{label:string;text:string}[]};
type Draft={id:string;proposal:Proposal};
const initial:Message={id:0,role:'agent',text:'초과근무, 제가 챙겨드릴게요.\n날짜와 시간을 말해 주시면 한 시간마다 인사랑 확인을 알려드려요. 놓친 기록은 다음 날 다시 챙겨요.'};
export default function App(){
 const [snap,setSnap]=useState<Snapshot|null>(null),[fatal,setFatal]=useState('');
 useEffect(()=>{bridge.snapshot().then(setSnap).catch(()=>setFatal('앱 상태를 불러오지 못했어요. 앱을 다시 실행해 주세요.'));const off=bridge.subscribe(setSnap);return off;},[]);
 if(fatal)return <div className="loading">{fatal}</div>;
 if(!snap)return <div className="loading"><img src="./agent.svg" alt=""/>알림 친구를 깨우고 있어요…</div>;
 return new URLSearchParams(location.search).get('view')==='popup'?<Popup snap={snap} setSnap={setSnap}/>:<Chat snap={snap} setSnap={setSnap}/>;
}
function Chat({snap,setSnap}:{snap:Snapshot;setSnap:(s:Snapshot)=>void}){
 const [date,setDate]=useState(dayKey()),[input,setInput]=useState(''),[messages,setMessages]=useState<Message[]>([initial]);
 const [draft,setDraft]=useState<Draft|null>(null),[busy,setBusy]=useState(false),[settings,setSettings]=useState(false),[error,setError]=useState('');
 const [reasonId,setReasonId]=useState<string|null>(null),[reason,setReason]=useState(''),[editing,setEditing]=useState<Workday|null>(null),[editText,setEditText]=useState('');
 const [deleteDate,setDeleteDate]=useState<string|null>(null),[clock,setClock]=useState(Date.now());
 const sequence=useRef(1),chatEnd=useRef<HTMLDivElement>(null);
 const state=snap.state,day=state.days.find(x=>x.date===date);
 const allSlots=getSlots(state),slots=allSlots.filter(x=>x.workDate===date||day?.ranges.some(r=>x.start>=r.start&&x.start<r.end));
 const resolved=slots.filter(x=>state.records[x.id]).length;
 const next=allSlots.find(x=>!state.records[x.id]&&(state.snoozes[x.id]??x.remindAt)>clock);
 useEffect(()=>bridge.onNavigate(setDate),[]);
 useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),30000);return ()=>clearInterval(timer);},[]);
 useEffect(()=>{chatEnd.current?.scrollIntoView({behavior:'smooth',block:'nearest'});},[messages,draft]);
 const push=(role:'agent'|'user',text:string,choices?:Message['choices'])=>setMessages(m=>[...m.slice(-39),{id:sequence.current++,role,text,choices}]);
 async function act(command:Command){setError('');try{const reply=await bridge.command(command);setSnap(reply.snapshot);if(reply.error){setError(reply.error);return null;}return reply;}catch{setError('처리하지 못했어요. 다시 시도해 주세요.');return null;}}
 function parsedMessage(parsed:ParseResult){if(parsed.kind==='error')push('agent',parsed.message);else if(parsed.kind==='clarify')push('agent',parsed.message,parsed.choices);}
 async function send(text=input){if(!text.trim()||busy)return;setBusy(true);setInput('');push('user',text.trim());
  if(draft)await act({type:'discard',draftId:draft.id});setDraft(null);
  const reply=await act({type:'interpret',text:text.trim(),date});
  if(reply?.parsed){if(reply.parsed.kind==='proposal'&&reply.draftId)setDraft({id:reply.draftId,proposal:reply.parsed.proposal});else parsedMessage(reply.parsed);}
  setBusy(false);
 }
 async function confirm(){if(!draft||busy)return;setBusy(true);const reply=await act({type:'confirm',draftId:draft.id});if(reply){const p=draft.proposal;if(p.kind!=='settings')setDate(p.date);push('agent',p.kind==='cancel'?'해당 날짜의 근무와 알림을 취소했어요.':p.kind==='settings'?'다음 날 확인 알림 시각을 바꿨어요.':'저장했어요. 확인할 때 제가 알려드릴게요.');setDraft(null);}setBusy(false);}
 async function dismiss(){if(draft)await act({type:'discard',draftId:draft.id});setDraft(null);push('agent','저장하지 않았어요. 원하는 시간을 다시 말해 주세요.');}
 async function saveEdit(){if(!editing)return;const reply=await act({type:'interpret',text:`${editing.date} ${editText}`,date:editing.date});if(reply?.parsed?.kind==='proposal'&&reply.parsed.proposal.kind==='register'){
  // Explicit edit screen is a reviewed replacement; unlike chat registration it must replace.
  const result=await act({type:'replaceDay',date:editing.date,ranges:reply.parsed.proposal.ranges});if(result){await act({type:'discard',draftId:reply.draftId!});setEditing(null);push('agent','근무 시간을 수정했어요. 제외 시간은 초기화했으니 필요하면 다시 알려 주세요.');}
 }else if(reply?.parsed){setError(reply.parsed.kind==='clarify'?'오전·오후 또는 24시간제로 정확히 입력해 주세요.':reply.parsed.kind==='error'?reply.parsed.message:'근무 시간만 입력해 주세요.');}}
 const dateLabel=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short',timeZone:'Asia/Seoul'}).format(new Date(`${date}T00:00:00+09:00`));
 let preview:Slot[]=[];if(draft&&draft.proposal.kind==='register')try{const temp=applyProposal(state,draft.proposal);preview=getSlots(temp).filter(x=>draft.proposal.kind==='register'&&draft.proposal.ranges.some(r=>x.start>=r.start&&x.start<r.end));}catch{}
 return <div className="app">
  <header className="header"><div className="brand-icon"><img src="./agent.svg" alt=""/></div><div><h1>초과근무</h1><p><i className="online"/> 알림 친구 · 내 PC에만 저장</p></div><button className="icon-button" onClick={()=>setSettings(!settings)} aria-label="설정">⚙</button></header>
  <main className="content">
   {!snap.desktop&&<div className="warning">화면 미리보기입니다. 알림은 Windows 앱에서 작동해요.</div>}
   {snap.storageWarning&&<div className="warning" role="alert">{snap.storageWarning}</div>}
   {!state.settings.onboarded&&snap.desktop&&<section className="welcome"><span className="eyebrow">반가워요, 오늘부터 같이 챙겨요</span><h2>시간이 되면 제가 톡 할게요.</h2><p>창을 닫아도 트레이에서 기다려요.<br/>인사랑 처리는 직접 하고, 여기서 완료를 기록하세요.</p><div className="welcome-actions"><button className="primary" onClick={async()=>{if(await act({type:'settings',autoStart:true,onboarded:true}))push('agent','Windows 로그인 시 자동으로 시작할게요. 설정에서 언제든 바꿀 수 있어요.');}}>로그인할 때 자동 시작</button><button className="text-button" onClick={()=>void act({type:'settings',onboarded:true})}>지금은 직접 실행할게요</button></div></section>}
   {settings&&<section className="panel settings"><h2>알림 설정</h2><label>다음 날 누락 확인 <input aria-label="다음 날 알림 시각" type="time" value={`${String(Math.floor(state.settings.nextDayMinute/60)).padStart(2,'0')}:${String(state.settings.nextDayMinute%60).padStart(2,'0')}`} onChange={e=>{const [h,m]=e.target.value.split(':').map(Number);if(Number.isFinite(h+m))void act({type:'settings',nextDayMinute:h*60+m});}}/></label><label>알림 소리 <input type="checkbox" checked={state.settings.sound} onChange={e=>void act({type:'settings',sound:e.target.checked})}/></label><label>Windows 로그인 시 시작 <input type="checkbox" checked={state.settings.autoStart} onChange={e=>void act({type:'settings',autoStart:e.target.checked})}/></label><button className="secondary" onClick={()=>void act({type:'test'})}>작은 알림창 테스트</button><p>한국 시간 기준 · 주말에도 다음 날 확인<br/>PC가 꺼져 있거나 잠들면 다시 실행할 때 누락을 모아 알려드려요.</p></section>}
   <section className="agent-scene"><div className="scene-glow"/><img className="mascot" src="./agent.svg" alt="시계 모양 알림 친구"/><span className="eyebrow">잊어도 괜찮아요, 제가 기억할게요</span></section>
   <div className="day-tabs"><button className={date===dayKey()?'selected':''} onClick={()=>setDate(dayKey())}>오늘</button><button className={date===addDay(dayKey())?'selected':''} onClick={()=>setDate(addDay(dayKey()))}>내일</button><label className={date!==dayKey()&&date!==addDay(dayKey())?'selected calendar':'calendar'}>다른 날<input aria-label="다른 날" type="date" value={date} onChange={e=>{if(e.target.value)setDate(e.target.value);}}/></label></div>
   <section className="chat" aria-label="알림 친구와 대화"><div className="conversation">{messages.map(m=><div key={m.id} className={`message ${m.role}`}><span className="speaker">{m.role==='agent'?'알림 친구':'나'}</span><div className="bubble">{m.text}{m.choices&&<div className="choice-row">{m.choices.map(c=><button key={c.label} disabled={busy} onClick={()=>void send(c.text)}>{c.label}</button>)}</div>}</div></div>)}{draft&&<div className="message agent"><span className="speaker">알림 친구 · 저장 전 확인</span><div className="bubble draft"><strong>{proposalText(draft.proposal)}</strong>{preview.length>0&&<p className="draft-times">{preview.length}개 확인 구간 · 알림 {preview.slice(0,8).map(s=>timeText(s.remindAt)).join(' · ')}{preview.length>8?' …':''}</p>}<div className="choice-row"><button className="primary" disabled={busy} onClick={()=>void confirm()}>{draft.proposal.kind==='register'?'등록':'적용'}</button><button disabled={busy} onClick={()=>void dismiss()}>수정 / 취소</button></div></div></div>}<div ref={chatEnd}/></div></section>
   <section className="records"><div className="section-title"><div><span className="eyebrow">{dateLabel}</span><h2>확인할 초과근무 <span>{slots.length}</span></h2></div><span className="counter">{resolved}/{slots.length} 처리</span></div>
    {day&&<div className="work-summary"><div><span className="mini-label">등록된 근무</span><strong>{day.ranges.map(rangeText).join(' · ')}</strong>{day.exclusions.length>0&&<small>제외 {day.exclusions.map(rangeText).join(', ')}</small>}</div><button className="text-button" onClick={()=>{setEditing(day);setEditText(day.ranges.map(r=>`${timeText(r.start)}~${dayKey(r.end)!==dayKey(r.start)?'다음 날 ':''}${timeText(r.end)}`).join(', '));}}>수정</button><button className="text-button danger" onClick={()=>setDeleteDate(date)}>삭제</button></div>}
    {editing&&<form className="panel edit-panel" onSubmit={e=>{e.preventDefault();void saveEdit();}}><h3>{editing.date} 근무 수정</h3><p>24시간제로 입력하세요. 제외 시간은 초기화됩니다.</p><input aria-label="수정할 근무 시간" value={editText} onChange={e=>setEditText(e.target.value)} placeholder="18:00~21:00" required/><div className="choice-row"><button className="primary" type="submit">수정 저장</button><button type="button" onClick={()=>setEditing(null)}>취소</button></div></form>}
    {deleteDate&&<div className="panel delete-panel"><p>{deleteDate} 근무와 알림을 삭제할까요?</p><div className="choice-row"><button className="danger-button" onClick={async()=>{if(await act({type:'deleteDay',date:deleteDate}))setDeleteDate(null);}}>삭제</button><button onClick={()=>setDeleteDate(null)}>유지</button></div></div>}
    {!slots.length?<div className="empty"><span>☾</span><p>아직 등록한 초과근무가 없어요.</p><small>아래에 시간을 말하면 제가 챙길게요.</small></div>:<div className="slot-list">{slots.map(slot=>{
      const record=state.records[slot.id],snooze=state.snoozes[slot.id],past=slot.end<clock;
      return <article key={slot.id} className={`slot ${record?.status??'pending'}`}><div className="slot-main"><div className="slot-time"><b>{rangeText(slot)}</b><small>{slot.workDate!==date?`${slot.workDate} · `:''}{snooze?`${timeText(snooze)}에 다시 알림`:`권장 확인 ${timeText(slot.remindAt)}`}</small></div><span className={`status ${record?.status??(past?'missed':'waiting')}`}>{record?.status==='done'?'확인 완료':record?.status==='reason'?'사유 기록':past?'미확인':'확인 대기'}</span></div>{record?.reason&&<p className="reason-text">{record.reason}</p>}<div className="slot-actions">{record?<button onClick={()=>void act({type:'record',ids:[slot.id],status:'pending'})}>다시 미확인으로</button>:<><button className="complete-button" onClick={()=>void act({type:'record',ids:[slot.id],status:'done'})}>✓ 확인 완료</button><button onClick={()=>{setReasonId(slot.id);setReason('');}}>사유 남기기</button></>}</div>{reasonId===slot.id&&<form className="reason-form" onSubmit={async e=>{e.preventDefault();if(await act({type:'record',ids:[slot.id],status:'reason',reason}))setReasonId(null);}}><input aria-label="미확인 사유" value={reason} onChange={e=>setReason(e.target.value)} placeholder="예: 현장 업무로 확인하지 못했어요" maxLength={500} required/><div className="choice-row"><button className="primary" type="submit">사유 저장</button><button type="button" onClick={()=>setReasonId(null)}>취소</button></div></form>}</article>;
     })}</div>}
   </section><footer className="footnote">확인 완료는 앱의 개인 기록이에요.<br/>인사랑 근무기록·퇴근 확인은 직접 처리해 주세요.</footer>
  </main>
  <div className="composer-area">{error&&<div className="error" role="alert">{error}</div>}<div className="next-hint"><i className="online"/>{next?`다음 확인 ${next.workDate===dayKey()?'오늘':next.workDate} ${timeText(state.snoozes[next.id]??next.remindAt)}`:'알림 친구가 기다리고 있어요'}</div><form className="composer" onSubmit={(e:FormEvent)=>{e.preventDefault();void send();}}><input aria-label="대화 입력" value={input} onChange={e=>setInput(e.target.value)} placeholder="예: 오늘 오후 6시부터 9시까지" maxLength={1000} disabled={busy}/><button aria-label="보내기" disabled={busy||!input.trim()} type="submit">↑</button></form><div className="suggestions"><button onClick={()=>void send('오늘 18시부터 21시까지')}>오늘 18~21시</button><button onClick={()=>void send('내일 오전 6~9시, 18~22시')}>내일 아침 + 저녁</button><button onClick={()=>void send('오늘 저녁 7시에 식사 30분 제외')}>식사 30분 제외</button></div></div>
 </div>;
}
function Popup({snap,setSnap}:{snap:Snapshot;setSnap:(s:Snapshot)=>void}){
 const [error,setError]=useState('');const alert=snap.alert,played=useRef('');
 useEffect(()=>{if(alert&&alert.id!==played.current){played.current=alert.id;if(snap.state.settings.sound){const audio=new Audio('./chime.wav');void audio.play().catch(()=>setError('소리를 재생하지 못했어요. 오디오 장치를 확인해 주세요.'));}}},[alert?.id,snap.state.settings.sound]);
 async function act(c:Command){try{const r=await bridge.command(c);setSnap(r.snapshot);if(r.error)setError(r.error);}catch{setError('처리하지 못했어요. 대화창에서 다시 시도해 주세요.');}}
 if(!alert)return <div className="popup idle">알림 친구가 기다리고 있어요.</div>;
 const single=alert.kind==='hourly'&&alert.slotIds.length===1;
 return <div className="popup"><div className="popup-header"><img src="./agent.svg" alt=""/><span>초과근무 · 알림 친구</span><button aria-label="알림 닫기" onClick={()=>void act({type:'hidePopup'})}>×</button></div><h2>{alert.title}</h2><p>{alert.body}</p>{error&&<div className="error">{error}</div>}<div className="popup-actions">{single?<><button className="primary" onClick={()=>void act({type:'record',ids:alert.slotIds,status:'done'})}>✓ 확인 완료</button><button className="secondary" onClick={()=>void act({type:'snooze',ids:alert.slotIds})}>10분 뒤</button></>:alert.kind!=='test'?<button className="primary" onClick={()=>{const slot=getSlots(snap.state).find(x=>alert.slotIds.includes(x.id));void act({type:'show',date:slot?.workDate});}}>기록 확인하기</button>:<button className="primary" onClick={()=>void act({type:'hidePopup'})}>잘 보여요</button>}<button className="text-button" onClick={()=>void act({type:'hidePopup'})}>닫기</button></div><small>인사랑에서 직접 처리한 뒤 완료를 기록하세요.</small></div>;
}
