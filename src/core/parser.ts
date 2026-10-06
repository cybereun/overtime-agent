import { type State,type Proposal,type Range,addDay,stamp,validDate,applyProposal } from './model';
export type ParseResult={kind:'proposal';proposal:Proposal}|{kind:'clarify';message:string;choices:{label:string;text:string}[]}|{kind:'error';message:string};
const periods='오전|오후|아침|저녁|밤|새벽';
const token=`(?:(${periods})\\s*)?(\\d{1,2})(?:\\s*[:시]\\s*(\\d{1,2})\\s*분?|\\s*시)?`;
const hour=(h:number,m:number,period?:string)=> {
 if(h>24||m>59||h===24&&m!==0)throw new Error('시간은 00:00~24:00 사이로 입력해 주세요.');
 if(period){if(h<1||h>12)throw new Error('오전·오후는 1~12시로 입력해 주세요.');return (h%12+(/오후|저녁|밤/.test(period)?12:0))*60+m;}
 return h*60+m;
};
function clarify(text:string,index:number):ParseResult {return {kind:'clarify',message:'짧게 적은 시간의 오전·오후를 알려 주세요. 18시처럼 24시간제로 적어도 좋아요.',choices:[{label:'오전으로 해석',text:text.slice(0,index)+'오전 '+text.slice(index)},{label:'오후로 해석',text:text.slice(0,index)+'오후 '+text.slice(index)}]};}
const explicit24=(matched:string,h:string)=>h.startsWith('0')||matched.includes(':')||Number(h)===0||Number(h)>12;
export function parseCommand(text:string,selectedDate:string,state:State):ParseResult {
 try {
 const raw=text.trim();if(!raw)return {kind:'error',message:'날짜와 초과근무 시간을 말해 주세요.'};
 let date=selectedDate;const explicit=raw.match(/(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
 if(explicit)date=`${explicit[1]}-${explicit[2].padStart(2,'0')}-${explicit[3].padStart(2,'0')}`;
 else if(/모레/.test(raw))date=addDay(selectedDate,2);
 else if(/내일/.test(raw))date=addDay(selectedDate);
 if(!validDate(date))throw new Error('실제로 존재하는 날짜를 입력해 주세요.');
 const source=raw.replace(/\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2}/g,m=>' '.repeat(m.length));
 let proposal:Proposal;
 if(/다음\s*날.*알림/.test(raw)&&/바꿔|변경|설정/.test(raw)){
  const m=source.match(new RegExp(token));if(!m)throw new Error('다음 날 알림 시각을 입력해 주세요.');
  if(!m[1]&&!explicit24(m[0],m[2]))return clarify(raw,m.index!);
  const minute=hour(Number(m[2]),Number(m[3]||0),m[1]);proposal={kind:'settings',minute};
 } else if(/취소|삭제/.test(raw))proposal={kind:'cancel',date};
 else if(/제외|식사|휴식/.test(raw)){
  const m=source.match(new RegExp(token));const duration=m?source.slice(m.index!+m[0].length).match(/(\d+)\s*분/):null;
  if(!duration||!m)throw new Error('“오늘 저녁 7시에 식사 30분 제외”처럼 입력해 주세요.');
  if(!m[1]&&!explicit24(m[0],m[2]))return clarify(raw,m.index!);
  const minutes=Number(duration[1]);if(minutes<1||minutes>1440)throw new Error('제외 시간은 1~1440분으로 입력해 주세요.');
  let start=stamp(date,hour(Number(m[2]),Number(m[3]||0),m[1]));
  const day=state.days.find(x=>x.date===date);if(day&&!day.ranges.some(r=>start>=r.start&&start<r.end)&&day.ranges.some(r=>start+86400_000>=r.start&&start+86400_000<r.end))start+=86400_000;
  proposal={kind:'exclude',date,range:{start,end:start+minutes*60000}};
 } else if(/종료/.test(raw)&&/바꿔|변경/.test(raw)){
  const m=source.match(new RegExp(token));if(!m)throw new Error('바꿀 종료 시간을 입력해 주세요.');
  if(!m[1]&&!explicit24(m[0],m[2]))return clarify(raw,m.index!);
  let end=stamp(date,hour(Number(m[2]),Number(m[3]||0),m[1]));const start=state.days.find(x=>x.date===date)?.ranges[0]?.start;
  if(start&&end<=start)end+=86400_000;proposal={kind:'changeEnd',date,end};
 } else {
  const re=new RegExp(`${token}\\s*(?:부터|[~～\\-–])\\s*(다음\\s*날\\s*)?${token}\\s*(?:시|까지)?`,'gd');
  const ranges:Range[]=[];let m:RegExpExecArray|null;
  while((m=re.exec(source))) {
   const [ ,p1,h1,min1,next,p2,h2,min2]=m;
   const a=Number(h1),b=Number(h2);
   const split=m.indices![6]![0];
   const first24=explicit24(source.slice(m.index,split),h1);
   const second24=explicit24(source.slice(split,m.index+m[0].length),h2);
   if(!p1&&!first24)return clarify(raw,m.indices![2]![0]);
   const inherited=p2||(!next&&!second24?p1:undefined);
   if(next&&!inherited&&!second24)return clarify(raw,split);
   if(!inherited&&!second24&&!first24&&a<13)return clarify(raw,split);
   const start=stamp(date,hour(a,Number(min1||0),p1));
   let endMinute=hour(b,Number(min2||0),inherited);
   // Explicit 18시부터 9시 -> evening endpoint, but 23시부터 2시 crosses midnight.
   if(!next&&!inherited&&!second24&&a>=13&&b>=1&&b<=12&&b+12>a)endMinute+=720;
   let end=stamp(date,endMinute);if(next||end<start)end+=86400_000;
   if(end===start)throw new Error('시작과 종료가 같습니다. 다음 날 종료라면 “다음 날”을 적어 주세요.');
   ranges.push({start,end});
  }
  if(!ranges.length)throw new Error('“오늘 18시부터 21시까지”처럼 알려 주세요. 변경·취소·식사 시간 제외도 가능해요.');
  proposal={kind:'register',date,ranges};
 }
 // Validate before presenting; no write occurs here.
 applyProposal(state,proposal);return {kind:'proposal',proposal};
 }catch(error){return {kind:'error',message:error instanceof Error?error.message:'입력을 확인해 주세요.'};}
}
