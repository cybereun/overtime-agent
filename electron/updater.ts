import type {UpdateState} from '../src/core/protocol';
type Listener=(...args:any[])=>void;
export interface UpdaterAdapter {
 autoDownload:boolean;autoInstallOnAppQuit:boolean;allowPrerelease:boolean;allowDowngrade:boolean;
 on(event:string,listener:Listener):unknown;
 checkForUpdates():Promise<unknown>;downloadUpdate():Promise<unknown>;
 quitAndInstall(isSilent?:boolean,isForceRunAfter?:boolean):void;
}
export class UpdateController {
 state:UpdateState;
 private requested=false;
 constructor(private adapter:UpdaterAdapter,version:string,enabled:boolean,private emit:()=>void,private show:()=>void,private prepareInstall:()=>void,private log:(message:string)=>void){
  this.state={status:enabled?'idle':'disabled',currentVersion:version};
  adapter.autoDownload=false;adapter.autoInstallOnAppQuit=false;adapter.allowPrerelease=false;adapter.allowDowngrade=false;
  adapter.on('checking-for-update',()=>this.set({status:'checking'}));
  adapter.on('update-not-available',()=>this.set({status:'current',error:undefined}));
  adapter.on('update-available',(info:{version:string})=>{this.set({status:'available',version:info.version,error:undefined});this.show();});
  adapter.on('download-progress',(info:{percent:number})=>{this.set({status:'downloading',percent:Math.round(info.percent)});});
  adapter.on('update-downloaded',(info:{version:string})=>{this.set({status:'ready',version:info.version,percent:100,error:undefined});this.show();});
  adapter.on('error',(error:Error)=>this.fail(error));
 }
 private set(patch:Partial<UpdateState>){const previous=this.state;this.state={...previous,...patch};if(previous.status!==this.state.status)this.log(`update ${this.state.status}${this.state.version?' '+this.state.version:''}`);this.emit();}
 private fail(error:unknown){this.set({status:'error',error:'업데이트를 확인하거나 다운로드하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'});this.log(`update error: ${error instanceof Error?error.message:String(error)}`);}
 async check(){
  if(this.state.status==='disabled'||this.requested||['checking','downloading','ready','installing'].includes(this.state.status))return;
  this.requested=true;try{await this.adapter.checkForUpdates();}catch(error){this.fail(error);}finally{this.requested=false;}
 }
 async download(){
  if(this.state.status!=='available')throw new Error('새 버전이 확인된 뒤 다운로드할 수 있어요.');
  this.set({status:'downloading',percent:0,error:undefined});try{await this.adapter.downloadUpdate();}catch(error){this.fail(error);}
 }
 install(){
  if(this.state.status!=='ready')throw new Error('업데이트 다운로드가 완료되지 않았어요.');
  this.prepareInstall();this.set({status:'installing'});try{this.adapter.quitAndInstall(true,true);}catch(error){this.fail(error);throw error;}
 }
}
