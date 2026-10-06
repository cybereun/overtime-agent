import {spawn} from 'node:child_process';
import electron from 'electron';
const children=[];
function run(command,args,env={}){const child=spawn(command,args,{stdio:'inherit',shell:process.platform==='win32',env:{...process.env,...env}});children.push(child);return child;}
await new Promise((resolve,reject)=>{run('node',['scripts/build-electron.mjs']).on('exit',code=>code===0?resolve():reject(new Error('Electron build failed')));});
run('node',['node_modules/vite/bin/vite.js','--port','5173','--strictPort']);
for(let i=0;i<60;i++){try{await fetch('http://127.0.0.1:5173');break;}catch{await new Promise(r=>setTimeout(r,250));}}
run(electron,['.'],{OVERTIME_DEV_URL:'http://127.0.0.1:5173'}).on('exit',()=>process.exit());
process.on('exit',()=>children.forEach(c=>c.kill()));
