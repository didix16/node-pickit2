let deviceDetected = false;
let columnCount = 9;
let dataColumns = 8;
let eepromDataColumns = 16;
let devFile = null;
let addressIncrement = 0;
let deviceBuffers = null;
let verifyOSCCALValue = true;
let checkImportFile = false;
let importGo = false;
let fileName = '';

let frontendIsBusy = false;

// Fields
let pickitDetected = null;
let firmwareVersion = null;
let picKitVpp = null;
let picKitVdd = null;
let deviceName = null;
let configurationWords = null;
let checksumField = null;
let userIdsField = null;
let statusField = null;
let progressBar = null;
let memorySource = null;

let programMemoryView = null;
let eepromMemoryView = null;

function toHex(value, padding){

    return value.toString(16).toUpperCase().padStart(padding, '0');
}

function shortenHex(fullPath){

    if(fullPath.length > 42){

        return fullPath.substring(0, 3) + '...' + fullPath.substring(fullPath.length - 36);
    }

    return fullPath;
}

function disableAllButtons(){

    let buttons = document.getElementsByTagName('button');

    for(let i = 0; i < buttons.length; i++){

        buttons[i].disabled = true;
    }
}

function enableAllButtons(){

    let buttons = document.getElementsByTagName('button');

    for(let i = 0; i < buttons.length; i++){

        buttons[i].disabled = false;
    }
}

function frontendBusy(){

    frontendIsBusy = true;
    disableAllButtons();
    Frontend.busy();
}

function frontendIdle(){

    frontendIsBusy = false;
    enableAllButtons();
    Frontend.idle();
}

async function drawMemoryTables(){

    // Initialize the memory view. We must detect device first!

    let family = devFile.families[await PK2.getActiveFamily()];
    addressIncrement = family.addressIncrement;
    let rowAddressIncrement = 0;
    let hexColumns = dataColumns;
    let partList = devFile.partsList[await PK2.getActivePart()];
    let rowCount = partList.programMem / hexColumns;
    if(partList.programMem % hexColumns > 0){
        rowCount++;
    }
    rowAddressIncrement = addressIncrement * dataColumns;
    let maxAddress = rowCount * rowAddressIncrement -1;

    let addressFormat = (address) => toHex(address, 3);
    if(family.blankValue > 0xFFFFFF){
        // PIC32 - add rows for memory section titles
        addressFormat = (address) => toHex(address, 8);
    } else if(maxAddress > 0xFFFF){

        addressFormat = (address) => toHex(address, 5);
    } else if(maxAddress > 0xFFF){

        addressFormat = (address) => toHex(address, 4);
    }

    let dataFormat = (data) => toHex(data, 2);
    if(family.blankValue > 0xFF){

        dataFormat = (data) => toHex(data, 3);
    }
    if(family.blankValue > 0xFFF){

        dataFormat = (data) => toHex(data, 4);
    }
    if(family.blankValue > 0xFFFF){

        dataFormat = (data) => toHex(data, 6);
    }
    if(family.blankValue > 0xFFFFFF){

        dataFormat = (data) => toHex(data, 8);
    }

    deviceBuffers = await PK2.getDeviceBuffers();

    let address = 0;

    // empty the table
    programMemoryView.innerHTML = '';

    for(let row = 0, idx = 0; row < rowCount-1; row++){

        let rowElement = document.createElement('tr');
        rowElement.setAttribute('id', `row${row}`);
        programMemoryView.appendChild(rowElement);

        let addressElement = document.createElement('td');
        addressElement.setAttribute('id', `address${row}`);
        addressElement.innerHTML = addressFormat(address);
        rowElement.appendChild(addressElement);

        for(let col = 0; col < hexColumns; col++){

            let dataElement = document.createElement('td');
            dataElement.setAttribute('id', `data${idx}`);
            dataElement.innerHTML = dataFormat(deviceBuffers.programMemory[idx++]);
            rowElement.appendChild(dataElement);
        }

        address += rowAddressIncrement;
    }

    // Last row
    let lastrow = rowCount - 1;
    let rowIdx = lastrow * hexColumns;
    let lastCol = partList.programMem % hexColumns;
    if(lastCol == 0){
        lastCol = hexColumns;
    }

    let rowElement = document.createElement('tr');
    rowElement.setAttribute('id', `row${lastrow}`);
    programMemoryView.appendChild(rowElement);

    let addressElement = document.createElement('td');
    addressElement.setAttribute('id', `address${lastrow}`);
    addressElement.innerHTML = addressFormat(address);
    rowElement.appendChild(addressElement);

    for(let col = 0; col < lastCol; col++){
    
        let dataElement = document.createElement('td');
        dataElement.setAttribute('id', `data${rowIdx}`);
        dataElement.innerHTML = dataFormat(deviceBuffers.programMemory[rowIdx++]);
        rowElement.appendChild(dataElement);
    }

    // Initialize eeprom memory view. Assume PIC18F45K22 family has eeprom memory

    rowAddressIncrement = family.eeMemAddressIncrement;
    addressIncrement = rowAddressIncrement;
    //dataColumns = eepromDataColumns; // assume the PIC18F45K22 family has blank value of 0xFFFF
    rowCount = partList.eeMem / eepromDataColumns;
    rowAddressIncrement *= eepromDataColumns;
    hexColumns = eepromDataColumns;

    maxAddress = rowCount * rowAddressIncrement -1;

    addressFormat = (address) => toHex(address, 2);
    if(maxAddress > 0xFF){

        addressFormat = (address) => toHex(address, 3);
    }
    if(maxAddress > 0xFFF){

        addressFormat = (address) => toHex(address, 4);
    }

    dataFormat = (data) => toHex(data, 2);

    if(family.eeMemAddressIncrement > 1){

        dataFormat = (data) => toHex(data, 4);
    }

    if(family.blankValue === 0xFFF){

        dataFormat = (data) => toHex(data, 3);
    }

    address = 0;

    // empty the table
    eepromMemoryView.innerHTML = '';

    for(let row = 0, idx = 0; row < rowCount; row++){

        let rowElement = document.createElement('tr');
        rowElement.setAttribute('id', `row${row}`);
        eepromMemoryView.appendChild(rowElement);

        let addressElement = document.createElement('td');
        addressElement.setAttribute('id', `address${row}`);
        addressElement.innerHTML = addressFormat(address);
        rowElement.appendChild(addressElement);

        for(let col = 0; col < hexColumns; col++){
            
            let dataElement = document.createElement('td');
            dataElement.setAttribute('id', `data${idx}`);
            dataElement.innerHTML = dataFormat(deviceBuffers.eePromMemory[idx++]);
            rowElement.appendChild(dataElement);
        }

        address += rowAddressIncrement;
    }
    
}

window.events.onOpenHexFile( async (data) => {

    if(!data.accepted){
        return false;
    }

    let lastPart = await PK2.getActivePart();

    fileName = data.path;

    if(! await preProgrammingCheck(await PK2.getActiveFamily())){

        statusField.innerHTML = 'Device Error - hex file not loaded';
        memorySource.innerHTML = 'None.';
        importGo = false;
        return false;
    }

    let partList = devFile.partsList[await PK2.getActivePart()];
    let family = devFile.families[await PK2.getActiveFamily()];

    // clear device buffers.
    if(
        (lastPart !== await PK2.getActivePart()) || // a new part is detected
        (partList.eeMem === 0) ||  // the part has no EE Data
        true // since we dont have checkbox for view memory regions. always see memory

    ){
        await PK2.resetBuffers();

        // refresh device buffers memory in frontend
        deviceBuffers = await PK2.getDeviceBuffers();
    } // no else since we always reset everything

    let result = await ImportExportHex.importHexFile(data.path, true, true);

    switch(result){

        case Constants.FILEREAD.SUCCESS:
            statusField.innerHTML = 'Hex file successfully imported';
            memorySource.innerHTML = shortenHex(data.path);
            checkImportFile = true;
            importGo = true;
            break;

        case Constants.FILEREAD.NOCONFIG:
            statusField.innerHTML = 'Warning: No configuration words in hex file.<br>In MPLAB use File-export to save hex with config.';
            memorySource.innerHTML = shortenHex(data.path);
            checkImportFile = true;
            importGo = true;
            break;

        case Constants.FILEREAD.PARTIALCFG:
            statusField.innerHTML = 'Warning: Some configuration words not in hex file.<br>Ensure default values above right are acceptable';
            memorySource.innerHTML = shortenHex(data.path);
            checkImportFile = true;
            importGo = true;
            break;

        case Constants.FILEREAD.LARGEMEM:
            statusField.innerHTML = 'Warning: Hex File Loaded is larger than device';
            memorySource.innerHTML = shortenHex(data.path);
            checkImportFile = true;
            importGo = true;
            break;

        default:
            statusField.innerHTML = 'Error reading hex file';
            memorySource.innerHTML = 'None (Empty/Erased)';
            checkImportFile = false;
            importGo = false;
            await PK2.resetBuffers();
            break;
    }

    if(checkImportFile){

        // Get OSCCAL if need be
        if(partList.OSSCALSave){

            await PK2.setMCLRTemp(true); // assert /MCLR to prevent code execution before programming mode entered.
            await PK2.VddOn();
            await PK2.readOSSCAL();

            // refresh frontend device buffers memory
            deviceBuffers = await PK2.getDeviceBuffers();
            deviceBuffers.programMemory[deviceBuffers.programMemory.length - 1] = deviceBuffers.OSCCAL;

            // update PK2 device buffers backend
            await PK2.setDeviceBuffers(deviceBuffers);

        }

        // Get bandGap if need be
        if(partList.bandGapMask > 0){

            await PK2.setMCLRTemp(temp); // assert /MCLR to prevent code execution before programming mode entered.
            await PK2.VddOn();
            await PK2.readBandGap();

            // refresh frontend device buffers memory
            deviceBuffers = await PK2.getDeviceBuffers();
        }

        await PK2.vddOff();

        // skip adding menu items


        // refresh frontend device buffers memory
        deviceBuffers = await PK2.getDeviceBuffers();

        // refresh memory views
        let configWords = partList.configWords;
        await refreshProgramMemoryView();
        await refreshEEPROMMemoryView();
        await refreshChecksumView();
        refreshConfigWordsView(configWords);
        await refreshUserIdsView();


        return checkImportFile;
    }



});

