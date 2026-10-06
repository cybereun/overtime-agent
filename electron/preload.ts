import {contextBridge,ipcRenderer} from 'electron';
import type { Bridge } from '../src/core/protocol';
const bridge:Bridge={
 snapshot:()=>ipcRenderer.invoke('overtime:snapshot'),
 command:command=>ipcRenderer.invoke('overtime:command',command),
 subscribe:callback=>{const listener=(_event:unknown,data:Parameters<typeof callback>[0])=>callback(data);ipcRenderer.on('overtime:update',listener);return ()=>ipcRenderer.removeListener('overtime:update',listener);},
 onNavigate:callback=>{const listener=(_event:unknown,date:string)=>callback(date);ipcRenderer.on('overtime:navigate',listener);return ()=>ipcRenderer.removeListener('overtime:navigate',listener);}
};
contextBridge.exposeInMainWorld('overtime',bridge);
