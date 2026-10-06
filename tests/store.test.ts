import {describe,it,expect} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {Store,commandSchema} from '../electron/store';
import {emptyState,applyProposal,stamp} from '../src/core/model';
describe('파일 저장과 IPC 검증',()=>{
 it('atomic save and reload',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'overtime-store-'));try{const store=new Store(dir);const s=applyProposal(emptyState(),{kind:'register',date:'2026-10-07',ranges:[{start:stamp('2026-10-07',1080),end:stamp('2026-10-07',1260)}]});store.save(s);expect(store.load()).toEqual(s);expect(fs.existsSync(`${store.file}.tmp`)).toBe(false);}finally{fs.rmSync(dir,{recursive:true,force:true});}});
 it('corrupt state preserved and backup recovered',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'overtime-store-'));try{const store=new Store(dir);const s=emptyState();store.save(s);store.save({...s,settings:{...s.settings,sound:false}});fs.writeFileSync(store.file,'{bad');expect(store.load()).toEqual(s);expect(store.warning).toContain('백업');expect(fs.readdirSync(dir).some(x=>x.includes('.invalid-'))).toBe(true);}finally{fs.rmSync(dir,{recursive:true,force:true});}});
 it('invalid IPC commands rejected',()=>{for(const command of [{type:'settings',nextDayMinute:1440},{type:'settings',sound:'yes'},{type:'record',ids:[],status:'done'},{type:'replaceDay',date:'2026-02-30',ranges:[]},{type:'record',ids:['x'],status:'reason',reason:'  '}])expect(commandSchema.safeParse(command).success).toBe(false);});
});