window.events.onDetectDevice( async () => {

    frontendBusy();

    devFile = await PK2.getDeviceFile();

    await PK2.resetBuffers();

    result = await detectPICKit2();

    if(!result){
        statusField.innerHTML = 'Device not found';
        alert('Error detecting PICkit2');
        return false;
    }

    await PK2.exitUARTMode(); // just in case we are still in UART mode
    await PK2.vddOff();
    await PK2.setVddVoltage(3.3, 0.85);
    await PK2.setProgrammingSpeed(0);

    let voltages = await PK2.readPICkitVoltages();

    if(voltages.status){
        
        picKitVdd.innerHTML = `${voltages.vdd.toFixed(2)}`;
        picKitVpp.innerHTML = `${voltages.vpp.toFixed(2)}`;
    } else {
        alert('Error reading PICkit2 voltages');
    }

    deviceName.innerHTML = `Detecting Device...`;
    if(await PK2.detectDevice(Constants.SEARCH_ALL_FAMILIES, true, false)){
        deviceName.innerHTML = await PK2.getDeviceName();
        deviceDetected = true;
        statusField.innerHTML = 'Ready';
    } else {    
        deviceName.innerHTML = 'No Device Detected';
        memorySource.innerHTML = 'None (Empty/Erased)';
    }

    deviceBuffers = await PK2.getDeviceBuffers();

    let partList = devFile.partsList[await PK2.getActivePart()];

    await checkForPowerErrors();

    let configWords = partList.configWords;

    // if memory view is empty means on first load device was not detected and thus memory tables not rendered
    if(programMemoryView.children.length === 0 || eepromMemoryView.children.length === 0){

        await drawMemoryTables();
    }

    // update GUI
    await refreshProgramMemoryView();
    await refreshEEPROMMemoryView();
    refreshConfigWordsView(configWords);
    await refreshChecksumView();
    await refreshUserIdsView();

    frontendIdle();

});

window.addEventListener('DOMContentLoaded', async () => {

    // Fields
    pickitDetected = document.getElementById('pickitDetected');
    firmwareVersion = document.getElementById('firmwareVersion');
    picKitVpp = document.getElementById('pickitVpp');
    picKitVdd = document.getElementById('pickitVdd');
    deviceName = document.getElementById('deviceName');
    configurationWords = document.getElementById('configurationWords');
    checksumField = document.getElementById('checksum');
    userIdsField = document.getElementById('userIds');
    programMemoryView = document.getElementById('programMemoryView');
    statusField = document.getElementById('status');
    progressBar = document.querySelector('#progressBar .progress-bar');
    memorySource = document.getElementById('memorySource');
    eepromMemoryView = document.getElementById('eepromMemoryView');

    // Buttons
    let btnRead = document.getElementById('btnRead');
    let btnWrite = document.getElementById('btnWrite');
    let btnErase = document.getElementById('btnErase');
    let btnVerify = document.getElementById('btnVerify');
    let btnBlankCheck = document.getElementById('btnBlankCheck');

    btnRead.addEventListener('click', async () => {
   
        frontendBusy();
        await deviceRead();
        frontendIdle();

    });

    btnWrite.addEventListener('click', async () => {

        frontendBusy();
        await deviceWrite();
        frontendIdle();
    });


    btnVerify.addEventListener('click', async () => {

        frontendBusy();
        await deviceVerify(false, 0, false);
        frontendIdle();

    });

    btnErase.addEventListener('click', async () => {

        frontendBusy();
        await deviceEraseAll(false, []);
        frontendIdle();

    });

    btnBlankCheck.addEventListener('click', async () => {
        
        frontendBusy();
        await deviceBlankCheck();
        frontendIdle();
    });

    let result = await PK2.readDeviceFile('PK2DeviceFile.dat');
    if(!result){
        alert('Error reading device file');
        return false;
    }

    devFile = await PK2.getDeviceFile();

    await PK2.resetBuffers();

    result = await detectPICKit2();

    if(!result){
        alert('Error detecting PICkit2');
        return false;
    }

    await PK2.exitUARTMode(); // just in case we are still in UART mode
    await PK2.vddOff();
    await PK2.setVddVoltage(3.3, 0.85);
    await PK2.setProgrammingSpeed(0);

    let voltages = await PK2.readPICkitVoltages();

    if(voltages.status){
        
        picKitVdd.innerHTML = `${voltages.vdd.toFixed(2)}`;
        picKitVpp.innerHTML = `${voltages.vpp.toFixed(2)}`;
    } else {
        alert('Error reading PICkit2 voltages');
    }

    deviceName.innerHTML = `Detecting Device...`;
    if(await PK2.detectDevice(Constants.SEARCH_ALL_FAMILIES, true, false)){
        deviceName.innerHTML = await PK2.getDeviceName();
        deviceDetected = true;
        statusField.innerHTML = 'Ready';
    } else {    
        deviceName.innerHTML = 'No Device Detected';
    }

    deviceBuffers = await PK2.getDeviceBuffers();

    await drawMemoryTables();

});

setInterval(async () => {

    if(!deviceDetected)
        return;

    try {

        if(frontendIsBusy){
            return;
        }
    
        await checkForPowerErrors();
    
        let voltages = await PK2.readPICkitVoltages();
    
        if(voltages.status){
    
            picKitVdd.innerHTML = `${voltages.vdd.toFixed(2)}`;
            picKitVpp.innerHTML = `${voltages.vpp.toFixed(2)}`;
        }
    }catch(err){

        console.log('Error in setInterval()');
        console.log(err);
    }
    


}, 5000);

async function sleep(msec){

    return new Promise(resolve => setTimeout(resolve, msec));
}

async function detectPICKit2(){

    let result = await PK2.detectPICkit2Device();

    if(result.status){
        pickitDetected.innerHTML = 'PICkit2 Detected';
        firmwareVersion.innerHTML = `${result.firmwareVersion}`;

        let unitID = await PK2.unitIDRead();
        pickitDetected.innerHTML += ` - ID = ${unitID}`;

        return true;
    } else {
        // PK2 not detected
        pickitDetected.innerHTML = 'PICkit2 Not Detected';
        statusField.innerHTML = 'PICkit2 disconnected';
        return false;
    }
}

async function checkForPowerErrors(){

    await sleep(100); // sleep a bit to allow time for error to develop

    let result = await PK2.powerStatus();
    if(result === Constants.PICKIT2PWR.VDDERROR){
        alert("PICkit 2 VDD voltage level error.\nCheck target & retry operation.");
    } else if(result === Constants.PICKIT2PWR.VPPERROR){
        alert("PICkit 2 VPP voltage level error.\nCheck target & retry operation.");
    } else if(result === Constants.PICKIT2PWR.VDDVPPERRORS){
        alert("PICkit 2 VDD and VPP voltage level errors.\nCheck target & retry operation.");
    } else if(result === Constants.PICKIT2PWR.VDD_ON){
        return false;
    } else if(result === Constants.PICKIT2PWR.VDD_OFF){
        return false;
    }
    
    return true;

}

async function lookForPoweredTarget(){

    // we are allways using fast programming
    PK2.setProgrammingSpeed(0);

    // we always auto detect the target
    let result = await PK2.checkTargetPower();

    if(result.status === Constants.PICKIT2PWR.SELFPOWERED){
        return true;
    } else {
        return false;
    }
}

async function preProgrammingCheck(familyIdx){

    let detectResult = await detectPICKit2();
    if(! detectResult){
        return false;
    }

    if(await checkForPowerErrors()){
        return false;
    }

    await lookForPoweredTarget();

    let family = devFile.families[familyIdx];
    let partList = devFile.partsList[await PK2.getActivePart()];

    if(family.partDetect){
        if(! await PK2.detectDevice(family.familyID, false, false)){
            alert("No Device Detected");
            deviceName.innerHTML = 'No Device Detected';
            deviceDetected = false;
            return false;
        }
    } else {

        await PK2.setMCLRTemp(true); // assert /MCLR to prevent code execution before programming mode entered.
        await PK2.setVDDVoltage(partList.vddMax, 0.85); // ensure voltage set
        await PK2.VddOn();
        await PK2.runScript(Constants.PROG_ENTRY,1);
        await sleep(300); // give some delay for error to develop
        await PK2.runScript(Constants.PROG_EXIT,1);

        // since we dont have checkbox for control Vdd, asume is off
        await PK2.vddOff();
        if(await checkForPowerErrors()){
            return false;
        }

    }

    PK2.setVddVoltage(partList.vddMax, 0.85); // ensure voltage set to exepected value

    return true;
}

async function refreshEEPROMMemoryView(){

    let partList = devFile.partsList[await PK2.getActivePart()];
    let family = devFile.families[await PK2.getActiveFamily()];

    if(partList.eeMem > 0){
        
        let hexColumns = eepromDataColumns;
        let rowCount = partList.eeMem / eepromDataColumns;

        let dataFormat = (data) => toHex(data, 2);

        if(family.eeMemAddressIncrement > 1){

            dataFormat = (data) => toHex(data, 4);
        }

        if(family.blankValue === 0xFFF){

            dataFormat = (data) => toHex(data, 3);
        }

        for(let row = 0; row < rowCount; row++){

            for(let col = 0; col < hexColumns; col++){

                let idx = row * hexColumns + col;
                eepromMemoryView.rows[row].cells[col + 1].innerHTML = dataFormat(deviceBuffers.eePromMemory[idx]);
            }
        }

    }

}

