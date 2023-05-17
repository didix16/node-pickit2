// All the Node.js APIs will be available in the preload process.
// It has the same sandbox as a Chrome extension.

const {contextBridge, ipcRenderer} = require('electron');
const PK2Functions = require('./pickit_functions.js');
const ImportExportHex = require('./import_export_hex.js');

/**
 * Expose the PK2 API to the renderer process
 */
let api = {
};
let methods = Object.getOwnPropertyNames(PK2Functions).filter((key) => {

    let method = PK2Functions[key];
    return typeof method === 'function' && key !== 'constructor' && key[0] !== '_';
        
});

methods.forEach((method) => {

    api[method] = (...args) => ipcRenderer.invoke('pk2:' + method, ...args);
});

/**
 * Expose the ImportExportHex API to the renderer process
 */
let ieHexApi = {};

let ieHexMethods = Object.getOwnPropertyNames(ImportExportHex).filter((key) => {

    let method = ImportExportHex[key];
    return typeof method === 'function' && key !== 'constructor' && key[0] !== '_';
        
});

ieHexMethods.forEach((method) => {

    ieHexApi[method] = (...args) => ipcRenderer.invoke('iehex:' + method, ...args);
});

contextBridge.exposeInMainWorld('PK2', api);
contextBridge.exposeInMainWorld('Constants', require('./constants.js'));
contextBridge.exposeInMainWorld('ImportExportHex', ieHexApi);
contextBridge.exposeInMainWorld('Frontend', {

    busy: () => ipcRenderer.send('frontend:busy'),
    idle: () => ipcRenderer.send('frontend:idle'),
});

https://stackoverflow.com/questions/52124675/how-can-we-send-messages-from-the-main-process-to-renderer-process-in-electron
contextBridge.exposeInMainWorld('events', {

    onOpenHexFile: (cb) => {
        ipcRenderer.on('open-hex-file', (event, data) => cb(data));
    },
    onDetectDevice: (cb) => {
        ipcRenderer.on('detect-device', (event, data) => cb(data));
    }
});
window.addEventListener('DOMContentLoaded', async () => {

    
});

