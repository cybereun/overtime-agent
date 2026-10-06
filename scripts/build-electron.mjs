import {build} from 'esbuild';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
await fs.mkdir('assets',{recursive:true});
const svg=await fs.readFile('public/agent.svg');
await sharp(svg).resize(256,256).png().toFile('assets/icon.png');
await fs.writeFile('assets/icon.ico',await pngToIco('assets/icon.png'));
await build({entryPoints:['electron/main.ts','electron/preload.ts'],outdir:'dist-electron',bundle:true,platform:'node',format:'cjs',external:['electron','electron-updater'],outExtension:{'.js':'.cjs'},target:'node22'});
// Local two-tone chime; no remote media or assets.
const sampleRate=22050,length=Math.floor(sampleRate*.45),buffer=Buffer.alloc(44+length*2);
buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(sampleRate,24);buffer.writeUInt32LE(sampleRate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(length*2,40);
for(let i=0;i<length;i++){const t=i/sampleRate,frequency=t<.2?880:1174,volume=Math.max(0,1-t/.45)*.2;buffer.writeInt16LE(Math.round(Math.sin(2*Math.PI*frequency*t)*volume*32767),44+i*2);}
await fs.writeFile('dist/chime.wav',buffer);