async function refreshProgramMemoryView(){

    let partList = devFile.partsList[await PK2.getActivePart()];
    let family = devFile.families[await PK2.getActiveFamily()];

    let hexColumns = dataColumns;
    let rowCount = partList.programMem / hexColumns;
    if(partList.programMem % hexColumns > 0){
        rowCount++;
    }

    let dataFormat = (data) => toHex(data, 2);
    if(family.blankValue > 0xFF){

        dataFormat = (data) => toHex(data, 3);
    }
    if(family.blankValue > 0xFFF){

        dataFormat = (data) => toHex(data, 4);
    }
    
    if(family.blankValue > 0xFFFF){

        dataFormat = (data) => toHex(data, 6);
    }
    if(family.blankValue > 0xFFFFFF){

        dataFormat = (data) => toHex(data, 8);
    }

    for(let row = 0; row < rowCount-1; row++){

        for(let col = 0; col < hexColumns; col++){
            
            let idx = row * hexColumns + col;
            programMemoryView.children[row].children[col+1].innerHTML = dataFormat(deviceBuffers.programMemory[idx]);
        }

        
    }

    // Last row
    let lastrow = rowCount-1;
    let rowIdx = lastrow * hexColumns;
    let lastCol = partList.programMem % hexColumns;
    if(lastCol == 0){
        lastCol = hexColumns;
    }

    for(let col = 0; col < lastCol; col++){

        programMemoryView.children[lastrow].children[col+1].innerHTML = dataFormat(deviceBuffers.programMemory[rowIdx++]);
    }
}

async function getEEBlank(){

    let eeBlank = 0xFF;
    let family = devFile.families[await PK2.getActiveFamily()];
    if(family.eeMemAddressIncrement > 1){

        eeBlank = 0xFFFF;
    }
    if(family.blankValue === 0xFFF){

        eeBlank = 0xFFF;
    }
    return eeBlank;
}

async function readEEPROM(){

    statusField.innerHTML = 'Reading EEPROM...';

    await PK2.runScript(Constants.PROG_ENTRY,1);

    let partList = devFile.partsList[await PK2.getActivePart()];
    let family = devFile.families[await PK2.getActiveFamily()];

    if(partList.eeRdPrepScript > 0){

        if(family.eeMemHexBytes === 4){
            // 16-bit parts
            await PK2.downloadAddress3((partList.eeAddr / 2) && 0xFFFFFFFF);
        } else {
            await PK2.downloadAddress3(0);
        }

        PK2.runScript(Constants.EE_RD_PREP,1);
    }

    let bytesPerWord = family.eeMemBytesPerWord;
    let scriptRunsToFillUpload = Constants.UPLOAD_BUFFER_SIZE / (partList.eeRdLocations * bytesPerWord);   
    let wordsPerLoop = scriptRunsToFillUpload * partList.eeRdLocations;
    let wordsRead = 0;

    let eeBlank = await getEEBlank();

    progressBar.style.width = '0%'; // reset bar

    deviceBuffers = await PK2.getDeviceBuffers();
    
    let maxProgress = partList.eeMem;
    let upploadBuffer;

    do {

        let dataL = await PK2.runScriptUploadNoLen2(Constants.EE_RD, scriptRunsToFillUpload);
        let dataH = await PK2.getUpload();

        upploadBuffer = [...dataL, ...dataH];
        let uploadIndex = 0;

        for(let word = 0; word < wordsPerLoop; word++){

            let bite = 0;
            let memWord = (upploadBuffer[uploadIndex + bite++] & 0xFFFFFFFF) >>> 0;

            if(bite < bytesPerWord){

                memWord |= ((upploadBuffer[uploadIndex + bite++] << 8) & 0xFFFFFFFF) >>> 0;
            }

            uploadIndex += bite;

            // shift if necessary
            if(family.progMemShift > 0){

                memWord = (memWord >>> 1) & eeBlank;
            }

            deviceBuffers.eePromMemory[wordsRead++] = memWord;

            if(wordsRead >= partList.eeMem){
                break;
            }
        }

        // update progressbar
        progressBar.style.width = (wordsRead / maxProgress) * 100 + '%';

    }while(wordsRead < partList.eeMem);

    PK2.runScript(Constants.PROG_EXIT,1);
}

function refreshConfigWordsView(numWords){

    let cfgWords = '';

    for(let word = 0; word < numWords; word++){

        cfgWords += toHex(deviceBuffers.configWords[word], 4);
        if(word < numWords-1){
            cfgWords += ' ';
        }
    }

    configurationWords.innerHTML = cfgWords;
}

async function refreshChecksumView(){

    let checksum = await PK2.computeChecksum();

    checksumField.innerHTML = toHex(checksum, 4);
}

async function refreshUserIdsView(){

    let userIds = '';
    let partList = devFile.partsList[await PK2.getActivePart()];

    for(let i = 0; i < partList.userIDWords; i++){

        userIds += toHex(deviceBuffers.userIDs[i], 2);
        if(i < partList.userIDWords-1){
            userIds += ' ';
        }
    }

    userIdsField.innerHTML = userIds;
}

async function verifyConfig(configWords, configLocation){

    // verify configuration

    let partList = devFile.partsList[await PK2.getActivePart()];
    let family = devFile.families[await PK2.getActiveFamily()];

    if((configWords > 0) && (configLocation > partList.programMem)){

        // Don't read config words for any part where they are stored in program memory.
        statusField.innerHTML = 'Reading Configuration...';

        await PK2.runScript(Constants.PROG_ENTRY,1);
        await PK2.runScript(Constants.CONFIG_RD,1);
        let data = await PK2.uploadData();
        await PK2.runScript(Constants.PROG_EXIT,1);

        let bufferIndex = 1; // reports starts on index 1, which is #bytes uploaded

        for(let word = 0; word < configWords; word++){

            let config = (data[bufferIndex++] & 0xFFFFFFFF) >>> 0;
            config |= ((data[bufferIndex++] << 8) & 0xFFFFFFFF) >>> 0;

            if(family.progMemShift > 0){

                config = (config >>> 1) & family.blankValue;
            }

            config &= partList.configMasks[word];

            let configExpected = deviceBuffers.configWords[word] & partList.configMasks[word];
            
            /**
             * We are not using code protect. So skip it
            if(word === partList.cpConfig -1){

            }*/
            if(config !== configExpected){

                await PK2.runScript(Constants.PROG_EXIT,1);// <-- forgotten in original code?
                await PK2.vddOff();

                statusField.innerHTML = 'Verification of configuration failed.';

                return false;
            }
        }
    }

    return true;

}

async function checkEraseVoltage(checkRowErase){

    let voltages = await PK2.readPICkitVoltages();

    if(!voltages.status){
        alert('PIcKit2 voltages could not be read. Please check connection and try again.');
        return false;
    }

    let partList = devFile.partsList[await PK2.getActivePart()];
    let family = devFile.families[await PK2.getActiveFamily()];

    if((voltages.vdd + 0.05) < partList.vddErase){

        if(checkRowErase && partList.debugRowEraseScript > 0){
            // if row erase script exists
            return false; // voltage doesn't support row erase
        }
    }

    return true;
}

async function verifyOSCCAL(){

    if(! await PK2.validateOSSCAL() && verifyOSCCALValue){
        
        if(!confirm("Invalid OSCCAL value detected:\nTo abort, click 'Cancel'\nTo continue, click 'OK'")){
            
            await PK2.vddOff();
            statusField.innerHTML = 'Operation Aborted';
            return false;
        }
    }

    return true;
}

async function writeConfigInsideProgramMem(){

    await PK2.runScript(Constants.PROG_ENTRY,1);

    let partList = devFile.partsList[await PK2.getActivePart()];
    let family = devFile.families[await PK2.getActiveFamily()];
    
    let lastBlock = deviceBuffers.programMemory.length - partList.progMemWords;

    if(partList.progMemWrPrepScript !== 0){

        await PK2.downloadAddress3(lastBlock * family.addressIncrement);
        await PK2.runScript(Constants.PROGMEM_WR_PREP,1);
    }

    let downloadBuffer = new Array(Constants.DOWNLOAD_BUFFER_SIZE).fill(0);
    let downloadIndex = 0;

    for(let word = 0; word < partList.progMemWrWords; word++){

        let memWord = deviceBuffers.programMemory[lastBlock++];
        if(family.progMemShift > 0){

            memWord <<= 1;
        }

        downloadBuffer[downloadIndex++] = memWord & 0xFF;

        for(let bite = 1; bite < family.bytesPerLocation; bite++){

            memWord >>>= 8;
            downloadBuffer[downloadIndex++] = memWord & 0xFF;
        }
    }

    // download data
    let dataIndex = await PK2.dataClrAndDownload(downloadBuffer, 0);

    while(dataIndex < downloadIndex){

        dataIndex = await PK2.dataDownload(downloadBuffer, dataIndex, downloadIndex);
    }

    await PK2.runScript(Constants.PROGMEM_WR,1);
    await PK2.runScript(Constants.PROG_EXIT,1);

}

async function eepromCheckBusErrors(){

    let partList = devFile.partsList[await PK2.getActivePart()];

    if(await PK2.busErrorCheck()){

        await PK2.runScript(Constants.PROG_EXIT,1);
        await PK2.vddOff();

        if(partList.configMasks[Constants.PROTOCOL_CFG] === Constants.UNIO_BUS){

            statusField.innerHTML = 'UNI/O Bus Error (NoSAK) - Aborted.<br>';
        } else {
                
            statusField.innerHTML = 'I2C Bus Error (No Acknowledge) - Aborted.<br>';
        }

        return true;
    }

    return false;
}

