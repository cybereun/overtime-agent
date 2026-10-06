import {_electron as electron} from 'playwright';
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';const execute=promisify(execFile);
const exe=process.env.OVERTIME_UPGRADE_EXE;if(!exe)throw new Error('OVERTIME_UPGRADE_EXE must point to an installed test fixture.');
const dir=path.resolve('test-results','upgrade-data');await fs.mkdir(dir,{recursive:true});
const tomorrow=new Date(Date.now()+9*3600000+86400000).toISOString().slice(0,10),start=Date.parse(`${tomorrow}T18:00:00+09:00`),end=start+3*3600000,id=`${start}-${start+3600000}`;
const state={version:1,days:[{date:tomorrow,ranges:[{start,end}],exclusions:[]}],records:{[id]:{status:'done',updatedAt:Date.now()}},deliveries:{},snoozes:{},settings:{nextDayMinute:540,sound:false,autoStart:false,onboarded:true}};
await fs.writeFile(path.join(dir,'overtime.json'),JSON.stringify(state));await fs.rm(path.join(dir,'update.log'),{force:true});
let application;
async function waitState(page,predicate,timeout=30000){const started=Date.now();while(Date.now()-started<timeout){const snapshot=await page.evaluate(()=>window.overtime.snapshot());if(snapshot.update.status==='error')throw new Error(snapshot.update.error);if(predicate(snapshot))return snapshot;await new Promise(r=>setTimeout(r,250));}throw new Error('Update condition timed out');}
try{
 application=await electron.launch({executablePath:exe,args:[],env:{...process.env,OVERTIME_DATA_DIR:dir},timeout:30000});const page=await application.firstWindow();await page.getByRole('heading',{name:'초과근무',exact:true}).waitFor();const current=await page.evaluate(async()=> (await window.overtime.snapshot()).update);assert.equal(current.currentVersion,'0.9.0');
 console.log('Installed fixture v0.9.0. Checking public GitHub release…');await page.evaluate(()=>window.overtime.command({type:'checkUpdate'}));await waitState(page,s=>s.update.status==='available',60000);
 let updateWindow=application.windows().find(p=>p.url().includes('view=update'));if(!updateWindow)updateWindow=await application.waitForEvent('window',{timeout:10000});await updateWindow.getByRole('button',{name:'다운로드',exact:true}).waitFor();await updateWindow.screenshot({path:'test-results/update-available.png'});
 console.log('GitHub v1.0.0 detected; downloading actual release installer.');await updateWindow.getByRole('button',{name:'다운로드',exact:true}).click();await waitState(page,s=>s.update.status==='ready',180000);await updateWindow.getByRole('button',{name:'설치 후 재실행',exact:true}).waitFor();await updateWindow.screenshot({path:'test-results/update-ready.png'});
 const ready=await page.evaluate(async()=> (await window.overtime.snapshot()).update);assert.equal(ready.version,'1.0.0');console.log('Download verified; invoking install-and-restart.');
 const installStarted=Date.now();const closed=application.waitForEvent('close',{timeout:30000});await updateWindow.getByRole('button',{name:'설치 후 재실행',exact:true}).click().catch(error=>{if(!String(error).includes('closed'))throw error;});await closed;application=null;
 const started=Date.now();let log='',restarted=false;
 // NSIS runs the new app through Explorer, which intentionally does not preserve our test-only data-dir environment override.
 const normalLog=path.join(process.env.APPDATA,'초과근무','update.log');
 while(Date.now()-started<90000){for(const file of [path.join(dir,'update.log'),normalLog])try{const text=await fs.readFile(file,'utf8');log+=text.split('\n').filter(x=>/startup 1.0.0/.test(x)&&Date.parse(x.slice(0,24))>=installStarted-3000).join('\n');if(log.includes('startup 1.0.0')){restarted=true;break;}}catch{}if(restarted)break;await new Promise(r=>setTimeout(r,1000));}
 assert.ok(restarted,'Updated executable must actually restart');
 const {stdout}=await execute('powershell.exe',['-NoProfile','-Command',"$taskExe=Get-Item -LiteralPath $env:OVERTIME_UPGRADE_EXE; $taskProcesses=@(Get-CimInstance Win32_Process -Filter \"Name='초과근무.exe'\" | Where-Object {$_.ExecutablePath -eq $env:OVERTIME_UPGRADE_EXE}); [pscustomobject]@{Version=$taskExe.VersionInfo.ProductVersion;Processes=$taskProcesses.Count} | ConvertTo-Json"],{env:process.env});const running=JSON.parse(stdout);assert.equal(running.Version,'1.0.0.0');assert.ok(running.Processes>0);
 const saved=JSON.parse(await fs.readFile(path.join(dir,'overtime.json'),'utf8'));assert.deepEqual(saved,state,'Records must survive actual installation');
 const originalLog=await fs.readFile(path.join(dir,'update.log'),'utf8');const result={result:'PASS',source:'https://github.com/cybereun/overtime-agent/releases/tag/v1.0.0',from:'0.9.0',to:'1.0.0',running,checks:['public release detection','install prompt','GitHub installer download and SHA512 verification','NSIS install','automatic restart logged as v1.0.0','records preserved'],log:(originalLog+'\n'+log).split('\n').filter(x=>/startup|update available|update ready|install requested/.test(x))};await fs.writeFile('test-results/upgrade-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{if(application)await application.close();}
