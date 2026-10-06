import {_electron as electron} from 'playwright';
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const dir=path.resolve('test-results','desktop-data');await fs.mkdir(dir,{recursive:true});
// The entire test-data directory is owned by this test, never production userData.
const file=path.join(dir,'overtime.json');await fs.rm(file,{force:true});await fs.rm(`${file}.bak`,{force:true});
await fs.mkdir('test-results',{recursive:true});
const executablePath=process.env.OVERTIME_EXE;
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
 await page.getByRole('textbox',{name:'대화 입력'}).fill('내일 저녁 7시에 식사 30분 제외');await page.getByRole('button',{name:'보내기',exact:true}).click();await page.getByRole('button',{name:'적용',exact:true}).click();await page.waitForFunction(async()=> (await window.overtime.snapshot()).state.days[0].exclusions.length===1);
 await page.locator('.slot').first().getByRole('button',{name:'확인 완료'}).click();
 await page.locator('.slot').nth(1).getByRole('button',{name:'사유 남기기'}).click();await page.getByRole('textbox',{name:'미확인 사유'}).fill('현장 업무');await page.getByRole('button',{name:'사유 저장'}).click();await page.locator('.reason-text').waitFor();
 await page.getByRole('button',{name:'수정',exact:true}).click();await page.getByRole('textbox',{name:'수정할 근무 시간'}).fill('18:00~22:00');await page.getByRole('button',{name:'수정 저장'}).click();await page.waitForFunction(async()=> (await window.overtime.snapshot()).state.days[0].ranges[0].end-(await window.overtime.snapshot()).state.days[0].ranges[0].start===4*3600000);
 assert.equal(await page.locator('.slot').count(),4);
 await page.screenshot({path:'test-results/main.png'});
 await page.getByRole('button',{name:'설정',exact:true}).click();
 const newWindow=application.waitForEvent('window');await page.getByRole('button',{name:'작은 알림창 테스트'}).click();const popup=await newWindow;await popup.getByRole('heading',{name:'알림이 이렇게 도착해요'}).waitFor();await popup.screenshot({path:'test-results/popup.png'});
 const focus=await application.evaluate(({BrowserWindow})=>{const windows=BrowserWindow.getAllWindows();return {main:windows[0].isFocused(),popup:windows[1].isFocused(),visible:windows[1].isVisible(),alwaysOnTop:windows[1].isAlwaysOnTop(),bounds:windows[1].getBounds()};});assert.equal(focus.popup,false,'popup must not steal focus');assert.equal(focus.visible,true);assert.equal(focus.alwaysOnTop,true);
 await popup.getByRole('button',{name:'잘 보여요'}).click();
 // Observe a real HTMLAudioElement playback on an already loaded popup.
 await popup.evaluate(()=>{window.__audio=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){this.addEventListener('playing',()=>window.__audio.push({volume:this.volume,duration:this.duration}));return play.call(this);};});
 await page.getByRole('button',{name:'작은 알림창 테스트'}).click();await popup.waitForFunction(()=>window.__audio?.length>0);const audio=await popup.evaluate(()=>window.__audio);assert.equal(audio.length,1);assert.ok(audio[0].duration>0);await popup.getByRole('button',{name:'잘 보여요'}).click();
 // Closing the main window must keep process/tray alive.
 await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());const hidden=await application.evaluate(({BrowserWindow})=>!BrowserWindow.getAllWindows()[0].isVisible());assert.ok(hidden);
 await page.evaluate(()=>window.overtime.command({type:'show'}));
 state=await page.evaluate(async()=> (await window.overtime.snapshot()).state);assert.equal(state.days[0].date,tomorrow);assert.equal(state.records[`${state.days[0].ranges[0].start}-${state.days[0].ranges[0].start+3600000}`].status,'done');assert.equal(errors.length,0,errors.join('\n'));
 await application.close();application=await launch();const restored=await application.firstWindow();await restored.getByRole('heading',{name:'초과근무',exact:true}).waitFor();const saved=await restored.evaluate(async()=> (await window.overtime.snapshot()).state);assert.deepEqual(saved,state);
 // Seed an actual near-future reminder and prove the main scheduler reaches popup.
 await application.close();const now=Date.now(),start=now+5000-1800000,end=start+3600000,id=`${start}-${end}`;const date=new Date(start+9*3600000).toISOString().slice(0,10);
 const scheduled={version:1,days:[{date,ranges:[{start,end}],exclusions:[]}],records:{},deliveries:{},snoozes:{},settings:{nextDayMinute:540,sound:true,autoStart:false,onboarded:true}};await fs.writeFile(file,JSON.stringify(scheduled));application=await launch();const scheduledMain=await application.firstWindow();await scheduledMain.getByRole('heading',{name:'초과근무',exact:true}).waitFor();let livePopup;
 for(const p of application.windows())if(p!==scheduledMain)livePopup=p;
 if(!livePopup)livePopup=await application.waitForEvent('window',{timeout:20000});await livePopup.getByRole('heading',{name:'초과근무 확인할時間이에요'.replace('時間','시간')}).waitFor();
 await livePopup.getByRole('button',{name:'10분 뒤'}).click();const snoozed=await scheduledMain.evaluate(async()=> (await window.overtime.snapshot()).state);assert.ok(snoozed.snoozes[id]>Date.now()+9*60000);
 await application.close();application=await launch();const afterSnooze=await application.firstWindow();await afterSnooze.getByRole('heading',{name:'초과근무',exact:true}).waitFor();assert.equal((await afterSnooze.evaluate(async()=> (await window.overtime.snapshot()).state)).snoozes[id],snoozed.snoozes[id]);
 await afterSnooze.evaluate(()=>window.overtime.command({type:'show'}));const pending=await afterSnooze.evaluate(async()=> (await window.overtime.snapshot()).state);assert.equal(Object.keys(pending.deliveries).length,1);
 console.log(JSON.stringify({result:'PASS',checks:['draft does not save','register/exclusion/edit','done and reason','inactive corner popup','audio playing once','close to tray','restart persistence','real scheduled reminder','10-minute snooze persistence'],focus,audio,screenshots:['test-results/main.png','test-results/popup.png']},null,2));
}finally{if(application)await application.close();}