async function deviceRead(){

    if(!(await preProgrammingCheck(await PK2.getActiveFamily()))){

        return; // abort
    }

    // we are not family PIC32, so skip reading it

    statusField.innerHTML = 'Reading Device...';

    await PK2.setMCLRTemp(true); // assert /MCLR to prevent code execution before programming mode entered.
    await PK2.VddOn();

    statusField.innerHTML = 'Program Memory...';

    await PK2.runScript(Constants.PROG_ENTRY,1);

    let partList = devFile.partsList[await PK2.getActivePart()];
    let family = devFile.families[await PK2.getActiveFamily()];

    if(partList.progMemAddrSetScript !== 0 && partList.progMemAddrBytes !== 0){

        // skip checking if family is EEPROM.
        await PK2.downloadAddress3(0);
        await PK2.runScript(Constants.PROGMEM_ADDRSET,1);
    }

    let bytesPerWord = family.bytesPerLocation;
    let scriptRunsToFillUpload = Constants.UPLOAD_BUFFER_SIZE / (partList.progMemRdWords * bytesPerWord);
    let wordsPerLoop = scriptRunsToFillUpload * partList.progMemRdWords;
    let wordsRead = 0;

    deviceBuffers = await PK2.getDeviceBuffers();
    
    // progressbar
    progressBar.style.width = '0%'; // reset bar
    let maxProgress = (partList.programMem) & 0xFFFFFFFF;

    
    let uploadBuffer;

    do {

        // skip checking if family is EEPROM.

        let dataL = await PK2.runScriptUploadNoLen2(Constants.PROGMEM_RD, scriptRunsToFillUpload);
        let dataH = await PK2.getUpload();

        uploadBuffer = [...dataL, ...dataH];
        let uploadIndex = 0;

        for(let word = 0; word < wordsPerLoop; word++){

            let bite = 0;
            let memWord = (uploadBuffer[uploadIndex + bite++] & 0xFFFFFFFF) >>> 0;

            if(bite < bytesPerWord){
                memWord |= ((uploadBuffer[uploadIndex + bite++] << 8) & 0xFFFFFFFF) >>> 0;
            }

            if(bite < bytesPerWord){
                memWord |= ((uploadBuffer[uploadIndex + bite++] << 16) & 0xFFFFFFFF) >>> 0;
            }

            if(bite < bytesPerWord){
                memWord |= ((uploadBuffer[uploadIndex + bite++] << 24) & 0xFFFFFFFF) >>> 0;
            }

            uploadIndex += bite;

            //shift if necessary
            if(family.progMemShift > 0){

                memWord =  (memWord >>> 1) & family.blankValue
            }

            deviceBuffers.programMemory[wordsRead++] = memWord;

            // Update here table cell


            if(wordsRead === partList.programMem){
                break; // for cases where ProgramMemSize/WordPerLoop != 0
            }

            if( (wordsRead % 0x8000) === 0
                && family.blankValue > 0xFFFF
                && partList.progMemAddrSetScript !== 0
                && partList.progMemAddrBytes !== 0){
                // PIC24 must update TBLPAG
                await PK2.downloadAddress3(0x10000 * (wordsRead / 0x8000));
                await PK2.runScript(Constants.PROGMEM_ADDRSET,1);
                break;
            }
        }

        // update progressbar
        progressBar.style.width = (wordsRead / maxProgress) * 100 + '%';
        
        
    } while(wordsRead < partList.programMem);

    await PK2.runScript(Constants.PROG_EXIT,1);

    // skip swap "endian-ness" sice is only for EEPROM family

    // update deviceBuffers of backend PK2
    await PK2.setDeviceBuffers(deviceBuffers);

    await refreshProgramMemoryView();

    // read EEPROM

    if(partList.eeMem > 0){

        await readEEPROM();
        // update deviceBuffers of backend PK2
        await PK2.setDeviceBuffers(deviceBuffers);

        refreshEEPROMMemoryView();
    }

    // read userIDs
    if(partList.userIDWords > 0){

        statusField.innerHTML = 'Reading UserIDs...';

        await PK2.runScript(Constants.PROG_ENTRY,1);

        if(partList.userIDRdPrepScript > 0){

            await PK2.runScript(Constants.USERID_RD_PREP,1);
        }

        bytesPerWord = family.userIDBytes;
        wordsRead = 0;
        let bufferIndex = 0;

        let dataL = await PK2.runScriptUploadNoLen(Constants.USERID_RD, 1);
        let dataH = [];

        if((partList.userIDWords * bytesPerWord) > Constants.USB_REPORTLENGTH){

            dataH = await PK2.uploadDataNoLen();
            uploadBuffer = [...dataL, ...dataH];
        } else {
            
            uploadBuffer = dataL;
        }

        await PK2.runScript(Constants.PROG_EXIT,1);

        do {

            let bite = 0;
            let memWord = (uploadBuffer[bufferIndex + bite++] & 0xFFFFFFFF) >>> 0;

            if(bite < bytesPerWord){
                memWord |= ((uploadBuffer[bufferIndex + bite++] << 8) & 0xFFFFFFFF) >>> 0;
            }

            if(bite < bytesPerWord){
                memWord |= ((uploadBuffer[bufferIndex + bite++] << 16) & 0xFFFFFFFF) >>> 0;
            }

            if(bite < bytesPerWord){
                memWord |= ((uploadBuffer[bufferIndex + bite++] << 24) & 0xFFFFFFFF) >>> 0;
            }

            bufferIndex += bite;

            //shift if necessary
            if(family.progMemShift > 0){

                memWord =  (memWord >>> 1) & family.blankValue
            }

            deviceBuffers.userIDs[wordsRead++] = memWord;

        }while(wordsRead < partList.userIDWords);


    }

    // read configuration
    let configLocation = (partList.configAddr / family.progMemHexBytes) & 0xFFFFFFFF;
    let configWords = partList.configWords;

    if((configWords > 0) && (configLocation >= partList.programMem)){

        // don't read config words for any part where they are stored in program memory
        statusField.innerHTML = 'Reading Config...';

        deviceBuffers = await PK2.readConfigOutsideProgMem();

        // save bandgap if necessary
        if(partList.bandGapMask > 0){

            deviceBuffers.bandGap = deviceBuffers.configWords[0] & partList.bandGapMask;
        }

    } else if(configWords > 0){

        // pull them out of program memory
        statusField.innerHTML = 'Reading Config...';
        
        for(let word = 0; word < configWords; word++){

            deviceBuffers.configWords[word] = deviceBuffers.programMemory[configLocation + word];
        }
    }

    // update deviceBuffers of backend PK2
    await PK2.setDeviceBuffers(deviceBuffers);

    refreshConfigWordsView(configWords);

    // read OSCCAL if exists
    if(partList.OSSCALSave){

        await PK2.readOSSCAL();

    }

    // refresh deviceBuffers of backend PK2
    deviceBuffers = await PK2.getDeviceBuffers();

    await PK2.vddOff();

    refreshChecksumView();
    refreshUserIdsView();


    statusField.innerHTML = 'Reading Done.';

    memorySource.innerHTML = `Read from ${partList.partName}`;



}

