import {app,BrowserWindow,Tray,Menu,ipcMain,powerMonitor,screen,nativeImage,dialog} from 'electron';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {applyProposal,dayKey,getSlots,type State,type Proposal,type AlertEvent} from '../src/core/model';
import {parseCommand} from '../src/core/parser';
import {collectDue} from '../src/core/scheduler';
import {commandSchema,Store} from './store';
import type {Snapshot,Reply,Command} from '../src/core/protocol';

app.setName('초과근무');
if(process.env.OVERTIME_DATA_DIR)app.setPath('userData',process.env.OVERTIME_DATA_DIR);
let main:BrowserWindow|null=null,popup:BrowserWindow|null=null,tray:Tray|null=null,quitting=false;
let state:State,store:Store,active:AlertEvent|null=null,hideTimer:ReturnType<typeof setTimeout>|undefined;
const drafts=new Map<string,Proposal>();
const root=path.join(__dirname,'..');
const icon=path.join(root,'assets','icon.png');
const snapshot=():Snapshot=>({state,alert:active,desktop:true,storageWarning:store.warning||undefined});
const emit=()=>{for(const win of [main,popup])if(win&&!win.isDestroyed())win.webContents.send('overtime:update',snapshot());};
function commit(next:State){store.save(next);state=next;reconcileAlert();emit();}
function reconcileAlert(){if(active&&active.kind!=='test'){const ids=new Set(getSlots(state).filter(s=>!state.records[s.id]).map(s=>s.id));active.slotIds=active.slotIds.filter(id=>ids.has(id));if(!active.slotIds.length)hidePopup();}}
function hidePopup(){if(hideTimer)clearTimeout(hideTimer);active=null;popup?.hide();emit();}
function load(win:BrowserWindow,view='main'){
 if(process.env.OVERTIME_DEV_URL&&!app.isPackaged)void win.loadURL(`${process.env.OVERTIME_DEV_URL}/?view=${view}`);
 else void win.loadFile(path.join(root,'dist','index.html'),{query:{view}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',event=>event.preventDefault());
}
function makeWindow(){
 main=new BrowserWindow({width:450,height:810,minWidth:380,minHeight:560,show:false,title:'초과근무 · 알림 친구',backgroundColor:'#f5f3ff',icon,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 load(main);main.once('ready-to-show',()=>main?.show());
 main.on('close',event=>{if(!quitting){event.preventDefault();main?.hide();}});
}
function showMain(date?:string){if(main?.isMinimized())main.restore();main?.show();main?.focus();if(date)main?.webContents.send('overtime:navigate',date);}
function placePopup(){if(!popup)return;const area=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;popup.setBounds({x:area.x+area.width-380-18,y:area.y+area.height-260-18,width:380,height:260});}
function notify(event:AlertEvent){
 active=event;
 if(!popup){
  popup=new BrowserWindow({width:380,height:260,show:false,frame:false,resizable:false,alwaysOnTop:true,skipTaskbar:true,backgroundColor:'#f6f3ff',icon,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,autoplayPolicy:'no-user-gesture-required'}});
  load(popup,'popup');popup.on('close',e=>{if(!quitting){e.preventDefault();hidePopup();}});
  popup.once('ready-to-show',()=>{placePopup();popup?.showInactive();emit();});
 } else {placePopup();emit();popup.showInactive();}
 if(hideTimer)clearTimeout(hideTimer);hideTimer=setTimeout(hidePopup,30000);emit();
}
function tick(recover=false){
 try{const next=structuredClone(state);const alerts=collectDue(next,Date.now(),recover);if(alerts.length){commit(next);notify(alerts[0]);}}
 catch(error){store.warning=`알림 기록 저장에 실패했습니다. 저장 공간을 확인해 주세요. ${error instanceof Error?error.message:''}`;emit();}
}
function setAutoStart(value:boolean){app.setLoginItemSettings({openAtLogin:value,path:app.getPath('exe'),args:['--background']});}
async function handle(input:unknown):Promise<Reply>{
 try{
  const c=commandSchema.parse(input) as Command;
  if(c.type==='interpret'){
   const base=/오늘|내일|모레/.test(c.text)?dayKey():c.date;
   const parsed=parseCommand(c.text,base,state);
   if(parsed.kind==='proposal'){const draftId=randomUUID();drafts.clear();drafts.set(draftId,parsed.proposal);return {snapshot:snapshot(),parsed,draftId,proposal:parsed.proposal};}
   return {snapshot:snapshot(),parsed};
  }
  if(c.type==='confirm'){
   const proposal=drafts.get(c.draftId);if(!proposal)throw new Error('설정안이 만료됐어요. 다시 입력해 주세요.');
   commit(applyProposal(state,proposal));drafts.delete(c.draftId);tick(true);
  } else if(c.type==='discard')drafts.delete(c.draftId);
  else if(c.type==='deleteDay'){commit(applyProposal(state,{kind:'cancel',date:c.date}));}
  else if(c.type==='replaceDay'){
   const next=structuredClone(state);next.days=next.days.filter(d=>d.date!==c.date);
   commit(applyProposal(next,{kind:'register',date:c.date,ranges:c.ranges}));tick(true);
  } else if(c.type==='record'||c.type==='snooze'){
   const ids=new Set(getSlots(state).map(x=>x.id));if(c.ids.some(id=>!ids.has(id)))throw new Error('변경된 구간입니다. 현재 목록에서 다시 선택해 주세요.');
   const next=structuredClone(state);
   for(const id of c.ids){
    if(c.type==='snooze'){if(!next.records[id])next.snoozes[id]=Date.now()+10*60000;}
    else if(c.status==='pending'){delete next.records[id];}
    else {if(c.status==='reason'&&!c.reason?.trim())throw new Error('미확인 사유를 적어 주세요.');next.records[id]={status:c.status,...(c.status==='reason'?{reason:c.reason!.trim()}:{}),updatedAt:Date.now()};delete next.snoozes[id];}
   }
   commit(next);if(c.type==='snooze')hidePopup();
  } else if(c.type==='settings'){
   const next=structuredClone(state);const {type,...settings}=c;Object.assign(next.settings,settings);
   if(c.autoStart!==undefined&&c.autoStart!==state.settings.autoStart)setAutoStart(c.autoStart);
   try{commit(next);}catch(error){if(c.autoStart!==undefined)setAutoStart(state.settings.autoStart);throw error;}
  } else if(c.type==='hidePopup')hidePopup();
  else if(c.type==='show'){showMain(c.date);hidePopup();}
  else if(c.type==='test')notify({id:`test:${Date.now()}`,kind:'test',slotIds:[],title:'알림이 이렇게 도착해요',body:'소리와 작은 창을 확인해 주세요. 실제 근무 기록에는 영향을 주지 않아요.'});
  return {snapshot:snapshot()};
 }catch(error){return {snapshot:snapshot(),error:error instanceof Error?error.message:'처리하지 못했습니다.'};}
}
if(!app.requestSingleInstanceLock())app.quit();
else {
 app.on('second-instance',()=>showMain());
 app.on('before-quit',()=>{quitting=true;});
 app.on('window-all-closed',()=>{});
 void app.whenReady().then(()=>{
  store=new Store(app.getPath('userData'));state=store.load();
  ipcMain.handle('overtime:snapshot',event=>{if(![main?.webContents,popup?.webContents].includes(event.sender))throw new Error('허용되지 않은 창');return snapshot();});
  ipcMain.handle('overtime:command',(event,input)=>{if(![main?.webContents,popup?.webContents].includes(event.sender))throw new Error('허용되지 않은 창');return handle(input);});
  makeWindow();
  tray=new Tray(nativeImage.createFromPath(icon).resize({width:20,height:20}));tray.setToolTip('초과근무 · 알림 친구');
  tray.setContextMenu(Menu.buildFromTemplate([{label:'대화창 열기',click:()=>showMain()},{label:'알림 테스트',click:()=>void handle({type:'test'})},{type:'separator'},{label:'완전히 종료',click:()=>{quitting=true;app.quit();}}]));tray.on('double-click',()=>showMain());tray.on('click',()=>showMain());
  if(process.argv.includes('--background'))main?.once('ready-to-show',()=>main?.hide());
  powerMonitor.on('resume',()=>tick(true));powerMonitor.on('unlock-screen',()=>tick(true));
  setInterval(()=>tick(),1000);setTimeout(()=>tick(true),1500);
 }).catch(error=>{dialog.showErrorBox('초과근무를 시작하지 못했어요',String(error));app.quit();});
}
