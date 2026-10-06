import {_electron as electron} from 'playwright';
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const dir=path.resolve('test-results','desktop-data');await fs.mkdir(dir,{recursive:true});
// The entire test-data directory is owned by this test, never production userData.
const file=path.join(dir,'overtime.json');await fs.rm(file,{force:true});await fs.rm(`${file}.bak`,{force:true});
await fs.mkdir('test-results',{recursive:true});
const executablePath=process.env.OVERTIME_EXE;
async function waitState(page,predicate,timeout=30000){const started=Date.now();while(Date.now()-started<timeout){const snapshot=await page.evaluate(()=>window.overtime.snapshot());if(predicate(snapshot))return snapshot;await new Promise(r=>setTimeout(r,150));}throw new Error('State condition timed out');}
const args=executablePath?[]:['.'];
let application;
const launch=async()=>{const app=await electron.launch({...(executablePath?{executablePath}:{}),args,env:{...process.env,OVERTIME_DATA_DIR:dir},timeout:30000});return app;};
try{
 application=await launch();const page=await application.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.getByRole('heading',{name:'초과근무',exact:true}).waitFor();
 await page.getByRole('button',{name:'지금은 직접 실행할게요'}).click();
 const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10),tomorrow=new Date(Date.parse(`${today}T00:00:00+09:00`)+86400000+9*3600000).toISOString().slice(0,10);
 await page.getByRole('textbox',{name:'대화 입력'}).fill('내일 오후 6시부터 9시까지');await page.getByRole('button',{name:'보내기',exact:true}).click();await page.getByRole('button',{name:'등록',exact:true}).waitFor();
 let state=await page.evaluate(async()=> (await window.overtime.snapshot()).state);assert.equal(state.days.length,0,'draft must not save');
 await page.getByRole('button',{name:'등록',exact:true}).click();await page.locator('.slot').first().waitFor();assert.equal(await page.locator('.slot').count(),3);
 await page.getByRole('textbox',{name:'대화 입력'}).fill('내일 저녁 7시에 식사 30분 제외');await page.getByRole('button',{name:'보내기',exact:true}).click();await page.getByRole('button',{name:'적용',exact:true}).click();await waitState(page,s=>s.state.days[0].exclusions.length===1);
 await page.locator('.slot').first().getByRole('button',{name:'확인 완료'}).click();
 await page.locator('.slot').nth(1).getByRole('button',{name:'사유 남기기'}).click();await page.getByRole('textbox',{name:'미확인 사유'}).fill('현장 업무');await page.getByRole('button',{name:'사유 저장'}).click();await page.locator('.reason-text').waitFor();
 await page.getByRole('button',{name:'수정',exact:true}).click();await page.getByRole('textbox',{name:'수정할 근무 시간'}).fill('18:00~22:00');await page.getByRole('button',{name:'수정 저장'}).click();await waitState(page,s=>s.state.days[0].ranges[0].end-s.state.days[0].ranges[0].start===4*3600000);
 await page.waitForFunction(()=>document.querySelectorAll('.slot').length===4);
 assert.equal(await page.locator('.slot').count(),4);
 await page.screenshot({path:'test-results/records.png'});
 await page.locator('.content').evaluate(el=>el.scrollTop=0);await page.screenshot({path:'test-results/main.png'});
 await page.getByRole('button',{name:'설정',exact:true}).click();
 const newWindow=application.waitForEvent('window');await page.getByRole('button',{name:'작은 알림창 테스트'}).click();const popup=await newWindow;await popup.getByRole('heading',{name:'알림이 이렇게 도착해요'}).waitFor();await popup.screenshot({path:'test-results/popup.png'});
 const focus=await application.evaluate(({BrowserWindow,screen})=>{const windows=BrowserWindow.getAllWindows(),popup=windows.find(w=>w.webContents.getURL().includes('view=popup')),main=windows.find(w=>!w.webContents.getURL().includes('view=popup'));return {main:main.isFocused(),popup:popup.isFocused(),visible:popup.isVisible(),alwaysOnTop:popup.isAlwaysOnTop(),bounds:popup.getBounds(),area:screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea};});assert.equal(focus.popup,false,'popup must not steal focus');assert.equal(focus.visible,true);assert.equal(focus.alwaysOnTop,true);assert.ok(Math.abs(focus.bounds.x-(focus.area.x+focus.area.width-398))<=2,'corner x (DPI rounding)');assert.ok(Math.abs(focus.bounds.y-(focus.area.y+focus.area.height-278))<=2,'corner y (DPI rounding)');
 await popup.getByRole('button',{name:'잘 보여요'}).click();
 // Observe a real HTMLAudioElement playback on an already loaded popup.
 await popup.evaluate(()=>{window.__audio=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){this.addEventListener('playing',()=>window.__audio.push({volume:this.volume,duration:this.duration}));return play.call(this);};});
 await page.getByRole('button',{name:'작은 알림창 테스트'}).click();await popup.waitForFunction(()=>window.__audio?.length>0);const audio=await popup.evaluate(()=>window.__audio);assert.equal(audio.length,1);assert.ok(audio[0].duration>0);await popup.getByRole('button',{name:'잘 보여요'}).click();
 // Closing the main window must keep process/tray alive.
 await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('view=popup')).close());const hidden=await application.evaluate(({BrowserWindow})=>!BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('view=popup')).isVisible());assert.ok(hidden);
 await page.evaluate(()=>window.overtime.command({type:'show'}));
 state=await page.evaluate(async()=> (await window.overtime.snapshot()).state);assert.equal(state.days[0].date,tomorrow);assert.equal(state.records[`${state.days[0].ranges[0].start}-${state.days[0].ranges[0].start+3600000}`].status,'done');assert.equal(errors.length,0,errors.join('\n'));
 await application.close();application=await launch();const restored=await application.firstWindow();await restored.getByRole('heading',{name:'초과근무',exact:true}).waitFor();const saved=await restored.evaluate(async()=> (await window.overtime.snapshot()).state);assert.deepEqual(saved,state);
 // Seed an actual near-future reminder and prove the main scheduler reaches popup.
 await application.close();const now=Date.now(),start=now+5000-1800000,end=start+3600000,id=`${start}-${end}`;const date=new Date(start+9*3600000).toISOString().slice(0,10);
 const scheduled={version:1,days:[{date,ranges:[{start,end}],exclusions:[]}],records:{},deliveries:{},snoozes:{},settings:{nextDayMinute:540,sound:true,autoStart:false,onboarded:true}};await fs.writeFile(file,JSON.stringify(scheduled));application=await launch();const scheduledMain=await application.firstWindow();await scheduledMain.getByRole('heading',{name:'초과근무',exact:true}).waitFor();let livePopup;
 for(const p of application.windows())if(p!==scheduledMain)livePopup=p;
 if(!livePopup)livePopup=await application.waitForEvent('window',{timeout:20000});await livePopup.getByRole('heading',{name:'초과근무 확인할 시간이에요'}).waitFor();
 await livePopup.getByRole('button',{name:'10분 뒤'}).click();const snoozed=await scheduledMain.evaluate(async()=> (await window.overtime.snapshot()).state);assert.ok(snoozed.snoozes[id]>Date.now()+9*60000);
 await application.close();application=await launch();const afterSnooze=await application.firstWindow();await afterSnooze.getByRole('heading',{name:'초과근무',exact:true}).waitFor();assert.equal((await afterSnooze.evaluate(async()=> (await window.overtime.snapshot()).state)).snoozes[id],snoozed.snoozes[id]);
 await afterSnooze.evaluate(()=>window.overtime.command({type:'show'}));const pending=await afterSnooze.evaluate(async()=> (await window.overtime.snapshot()).state);assert.equal(Object.keys(pending.deliveries).length,1);
 // Advance only the isolated test process's clock to exercise persisted snooze and resume.
 await application.evaluate((_electron,now)=>{globalThis.__realNow=Date.now;Date.now=()=>now;},snoozed.snoozes[id]+1000);
 const resumedPopup=await application.waitForEvent('window',{timeout:10000});await resumedPopup.getByRole('button',{name:'확인 완료'}).waitFor();await resumedPopup.getByRole('button',{name:'확인 완료'}).click();await waitState(afterSnooze,s=>Object.values(s.state.records).some(x=>x.status==='done'));
 const replacement={start,end:start+3*3600000};await afterSnooze.evaluate(async({date,replacement})=>window.overtime.command({type:'replaceDay',date,ranges:[replacement]}),{date,replacement});
 await application.evaluate(({powerMonitor},now)=>{Date.now=()=>now;powerMonitor.emit('resume');},replacement.end+1000);
 await resumedPopup.getByRole('heading',{name:'놓친 확인을 모아봤어요'}).waitFor();const recovery=await afterSnooze.evaluate(async()=> (await window.overtime.snapshot()).alert);assert.equal(recovery.kind,'recovery');assert.equal(recovery.slotIds.length,2);
 await afterSnooze.evaluate(date=>window.overtime.command({type:'deleteDay',date}),date);await waitState(afterSnooze,s=>s.alert===null);assert.equal(await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('view=popup')).isVisible()),false);
 await application.evaluate(()=>{Date.now=globalThis.__realNow;});
 const hideStarted=performance.now();const testReply=await afterSnooze.evaluate(()=>window.overtime.command({type:'test'}));assert.equal(testReply.snapshot.alert.kind,'test');await resumedPopup.getByRole('heading',{name:'알림이 이렇게 도착해요'}).waitFor();await waitState(afterSnooze,s=>s.alert===null,35000);const autoHideMs=performance.now()-hideStarted;assert.ok(autoHideMs>=28500&&autoHideMs<35000,`auto-hide: ${autoHideMs}ms`);
 const result={result:'PASS',checks:['draft does not save','register/exclusion/edit','done and reason','inactive corner popup','audio playing once','close to tray','restart persistence','real scheduled reminder','10-minute snooze persistence','real popup completion','resume groups missed reminders','cancel dismisses active popup','30-second auto hide'],focus,audio,autoHideMs,screenshots:['test-results/main.png','test-results/records.png','test-results/popup.png']};await fs.writeFile('test-results/desktop-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{if(application)await application.close();}