async function deviceVerify(writeVerify, lastLocation, forceEEVerify){

    if(!writeVerify){
        // only check if "stand-alone" verify
        if(! await preProgrammingCheck(await PK2.getActiveFamily())){
            
            return false; // abort
        }
    }

    // Skip checking family is PIC32

    statusField.innerHTML = 'Verifying Device...';

    // Skip checking if family is Keeloq
    await PK2.setMCLRTemp(true);
    await PK2.VddOn();

    let partList = devFile.partsList[await PK2.getActivePart()];
    let family = devFile.families[await PK2.getActiveFamily()];
    deviceBuffers = await PK2.getDeviceBuffers();
    let uploadBuffer;

    // compute configuration information
    let configLocation = partList.configAddr / family.progMemHexBytes;
    let configWords = partList.configWords;
    let endOfBuffer = deviceBuffers.programMemory.length - 1;

    if(writeVerify){
        // unless it's a write-verify
        endOfBuffer = lastLocation;
    }

    // we always check program memory
    statusField.innerHTML = 'Verifying Program Memory...';

    await PK2.runScript(Constants.PROG_ENTRY,1);

    if(
        (partList.progMemAddrSetScript !== 0) &&
        (partList.progMemAddrBytes !== 0)
    ){
        // family is not EEPROM
        await PK2.downloadAddress3(0);
        await PK2.runScript(Constants.PROGMEM_ADDRSET,1);
    }

    let bytesPerWord = family.bytesPerLocation;
    let scriptRunsToFillUpload = (Constants.UPLOAD_BUFFER_SIZE / (partList.progMemRdWords * bytesPerWord)) & 0xFFFFFFFF;
    let wordsPerLoop = scriptRunsToFillUpload * partList.progMemRdWords;
    let wordsRead = 0;

    if(partList.progMemRdWords === (endOfBuffer +1)){
        // very small memory sizes (like HCS parts)
        scriptRunsToFillUpload = 1;
        wordsPerLoop = endOfBuffer + 1;
    }

    progressBar.style.width = '0%';
    let maxProgress = endOfBuffer;

    let learnMode = await PK2.getLearnMode();

    do {

        // skip checking is EEPROM family

        let dataL = await PK2.runScriptUploadNoLen2(Constants.PROGMEM_RD, scriptRunsToFillUpload);
        let dataH = await PK2.getUpload();

        uploadBuffer = [...dataL, ...dataH];
        
        let uploadIndex = 0;

        for(let word = 0; word < wordsPerLoop; word++){

            let bite = 0;
            let memWord = (uploadBuffer[uploadIndex + bite++] & 0xFFFFFFFF) >>> 0;

            if(bite < bytesPerWord){
                memWord |= ((uploadBuffer[uploadIndex + bite++] << 8) & 0xFFFFFFFF) >>> 0;
            }

            if(bite < bytesPerWord){
                memWord |= ((uploadBuffer[uploadIndex + bite++] << 16) & 0xFFFFFFFF) >>> 0;
            }

            if(bite < bytesPerWord){
                memWord |= ((uploadBuffer[uploadIndex + bite++] << 24) & 0xFFFFFFFF) >>> 0;
            }

            uploadIndex += bite;

            //shift if necessary
            if(family.progMemShift > 0){
                    
                memWord =  (memWord >>> 1) & family.blankValue
            }

            // skip family is EEPROM

            if((memWord !== deviceBuffers.programMemory[wordsRead++]) && !learnMode){

                await PK2.runScript(Constants.PROG_EXIT,1);
                await PK2.vddOff();

                if(!writeVerify){
                    // family is not EEPROM
                    statusField.innerHTML = 'Verify Failed at Address: 0x';
                } else {
                    statusField.innerHTML = 'Programming Failed at Address: 0x';
                }

                statusField.innerHTML += toHex(--wordsRead * family.addressIncrement, 6)
                
                return false;
            }

            if(
                ((wordsRead % 0x8000) === 0) &&
                (family.blankValue > 0xFFFF) &&
                (partList.progMemAddrSetScript !== 0) &&
                (partList.progMemAddrBytes !== 0)
            ){
                // PIC24 must update TBLPAG
                await PK2.downloadAddress3(0x10000 * (wordsRead/0x8000));
                await PK2.runScript(Constants.PROGMEM_ADDRSET,1);
                break;
            }

            if(wordsRead > endOfBuffer){
                
                break; // for cases where programMemSize%WordsPerLoop !== 0
            }
        }

        progressBar.style.width = `${(wordsRead / maxProgress) * 100}%`;

    }while(wordsRead < endOfBuffer);

    await PK2.runScript(Constants.PROG_EXIT,1);

    // always check EEPROM
    if(partList.eeMem > 0){

        if(learnMode && family.progMemShift > 0){

            await PK2.metaCmd_CHANGE_CHKSM_FRMT(2);
        }

        statusField.innerHTML = 'Verifying EEPROM...';

        await PK2.runScript(Constants.PROG_ENTRY,1);

        if(partList.eeRdPrepScript > 0){

            if(family.eeMemHexBytes === 4){
                // 16-bit parts
                await PK2.downloadAddress3((partList.eeAddr / 2) & 0xFFFFFFFF);
            } else {
                await PK2.downloadAddress3(0);
            }

            await PK2.runScript(Constants.EE_RD_PREP,1);
        }

        let bytesPerLoc = family.eeMemBytesPerWord;
        let scriptRuns2FillUpload = (Constants.UPLOAD_BUFFER_SIZE / (partList.eeRdLocations * bytesPerLoc)) & 0xFFFFFFFF;
        let locPerLoop = scriptRuns2FillUpload * partList.eeRdLocations;
        let locsRead = 0;

        let eeBlank = await getEEBlank();

        progressBar.style.width = '0%';
        maxProgress = partList.eeMem;

        do {

            let dataL = await PK2.runScriptUploadNoLen2(Constants.EE_RD, scriptRuns2FillUpload);
            let dataH = await PK2.getUpload();

            uploadBuffer = [...dataL, ...dataH];
            let uploadIndex = 0;

            for(let word = 0; word < locPerLoop; word++){

                let bite = 0;
                let memWord = (uploadBuffer[uploadIndex + bite++] & 0xFFFFFFFF) >>> 0;

                if(bite < bytesPerLoc){
                    memWord |= ((uploadBuffer[uploadIndex + bite++] << 8) & 0xFFFFFFFF) >>> 0;
                }

                uploadIndex += bite;

                // shift if necessary
                if(family.progMemShift > 0){
                        
                     memWord = (memWord >>> 1) & eeBlank;
                }

                if((memWord !== deviceBuffers.eePromMemory[locsRead++]) && !learnMode){

                    await PK2.runScript(Constants.PROG_EXIT,1);
                    await PK2.vddOff();

                    if(!writeVerify){

                        statusField.innerHTML = 'Verify of EE Data Failed at Address: 0x';
                    } else {
                        statusField.innerHTML = 'Programming Failed at EE Address: 0x';
                    }

                    if(eeBlank === 0xFFFF)
                    {
                        statusField.innerHTML += toHex(--locsRead * 2, 4);
                    } else {
                        statusField.innerHTML += toHex(--locsRead, 4);
                    }

                    return false;
                }

                if(locsRead >= partList.eeMem){
                    break;
                }
            }

            progressBar.style.width = `${(locsRead / maxProgress) * 100}%`;

        }while(locsRead < partList.eeMem);

        await PK2.runScript(Constants.PROG_EXIT,1);

        if(learnMode && family.progMemShift > 0){

            await PK2.metaCmd_CHANGE_CHKSM_FRMT(1);
        }
    }

    // verify User IDs
    if(partList.userIDWords > 0){

        // When EE deselected, UserIDs are not programmed so don't try to verify
        statusField.innerHTML = 'Verifying User IDs...';

        await PK2.runScript(Constants.PROG_ENTRY,1);

        if(partList.userIDRdPrepScript > 0){

            await PK2.runScript(Constants.USERID_RD_PREP,1);
        }

        let bytesPerWord = family.userIDBytes;
        let wordsRead = 0;
        let bufferIndex = 0;

        let dataL = await PK2.runScriptUploadNoLen(Constants.USERID_RD,1);

        if((partList.userIDWords * bytesPerWord) > Constants.USB_REPORTLENGTH){

            let dataH = await PK2.uploadDataNoLen();

            uploadBuffer = [...dataL, ...dataH];
        } else {
            uploadBuffer = [...dataL];
        }

        await PK2.runScript(Constants.PROG_EXIT,1);

        do {

            let bite = 0;
            let memWord = (uploadBuffer[bufferIndex + bite++] & 0xFFFFFFFF) >>> 0;

            if(bite < bytesPerWord){

                memWord |= ((uploadBuffer[bufferIndex + bite++] << 8) & 0xFFFFFFFF) >>> 0;
            }

            if(bite < bytesPerWord){
                    
                memWord |= ((uploadBuffer[bufferIndex + bite++] << 16) & 0xFFFFFFFF) >>> 0;
            }

            if(bite < bytesPerWord){
                        
                memWord |= ((uploadBuffer[bufferIndex + bite++] << 24) & 0xFFFFFFFF) >>> 0;
            }

            bufferIndex += bite;

            // shift if necessary

            if(family.progMemShift > 0){

                memWord = (memWord >>> 1) & family.blankValue;
            }

            if(memWord !== deviceBuffers.userIDs[wordsRead++] && !learnMode){

                await PK2.runScript(Constants.PROG_EXIT,1); // <-- forgotten in original code?
                await PK2.vddOff();
                
                if(!writeVerify){

                    statusField.innerHTML = 'Verification of User IDs failed';
                } else {
                    statusField.innerHTML = 'Programming failed at User IDs';
                }

                return false;
            }

        }while(wordsRead < partList.userIDWords);
    }

    if(!writeVerify){

        // don't check config if write-verify: it isn't written yet as it may contain code protection
        if(! await verifyConfig(configWords, configLocation)){
            
            return false;
        }
    }

    await PK2.runScript(Constants.PROG_EXIT,1);

    if(!writeVerify){

        statusField.innerHTML = 'Verification Successful';
        await PK2.vddOff();
    }

    return true;
    
}

async function deviceEraseAll(forceOSSCAL, calWords){

    // skip check if family is Keeloq or Is MCP

    if(! await preProgrammingCheck(await PK2.getActiveFamily())){

        return; // abort
    }

    // skip checking if family is EEPROM

    if(! await checkEraseVoltage(false)){

        return; // abort
    }

    let partList = devFile.partsList[await PK2.getActivePart()];
    let family = devFile.families[await PK2.getActiveFamily()];

    progressBar.style.width = '0%'; // reset bar

    await PK2.setMCLRTemp(true); // assert /MCLR to prevent code execution before programming mode is entered
    await PK2.VddOn();

    // Get OSCCAL if need be

    if((partList.OSSCALSave) && !forceOSSCAL){
        // if forcing OSCCAL, don't read it; use the vale in memory

        await PK2.readOSSCAL();

        // refresh deviceBuffers in memory after reading OSCCAL
        deviceBuffers = await PK2.getDeviceBuffers();

        // verify OSCCAL
        if(! await verifyOSCCAL()){
            return;
        }

    }

    // refresh deviceBuffers in memory
    deviceBuffers = await PK2.getDeviceBuffers();

    let oscCal = deviceBuffers.OSCCAL;

    // get bandgap if need be
    if(partList.bandGapMask > 0){

        await PK2.readBandGap();

        // refresh deviceBuffers in memory after reading bandgap
        deviceBuffers = await PK2.getDeviceBuffers();
    }

    let bandGap = deviceBuffers.bandGap;

    statusField.innerHTML = 'Erasing Device...';

    // dsPIC30F5011, 5013 need configs cleared before erase
    // but don't run this script if a row erase is defined
    if(
        (partList.configMemEraseScript > 0) &&
        (partList.debugRowEraseSize === 0)
    ) {

        await PK2.runScript(Constants.PROG_ENTRY,1);

        if(partList.configWrPrepScript > 0){

            await PK2.downloadAddress3(0);
            await PK2.runScript(Constants.CONFIG_WR_PREP,1);
        }

        await PK2.executeScript(partList.configMemEraseScript);
        await PK2.runScript(Constants.PROG_EXIT,1);
    }

    await PK2.runScript(Constants.PROG_ENTRY,1);

    //skip test memory

    if(partList.chipErasePrepScript > 0){

        await PK2.runScript(Constants.ERASE_CHIP_PREP,1);
    }
    
    await PK2.runScript(Constants.ERASE_CHIP,1);
    await PK2.runScript(Constants.PROG_EXIT,1);

    await PK2.resetBuffers();

    // refresh deviceBuffers in memory after erasing
    deviceBuffers = await PK2.getDeviceBuffers();

    // restore OSCCAL if need be

    if(partList.OSSCALSave){

        deviceBuffers.OSCCAL = oscCal;

        // refresh deviceBuffers in PK backend memory
        await PK2.setDeviceBuffers(deviceBuffers);
        await PK2.writeOSSCAL();

        deviceBuffers.programMemory[deviceBuffers.programMemory.length - 1] = oscCal;

        // refresh deviceBuffers in PK backend memory
        await PK2.setDeviceBuffers(deviceBuffers);

    }

    // restore bandgap if need be
    if(partList.bandGapMask > 0){

        deviceBuffers.bandGap = bandGap;

        // refresh deviceBuffers in PK backend memory
        await PK2.setDeviceBuffers(deviceBuffers);

        await PK2.writeConfigOutsideProgMem(false, false);

        // refresh deviceBuffers from PK backend memory
        deviceBuffers = await PK2.getDeviceBuffers();

    }

    // write "erased" config words for parts that don't bulk erase configs (ex 18F6520)
    // Also do this for some parts to match MPLAB (ie PIC18J)
    if(partList.writeCfgOnErase){

        // compute configuration information
        let configLocation = (partList.configAddr / family.progMemHexBytes) >>> 0;

        let configWords = partList.configWords;
        let endOfBuffer = deviceBuffers.programMemory.length;

        let configBackups = new Array(configWords); // use because DeviceBuffers are masked & won't verify later

        if((configLocation < partList.programMem) && configWords > 0){
            // if config in program memory, set them to clear

            let orMask = 0;
            if(family.blankValue === 0xFFFF){
                // PIC18J
                orMask = 0xF000;
            } else {
                // PIC24FJ
                orMask = 0xFF0000;
            }

            for(let cfg = configWords; cfg > 0; cfg--){

                deviceBuffers.programMemory[endOfBuffer - cfg] = partList.configBlank[configWords -cfg] | orMask;
            }

            // refresh deviceBuffers in PK backend memory
            await PK2.setDeviceBuffers(deviceBuffers);
            
            await writeConfigInsideProgramMem();
        } else {

            await PK2.writeConfigOutsideProgMem(false, false);

            // refresh deviceBuffers in memory after writing config
            deviceBuffers = await PK2.getDeviceBuffers();
        }
    }

    statusField.innerHTML = 'Erase Complete';
    memorySource.innerHTML = 'None (Empty/Erased)';

    await PK2.vddOff();

    await refreshProgramMemoryView();



}

