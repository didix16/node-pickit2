// Modules to control application life and create native browser window
const {app, BrowserWindow, Menu, ipcMain, dialog} = require('electron');
const path = require('path');
const PK2Functions = require('./pickit_functions.js');
const ImportExportHex = require('./import_export_hex.js');

if (require('electron-squirrel-startup')) app.quit();

let mainWindow;
let frontendBusy = false;

const createWindow = () => {

    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800,
        height: 700,
        // icon: path.join(__dirname, 'assets/icons/png/64x64.png'),
        webPreferences: {
            nodeIntegration: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // and load the index.html of the app.
    mainWindow.loadFile('gui/index.html');

    // Open the DevTools.
    //mainWindow.webContents.openDevTools();
}

// get PK2Function methods
let methods = Object.getOwnPropertyNames(PK2Functions).filter((key) => {

    let method = PK2Functions[key];
    return typeof method === 'function' && key !== 'constructor' && key[0] !== '_';
        
});

// get ImportExportHex methods
let importExportHexMethods = Object.getOwnPropertyNames(ImportExportHex).filter((key) => {

    let method = ImportExportHex[key];
    return typeof method === 'function' && key !== 'constructor' && key[0] !== '_';
        

});

const menu  = Menu.buildFromTemplate([
    {
        label: 'File',
        submenu: [
            {
                label: 'Import HEX File',
                accelerator: 'CmdOrCtrl+I',
                click: async () => {

                    if(frontendBusy){
                        return false;
                    }

                    let result = await dialog.showOpenDialog(mainWindow, {
                        title: 'Open HEX File',
                        properties: ['openFile'],
                        filters: [
                            {name: 'HEX Files', extensions: ['hex']},
                            {name: 'All Files', extensions: ['*']}
                        ]
                    });

                    if(!result.canceled){


                        mainWindow.webContents.send('open-hex-file', {
                            path: result.filePaths[0],
                            accepted: true
                        });

                    } else {
                            
                        mainWindow.webContents.send('open-hex-file', {
                            accepted: false,
                            path: null
                        });
                    }
                }
            },
            {
                type: 'separator'
            },
            {
                label: 'Exit',
                accelerator: 'CmdOrCtrl+Q',
                click: () => {
                    app.quit();
                }
            }
        ]
    }, {
        label: 'Tools',
        submenu: [
            {
                label: 'Detect Device',
                accelerator: 'CmdOrCtrl+D',
                click: () => {

                    if(frontendBusy){
                        return false;
                    }
                    mainWindow.webContents.send('detect-device');
                }
            },
        ]
    }
]);

Menu.setApplicationMenu(menu);

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {

    ipcMain.on('frontend:busy', async (event, arg) => {

        frontendBusy = true;
    });

    ipcMain.on('frontend:idle', async (event, arg) => {

        frontendBusy = false;
    });

    /**
     * Expose the PK2 API to the renderer process
     */
    for(let i = 0; i < methods.length; i++){

        ipcMain.handle('pk2:' + methods[i], (event, ...args) => {
            
            return PK2Functions[methods[i]](...args);
        });
    }

    /**
     * Expose the ImportExportHex API to the renderer process
     */
    for(let i = 0; i < importExportHexMethods.length; i++){

        ipcMain.handle('iehex:' + importExportHexMethods[i], (event, ...args) => {
            
            return ImportExportHex[importExportHexMethods[i]](...args);
        });
    }

    createWindow();

    app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if(BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    
    if(process.platform !== 'darwin') app.quit();
});