async function deviceBlankCheck(){

    // skip family is Keeloq or Is MCP

    if(! await preProgrammingCheck(await PK2.getActiveFamily())){

        return false; // abort
    }

    // skip checking if family is PIC32

    let partList = devFile.partsList[await PK2.getActivePart()];
    let family = devFile.families[await PK2.getActiveFamily()];
    let blankDevice = await PK2.getNewDeviceDataWithParams(
        partList.programMem,
        partList.eeMem,
        partList.configWords,
        partList.userIDWords,
        family.blankValue,
        family.eeMemAddressIncrement,
        family.userIDBytes,
        partList.configBlank,
        partList.configMasks[Constants.OSCCAL_MASK]
    );

    // handle situation where configs are in program memory

    let configLocation = partList.configAddr / family.progMemHexBytes;
    let configWords = partList.configWords;

    if(configLocation < partList.programMem){

        for(let i = 0; i < configWords; i++){

            let template = blankDevice.programMemory[configLocation + i] & 0xFFFF0000;

            if(family.blankValue === 0xFFFF){

                template |= 0xF000;
            }

            blankDevice.programMemory[configLocation + i] = (template | partList.configBlank[i]) >>> 0;


        }
    }

    statusField.innerHTML = 'Checking if device is blank...';

    await PK2.setMCLRTemp(true); // assert /MCLR to prevent code execution before programming mode is entered
    await PK2.VddOn();

    let uploadBuffer;

    // check program memory

    statusField.innerHTML = 'Checking program memory is blank...';

    await PK2.runScript(Constants.PROG_ENTRY,1);

    if(
        (partList.progMemAddrSetScript !== 0) &&
        (partList.progMemAddrBytes !== 0)
    ){
        // skip check family is EEPROM
        await PK2.downloadAddress3(0);
        await PK2.runScript(Constants.PROGMEM_ADDRSET,1);
    }

    let bytesPerWord = family.bytesPerLocation;
    let scriptRunsToFillUpload = Constants.UPLOAD_BUFFER_SIZE / (partList.progMemRdWords * bytesPerWord);

    let wordsPerLoop = scriptRunsToFillUpload * partList.progMemRdWords;
    let wordsRead = 0;

    progressBar.style.width = '0%';
    let maxProgress = partList.programMem;

    do {

        // skip checking family is EEPROM

        let dataL = await PK2.runScriptUploadNoLen2(Constants.PROGMEM_RD, scriptRunsToFillUpload);
        let dataH = await PK2.getUpload();

        uploadBuffer = [...dataL, ...dataH];
        let uploadIndex = 0;

        for(let word = 0; word < wordsPerLoop; word++){

            let bite = 0;
            let memWord = (uploadBuffer[uploadIndex + bite++] & 0xFFFFFFFF) >>> 0;

            if(bite < bytesPerWord){

                memWord |= (uploadBuffer[uploadIndex + bite++] << 8) >>> 0;
            }

            if(bite < bytesPerWord){

                memWord |= (uploadBuffer[uploadIndex + bite++] << 16) >>> 0;
            }

            if(bite < bytesPerWord){

                memWord |= (uploadBuffer[uploadIndex + bite++] << 24) >>> 0;
            }

            uploadIndex += bite;

            // shift if necessary

            if(family.progMemShift > 0){

                memWord = (memWord >>> 1) & family.blankValue;
            }

            // if OSCCAL save, force last word to be blank
            if(
                (partList.OSSCALSave) &&
                wordsRead === partList.programMem - 1
            ){
                memWord = family.blankValue;
            }

            if(memWord !== blankDevice.programMemory[wordsRead++]){

                await PK2.runScript(Constants.PROG_EXIT,1);
                await PK2.vddOff();

                statusField.innerHTML = `Program memory is not blank starting at address: 0x${toHex(--wordsRead * family.addressIncrement, 6)}`;
                return false;
            }

            if(wordsRead === partList.programMem){
                break; // for cases where programMemsize%wordsperLoop != 0
            }

            if(
                (wordsRead % 0x8000) === 0 &&
                (family.blankValue > 0xFFFF) &&
                (partList.progMemAddrSetScript !== 0) &&
                (partList.progMemAddrBytes !== 0)
            ){
                // PIC24 must update TBLPAG
                await PK2.downloadAddress3(0x10000 * (wordsRead / 0x8000));
                await PK2.runScript(Constants.PROGMEM_ADDRSET,1);
                break;
            }
        }

        progressBar.style.width = `${wordsRead / maxProgress * 100}%`;

    }while(wordsRead < partList.programMem);

    await PK2.runScript(Constants.PROG_EXIT,1);

    // check EEPROM
    if(partList.eeMem > 0){

        statusField.innerHTML = 'Checking EEPROM is blank...';

        await PK2.runScript(Constants.PROG_ENTRY,1);

        if(partList.eeRdPrepScript > 0){

            if(family.eeMemHexBytes === 4){
                // 16-bit parts
                await PK2.downloadAddress3((partList.eeAddr / 2) & 0xFFFFFFFF);
            } else {
                
                await PK2.downloadAddress3(0);
            }

            await PK2.runScript(Constants.EE_RD_PREP,1);
        }

        let bytesPerLoc = family.eeMemBytesPerWord;
        let eeBlank = await getEEBlank();
        let scriptRuns2FillUpload = Constants.UPLOAD_BUFFER_SIZE / (partList.eeRdLocations * bytesPerLoc);
        let locPerLoop = scriptRuns2FillUpload * partList.eeRdLocations;
        let locsRead = 0;

        progressBar.style.width = '0%';
        maxProgress = partList.eeMem;

        do {

            let dataL = await PK2.runScriptUploadNoLen2(Constants.EE_RD, scriptRuns2FillUpload);
            let dataH = await PK2.getUpload();

            uploadBuffer = [...dataL, ...dataH];

            let uploadIndex = 0;
            for(let word = 0; word <locPerLoop; word++){

                let bite = 0;
                let memWord = (uploadBuffer[uploadIndex + bite++] & 0xFFFFFFFF) >>> 0;

                if(bite < bytesPerLoc){

                    memWord |= (uploadBuffer[uploadIndex + bite++] << 8) >>> 0;
                }

                uploadIndex += bite;

                // shift if necessary

                if(family.progMemShift > 0){

                    memWord = (memWord >>> 1) & eeBlank;
                }
                locsRead++;

                if(memWord !== eeBlank){

                    await PK2.runScript(Constants.PROG_EXIT,1);
                    await PK2.vddOff();

                    statusField.innerHTML = `EEPROM is not blank starting at address: 0x`;

                    if(eeBlank === 0xFFFF){
                        statusField.innerHTML += `${(--locsRead) * 2}`;
                    } else {
                        statusField.innerHTML += `${(--locsRead)}`;
                    }

                    return false;
                }
                
                if(locsRead >= partList.eeMem){
                    break; // for cases where programMemSize%wordsperLoop != 0
                }

            }

            progressBar.style.width = `${locsRead / maxProgress * 100}%`;

        }while(locsRead < partList.eeMem);

        await PK2.runScript(Constants.PROG_EXIT,1);
    }

    // check user IDs

    if(
        (partList.userIDWords > 0) &&
        ! partList.blankCheckSkipUsrIDs
    ){

        statusField.innerHTML = 'Checking User IDs are blank...';

        await PK2.runScript(Constants.PROG_ENTRY,1);

        if(partList.userIDRdPrepScript > 0){

            await PK2.runScript(Constants.USERID_RD_PREP,1);
        }

        let bytesPerWord = family.userIDBytes;
        let wordsRead = 0;
        let bufferIndex = 0;

        let dataL = await PK2.runScriptUploadNoLen(Constants.USERID_RD,1);

        if((partList.userIDWords * bytesPerWord) > Constants.USB_REPORTLENGTH){

            let dataH = await PK2.uploadDataNoLen();
            uploadBuffer = [...dataL, ...dataH];
        } else{
                
            uploadBuffer = dataL;
        }

        await PK2.runScript(Constants.PROG_EXIT,1);

        do {

            let bite = 0;
            let memWord = (uploadBuffer[bufferIndex + bite++] & 0xFFFFFFFF) >>> 0;

            if(bite < bytesPerWord){
                    
                memWord |= ((uploadBuffer[bufferIndex + bite++] << 8) & 0xFFFFFFFF) >>> 0;
            }

            if(bite < bytesPerWord){

                memWord |= ((uploadBuffer[bufferIndex + bite++] << 16) & 0xFFFFFFFF) >>> 0;
            }

            if(bite < bytesPerWord){
                    
                memWord |= ((uploadBuffer[bufferIndex + bite++] << 24) & 0xFFFFFFFF) >>> 0;
            }

            bufferIndex += bite;

            // shift if necessary

            if(family.progMemShift > 0){

                memWord = (memWord >>> 1) & family.blankValue;
            }

            wordsRead++;

            let blank = family.blankValue;

            if(bytesPerWord === 1){

                blank &= 0xFF;
            }

            if(memWord !== blank){

                await PK2.runScript(Constants.PROG_EXIT,1); // <-- forgotten in original code?
                await PK2.vddOff();
                
                statusField.innerHTML = `User IDs are not blank`;

                return false;
            }

        }while(wordsRead < partList.userIDWords);
    }

    // blank check configuration

    if((configWords > 0) && configLocation > partList.programMem){

        // don't read config words for any part where they are stored in program memory

        statusField.innerHTML = 'Checking configuration words are blank...';

        await PK2.runScript(Constants.PROG_ENTRY,1);
        await PK2.runScript(Constants.CONFIG_RD,1);
        let data = await PK2.uploadData();
        await PK2.runScript(Constants.PROG_EXIT,1);

        let bufferIndex = 1; // report starts on index 1, which is @bytes uploaded

        for(let word = 0; word < configWords; word++){

            let config = data[bufferIndex++];
            config |= ((data[bufferIndex++] << 8) & 0xFFFFFFFF) >>> 0
            
            if(family.progMemShift > 0){

                config = (config >>> 1) & family.blankValue;
            }

            config &= partList.configMasks[word];

            let configBlank = partList.configMasks[word] & partList.configBlank[word];

            if(configBlank !== config){
                
                await PK2.vddOff();

                statusField.innerHTML = `Configuration words are not blank`;

                return false;
            }
        }
    }

    await PK2.runScript(Constants.PROG_EXIT,1);
    await PK2.vddOff();

    statusField.innerHTML = 'Device is Blank';
}

async function deviceWrite(){

    let partList = devFile.partsList[await PK2.getActivePart()];
    let family = devFile.families[await PK2.getActiveFamily()];
    let checksumPkGo = 0;

    // skip checking family is eeprom

    let useLowVoltageRowErase = false;

    if(! await preProgrammingCheck(await PK2.getActiveFamily())){

        return false; // abort
    }

    if(! await checkEraseVoltage(true)){

        if(partList.debugRowEraseScript > 0){
            // if device supports row erases, use them
            useLowVoltageRowErase = true;
        } else {
            return false; // abort
        }
    }

    // do something with gui

    let learnMode = await PK2.getLearnMode();
    if(checkImportFile && ! learnMode){

        if(await ImportExportHex.getLastWriteTime() !==  await ImportExportHex.getFileLastWriteTime(fileName)){

            statusField.innerHTML = 'Reloading hex file...';

            await sleep(300);
            if(!window.events.onOpenHexFile({path: fileName, status: true})){

                statusField.innerHTML = 'Error loading hex file: write aborted';
                return false;
            }

        }
    }

    // skip check family is PIC32

    await PK2.setMCLRTemp(true); // assert /MCLR to prevent code execution before programming mode is entered
    await PK2.VddOn();

    // check device ID in LearnMode
    if(learnMode && family.deviceIDMask > 0){

        await PK2.metaCmd_CHECK_DEVICE_ID();
    }

    // Get OSCCAL if need be
    if(partList.OSSCALSave){

        if(learnMode){
            // leave OSCCAL blank so we can rewrite it later
            deviceBuffers.programMemory[deviceBuffers.programMemory.length - 1] = family.blankValue;

            // refresh PK2 backend memory
            await PK2.setDeviceBuffers(deviceBuffers);
            // send meta command
            await PK2.metaCmd_READ_OSCCAL();
        } else {
            // normal operation
            await PK2.readOSSCAL();

            // refresh frontend memory
            deviceBuffers = await PK2.getDeviceBuffers();

            // put OSCCAL into part memory so it doesn't have to be written separately
            deviceBuffers.programMemory[deviceBuffers.programMemory.length - 1] = deviceBuffers.OSCCAL;

            // refresh PK2 backend memory
            await PK2.setDeviceBuffers(deviceBuffers);

            // verify OSCCAL
            if(! await verifyOSCCAL()){
                return false;
            }
        }
    }

    // Get bandGap if need be
    if(partList.bandGapMask > 0){

        if(learnMode){
            await PK2.metaCmd_READ_BANDGAP();
        } else {
            
            await PK2.readBandGap();

            // refresh frontend memory
            deviceBuffers = await PK2.getDeviceBuffers();
        }
    }

    // Erase Device first
    
    let reWriteEE = false;

    // awlays erase program memory
    
    if(useLowVoltageRowErase){
        // use row erases
        statusField.innerHTML = 'Erasing Part with Low Voltage Row Erase...';
        await PK2.rowEraseDevice();
    } else {
        // bulk erase
        // dsPIC30F5011, 5013 need configs cleared before erase
        // but don't run this script if a row erase is defined
        if((partList.configMemEraseScript > 0) && (partList.debugRowEraseSize === 0)){

            await PK2.runScript(Constants.PROG_ENTRY,1);
            if(partList.configWrPrepScript > 0){
                
                await PK2.downloadAddress3(0);
                await PK2.runScript(Constants.CONFIG_WR_PREP,1);
            }

            await PK2.executeScript(partList.configMemEraseScript);
            await PK2.runScript(Constants.PROG_EXIT,1);
        }

        await PK2.runScript(Constants.PROG_ENTRY,1);

        if(partList.chipErasePrepScript > 0){

            await PK2.runScript(Constants.ERASE_CHIP_PREP,1);
        }

        await PK2.runScript(Constants.ERASE_CHIP,1);
        await PK2.runScript(Constants.PROG_EXIT,1);
    }

    // since we are not using checkboxes. skip checking if they are checked and thus don't write the code

    statusField.innerHTML = 'Writing device...';

    let configInProgramSpace = false;

    // compute configuration information
    let configLocation = (partList.configAddr / family.progMemHexBytes) & 0xFFFFFFFF;

    let configWords = partList.configWords;
    let endOfBuffer = deviceBuffers.programMemory.length;

    let configBackups = new Array(configWords).fill(0); // use because deviceBuffers are masked & won0t verify later

    if((configLocation < partList.programMem) && (configWords > 0)){

        // if config in program memory, set them to clear.
        configInProgramSpace = true;
        for(let cfg = configWords; cfg > 0; cfg--){

            configBackups[cfg - 1] = deviceBuffers.programMemory[endOfBuffer - cfg];
            deviceBuffers.programMemory[endOfBuffer - cfg] = family.blankValue;
        }
    }

    //refresh PK2 backend memory
    await PK2.setDeviceBuffers(deviceBuffers);
    endOfBuffer--;

    // write program memory
    // No checkbox, so always write program memory

    statusField.innerHTML = 'Writing program memory...';

    progressBar.style.width = '0%';

    await PK2.runScript(Constants.PROG_ENTRY,1);

    if(partList.progMemWrPrepScript !== 0){
        // if prog mem address set script exists for this part
        await PK2.downloadAddress3(0);

        await PK2.runScript(Constants.PROGMEM_WR_PREP,1);
    }

    // skip checking family is Keeloq

    let wordsPerWrite = partList.progMemWrWords;
    let bytesPerWord = family.bytesPerLocation;
    let scriptRunsToUseDownload = (Constants.DOWNLOAD_BUFFER_SIZE / (wordsPerWrite * bytesPerWord)) & 0xFFFFFFFF;
    let wordsPerLoop = scriptRunsToUseDownload * wordsPerWrite;
    let wordsWritten = 0;

    // find end of used memory
    endOfBuffer = await PK2.findLastUsedInBuffer(deviceBuffers.programMemory, family.blankValue, endOfBuffer);
    
    if(((wordsPerWrite === (endOfBuffer +1)) || (wordsPerLoop > (endOfBuffer +1))) && !learnMode ){

        // very small memory sizes (like HCS parts)
        scriptRunsToUseDownload = 1;
        wordsPerLoop = wordsPerWrite;
    }
    // align end on next loop boundary
    let writes = ((endOfBuffer + 1) / wordsPerLoop) & 0xFFFFFFFF;
    if(((endOfBuffer + 1) % wordsPerLoop) > 0){
        writes++;
    }
    endOfBuffer = writes * wordsPerLoop;

    let maxProgress = endOfBuffer;

    let downloadBuffer = new Array(Constants.DOWNLOAD_BUFFER_SIZE).fill(0);

    do {

        let downloadIndex = 0;

        for(let word = 0; word < wordsPerLoop; word++){

            if(wordsWritten === endOfBuffer){

                break; // for cases where programMemSize%wordsPerLoop != 0
            }

            let memWord = deviceBuffers.programMemory[wordsWritten++];

            if(family.progMemShift > 0){
                memWord = memWord << 1;
            }

            downloadBuffer[downloadIndex++] = (memWord & 0xFF) >>> 0;
            checksumPkGo += (memWord & 0xFF) >>> 0;

            for(let bite = 1; bite < bytesPerWord; bite++){

                memWord = memWord >>> 8;
                downloadBuffer[downloadIndex++] = (memWord & 0xFF) >>> 0;
                checksumPkGo += (memWord & 0xFF) >>> 0;
            }
        }
        // download data

        // skip checking family is Keeloq
        let dataIndex = await PK2.dataClrAndDownload(downloadBuffer, 0);

        while(dataIndex < downloadIndex){

            dataIndex = await PK2.dataDownload(downloadBuffer, dataIndex, downloadIndex);
        }

        await PK2.runScript(Constants.PROGMEM_WR, scriptRunsToUseDownload);

        if(((wordsWritten % 0x8000) === 0) && partList.progMemWrPrepScript !== 0){
            // PIC24 must update TBLPAG
            await PK2.downloadAddress3(0x10000 * ((wordsWritten / 0x8000) & 0xFFFFFFFF) );
            await PK2.runScript(Constants.PROGMEM_WR_PREP,1);
        }

        progressBar.style.width = ((wordsWritten / maxProgress) * 100) + '%';

    }while(wordsWritten < endOfBuffer);

    await PK2.runScript(Constants.PROG_EXIT,1);

    
    let verifyStop = endOfBuffer;

    if(configInProgramSpace){
        // if config in program memory, restore prog memory to proper values

        for(let cfg = configWords; cfg > 0; cfg--){

            deviceBuffers.programMemory[deviceBuffers.programMemory.length - cfg] = configBackups[cfg - 1];
        }

        // refresh PK2 backend memory
        await PK2.setDeviceBuffers(deviceBuffers);
    }

    // write EEPROM memory
    if(partList.eeMem > 0){

        statusField.innerHTML = 'Writing EEPROM memory...';

        await PK2.runScript(Constants.PROG_ENTRY,1);

        if(partList.eeWrPrepScript > 1){

            if(family.eeMemHexBytes === 4){
                // 16-bit parts
                await PK2.downloadAddress3((partList.eeAddr / 2) & 0xFFFFFFFF);
            } else {

                await PK2.downloadAddress3(0);
            }

            await PK2.runScript(Constants.EE_WR_PREP,1);
        }

        let bytesPerWord = family.eeMemBytesPerWord;
        let eeBlank = await getEEBlank();

        // write at least 16 locations per loop
        let locationsPerLoop = partList.eeWrLocations;
        if(locationsPerLoop < 16){
            locationsPerLoop = 16;
        }

        // find end of used EE
        if(!useLowVoltageRowErase && !learnMode){

            // we're writing all, so EE is erased first, we can skip blank locations at end
            // unless we're using LVRowErase in which we need to write all as EE isn't erased first
            endOfBuffer = await PK2.findLastUsedInBuffer(deviceBuffers.eePromMemory, eeBlank, deviceBuffers.eePromMemory.length - 1);
        } else {
            // if we're only writing EE, must write blanks in case they aren't blank on device
            endOfBuffer = deviceBuffers.eePromMemory.length - 1;
        }
        // align end on next loop boundary
        let writes = ((endOfBuffer + 1) / locationsPerLoop) & 0xFFFFFFFF;

        if(((endOfBuffer + 1) % locationsPerLoop) > 0){
            writes++;
        }

        endOfBuffer = writes * locationsPerLoop;

        let downloadBuffer = new Array(locationsPerLoop * bytesPerWord).fill(0);

        let scriptRunsPerLoop = (locationsPerLoop / partList.eeWrLocations) & 0xFFFFFFFF;
        let locationsWritten = 0;

        progressBar.style.width = '0%';

        let maxProgress = endOfBuffer;

        do {

            let downloadIndex = 0;

            for(let word = 0; word < locationsPerLoop; word++){

                let eeWord = deviceBuffers.eePromMemory[locationsWritten++];
                if(family.progMemShift > 0){

                    eeWord = eeWord << 1;
                }

                downloadBuffer[downloadIndex++] = (eeWord & 0xFF) >>> 0;
                checksumPkGo += (eeWord & 0xFF) >>> 0;

                for(let bite = 1; bite < bytesPerWord; bite++){

                    eeWord = eeWord >>> 8;
                    downloadBuffer[downloadIndex++] = (eeWord & 0xFF) >>> 0;
                    checksumPkGo += (eeWord & 0xFF) >>> 0;
                }
            }
            // download data
            await PK2.dataClrAndDownload(downloadBuffer, 0);
            await PK2.runScript(Constants.EE_WR, scriptRunsPerLoop);

            progressBar.style.width = ((locationsWritten / maxProgress) * 100) + '%';

        }while(locationsWritten < endOfBuffer);
        
        await PK2.runScript(Constants.PROG_EXIT,1);
    }

    // write userIDs
    if(partList.userIDWords > 0){
        // do not write if EE unselected as PIC18F cannot erase weite UserID except with ChipErase

        statusField.innerHTML = 'Writing UserIDs...';

        await PK2.runScript(Constants.PROG_ENTRY,1);

        if(partList.userIDWrPrepScript > 0){

            await PK2.runScript(Constants.USERID_WR_PREP,1);
        }

        let bytesPerID = family.userIDBytes;
        let downloadBuffer = new Array(partList.userIDWords * bytesPerID).fill(0);

        let downloadIndex = 0;
        let idWritten = 0;

        for(let word = 0; word < partList.userIDWords; word++){

            let memWord = deviceBuffers.userIDs[idWritten++];

            if(family.progMemShift > 0){

                memWord = memWord << 1;
            }

            downloadBuffer[downloadIndex++] = (memWord & 0xFF) >>> 0;
            checksumPkGo += (memWord & 0xFF) >>> 0;

            for(let bite = 1; bite < bytesPerID; bite++){
                    
                memWord = memWord >>> 8;
                downloadBuffer[downloadIndex++] = (memWord & 0xFF) >>> 0;
                checksumPkGo += (memWord & 0xFF) >>> 0;
            } 
        }

        // download data
        let dataIndex = await PK2.dataClrAndDownload(downloadBuffer, 0);
        while(dataIndex < downloadIndex){

            dataIndex = await PK2.dataDownload(downloadBuffer, dataIndex, downloadIndex);
        }

        await PK2.runScript(Constants.USERID_WR,1);
        await PK2.runScript(Constants.PROG_EXIT,1);

    }

    let verifySuccess = true;

    // verify all but config(since hasn't been written as may contain code protection settings)

    if(configInProgramSpace){
        // if config in program memory, don't verify configs
        if(learnMode){

            if(verifyStop === partList.programMem){
                
                // last block of program memory where config words are
                if(family.blankValue > 0xFFFF){
                    // 24FJ
                    checksumPkGo -= 0x80 // adjust for "7F" in blank configs. 
                } else {
                    // 18J
                    checksumPkGo -= 0x08 // adjust for "7F" in blank configs.
                }
            }
        } else {
            // normal
            verifyStop = verifyStop - configWords;
        }
    }

    // always verify on write

    if(learnMode){
        await PK2.metaCmd_START_CHECKSUM();
    }

    verifySuccess = await deviceVerify(true, verifyStop -1, reWriteEE);

    if(learnMode){

        await PK2.metaCmd_VERIFY_CHECKSUM(checksumPkGo);
        checksumPkGo = 0; // clear for config check
    }

    if(learnMode && partList.OSSCALSave){

        await PK2.metaCmd_WRITE_OSCCAL();

        // restore OSCCAL
        deviceBuffers.programMemory[deviceBuffers.programMemory.length - 1] = deviceBuffers.OSCCAL;

        // refresh PK2 backend buffers
        await PK2.setDeviceBuffers(deviceBuffers);
    }

    if(verifySuccess){
        // if we've failed verification, don't try to finish write

        // write configuration
        if((configWords > 0) && (!configInProgramSpace)){
            // write config words differently for any part where they are stored in program memory
            //skip this if since we always verify on write

            // 18F devices create a problem as the WRTC bit in the next to last config word
            // is effective immediately upon being written, which if asserted prevents the 
            // last config word from being written.
            // To get around this, we're using a bit of hack.  Detect PIC18F or PIC18F_K_parts,
            // and look for WRTC = 0.  If found, write config words once with CONFIG6 = 0xFFFF
            // then re-write it with the correct value.
            if(family.familyName === 'PIC18F' || family.familyName === 'PIC18F_K_'){

                if(partList.configWords > 5){
                    // don't blow up if part doesn't have enough config words
                    if((deviceBuffers.configWords[5] & ~0x2000) === deviceBuffers.configWords[5]){
                        //if WRTC is asserted
                        let saveConfig6 = deviceBuffers.configWords[5];
                        deviceBuffers.configWords[5] = 0xFFFF;

                        // refresh PK2 backend buffers
                        await PK2.setDeviceBuffers(deviceBuffers);

                        await PK2.writeConfigOutsideProgMem(false, false); // no protects

                        // refresh PK2 frontend buffers
                        deviceBuffers = await PK2.getDeviceBuffers();

                        deviceBuffers.configWords[5] = saveConfig6;

                        // refresh PK2 backend buffers
                        await PK2.setDeviceBuffers(deviceBuffers);
                    }
                }
            }

            // no protetct since we don't have checkbox to select code protection
            checksumPkGo += await PK2.writeConfigOutsideProgMem(false, false); // no protects

            // refresh PK2 frontend buffers
            deviceBuffers = await PK2.getDeviceBuffers();

            // adjust for some PIC18F masked config bits that remain set
            if(family.blankValue === 0xFFFF){

                checksumPkGo += partList.configMasks[7];
            }

            // verify configuration
            // do it always as we verify on write

            if(!learnMode || partList.bandGapMask === 0){

                let verifyGood = await verifyConfig(configWords, configLocation);

                if(verifyGood){

                    statusField.innerHTML = 'Programming Successful.<br>';
                } else if(!learnMode){

                    verifySuccess = false;
                }

                if(learnMode && partList.bandGapMask === 0){

                    await PK2.metaCmd_VERIFY_CHECKSUM(checksumPkGo);
                }
            }

        } else if(configWords > 0){
            // for parts where config resides in program memory.
            // program last memory block

            //always verify on write

            // the for hewre only do things if checkbox of code protection are checked.
            // since we don't use those checkbox, skip it

            await writeConfigInsideProgramMem();

            // since we always verify in write do this
            statusField.innerHTML = 'Programming Successful.<br>';
        } // since we always use progMEm enabled, dont do this block
        else {
            // HCS parts
            statusField.innerHTML = 'Programming Successful.<br>';
        }

        await PK2.vddOff();

        // skip setting statusField to "Done"

        if(learnMode){
            statusField.innerHTML += 'Programmer-To-Go download complete';
        }

        // update GUI
        await refreshProgramMemoryView();
        await refreshEEPROMMemoryView();
        refreshConfigWordsView(configWords);
        await refreshChecksumView();
        await refreshUserIdsView();


        return verifySuccess;
    }

    return false;

}