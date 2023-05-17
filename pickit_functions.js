const fs = require('fs');
const deviceFile = require('./device_file.js');
const DeviceData = require('./device_data.js');
const Constants = require('./constants.js');
let HID = require('node-hid');
let BinaryReader = require('./binary_reader.js');

class ScriptRedirectTable {

    redirectToScriptLocation = 0;
    deviceFileScriptNumber = 0;
}

class PICkitFunctions {

    static pickit;
    static firmwareVersion = "NA";
    static deviceFileVersion = "NA";

    static devFile = new deviceFile.DeviceFile();
    static deviceBuffers;
    static activePart = 0;
    static lastDeviceID = 0;
    static lastDeviceRev = 0;
    static learnMode = false;

    static familySearchTable = []; // index is search priority, value is family array index
    static vddOn = false;
    static vddLastSet = 3.3; // needed when a family VPP=VDD (PIC18J, PIC24, etc.)
    static targetSelfPowered = false;
    static fastProgramming = true;
    static assertMCLR = false;
    static vppFirstEnabled = false;
    static scriptBufferChecksum = 0;
    static lastFoundPart = 0;
    static scriptRedirectTable = [
        new ScriptRedirectTable(), new ScriptRedirectTable(), new ScriptRedirectTable(), new ScriptRedirectTable(), 
        new ScriptRedirectTable(), new ScriptRedirectTable(), new ScriptRedirectTable(), new ScriptRedirectTable(),
        new ScriptRedirectTable(), new ScriptRedirectTable(), new ScriptRedirectTable(), new ScriptRedirectTable(),
        new ScriptRedirectTable(), new ScriptRedirectTable(), new ScriptRedirectTable(), new ScriptRedirectTable(),
        new ScriptRedirectTable(), new ScriptRedirectTable(), new ScriptRedirectTable(), new ScriptRedirectTable(), 
        new ScriptRedirectTable(), new ScriptRedirectTable(), new ScriptRedirectTable(), new ScriptRedirectTable(),
        new ScriptRedirectTable(), new ScriptRedirectTable(), new ScriptRedirectTable(), new ScriptRedirectTable(),
        new ScriptRedirectTable(), new ScriptRedirectTable(), new ScriptRedirectTable(), new ScriptRedirectTable()
    ];

    static getLearnMode() {

        return this.learnMode;
    }

    static getDeviceName() {

        let deviceName = this.devFile.partsList[this.activePart].partName;
        if(this.activePart === 0){

            if(this.lastDeviceID === 0){

                deviceName = 'No Device found';
            } else {

                deviceName = `(ID=0x${this.lastDeviceID.toString(16)})`;
            }
        }

        return deviceName;
    }

    static getDeviceFile() {

        return this.devFile;
    }

    static getActivePart() {
            
        return this.activePart;
    }

    static getActiveFamily() {

        return this.devFile.partsList[this.activePart].family;
    }

    static getDeviceBuffers() {

        return this.deviceBuffers;
    }

    static setDeviceBuffers(deviceBuffers) {

        this.deviceBuffers = deviceBuffers;
    }

    static metaCmd_CHECK_DEVICE_ID(){

        let family = this.devFile.families[this.getActiveFamily()];
        let partList = this.devFile.partsList[this.getActivePart()];
        let mask = family.deviceIDMask;
        let deviceID = partList.deviceID;

        if(family.progMemShift !== 0){

            mask <<= 1;
            deviceID <<= 1;
        }

        let command = new Array(5);

        command[0] = Constants.MC_CHECK_DEVICE_ID;
        command[1] = mask & 0xFF;                   // device ID mask
        command[2] = (mask >> 8) & 0xFF;
        command[3] = deviceID & 0xFF;               // device ID value
        command[4] = (deviceID >> 8) & 0xFF;

        return this.writeUSB(command);
    }

    static metaCmd_READ_BANDGAP(){

        let command = new Array(1);

        command[0] = Constants.MC_READ_BANDGAP;
        return this.writeUSB(command);
    }

    static metaCmd_WRITE_CFG_BANDGAP(){

        let command = new Array(1);

        command[0] = Constants.MC_WRITE_CFG_BANDGAP;
        return this.writeUSB(command);

    }

    static metaCmd_READ_OSCCAL(){

        let partList = this.devFile.partsList[this.getActivePart()];
        let OSCCALAddress = partList.programMem - 1;

        let command = new Array(3);
        command[0] = Constants.MC_READ_OSCCAL;
        command[1] = OSCCALAddress & 0xFF;         // OSCCAL address
        command[2] = (OSCCALAddress >> 8) & 0xFF;

        return this.writeUSB(command);
    }

    static metaCmd_WRITE_OSCCAL(){

        let OSCCALAddress = this.devFile.partsList[this.getActivePart()].programMem - 1;

        let command = new Array(3);
        command[0] = Constants.MC_WRITE_OSCCAL;
        command[1] = OSCCALAddress & 0xFF;         // OSCCAL address
        command[2] = (OSCCALAddress >> 8) & 0xFF;

        return this.writeUSB(command);
    }

    static metaCmd_START_CHECKSUM(){

        let command = new Array(3);

        command[0] = Constants.MC_START_CHECKSUM;
        command[1] = this.devFile.families[this.getActiveFamily()].progMemShift; // format
        command[2] = 0;

        return this.writeUSB(command);
    }

    static metaCmd_VERIFY_CHECKSUM(checksum){

        checksum = ((~checksum) & 0xFFFFFFFF) >>> 0;

        let command = new Array(3);

        command[0] = Constants.MC_VERIFY_CHECKSUM;
        command[1] = checksum & 0xFF;               // OSCALL address
        command[2] = (checksum >>> 8) & 0xFF;

        return this.writeUSB(command);

    }

    static detectPICkit2Device() {

        let result = {
            status: false,
            firmwareVersion: '',
            code: Constants.PICKIT2USB.NOT_FOUND
        };

        try {
            this.pickit = new HID.HID(Constants.MICROCHIP_VENDOR_ID, Constants.PICKIT2_PRODUCT_ID);
        
            //console.log('PicKit2 found!');
        
            let res = this.writeUSB([Constants.FIRMWARE_VERSION]);
            if(!res){

                result.code = Constants.PICKIT2USB.WRITE_ERROR;
                return result;
            }
        
            let readData = this.readUSB();

            if(readData[0] === 118){

                this.firmwareVersion = `BL ${readData[6]}.${readData[7]}}`;
                result.code = Constants.PICKIT2USB.BOOTLOADER;
            } else {

                this.firmwareVersion = readData[0] + '.' + readData[1] + '.' + readData[2];
                result.code = Constants.PICKIT2USB.FOUND;
            }

            result.status = true;
            result.firmwareVersion = this.firmwareVersion;
        
            //console.log('Firmware version: ' + this.firmwareVersion);

            return result;
        
        }catch(e) {
            //console.log('PicKit2 not found. Error: ' + e);

            return result;
        }
    }

    static readDeviceFile(deviceFilename) {
        
        if(fs.existsSync(deviceFilename)) {

            let data = fs.readFileSync(deviceFilename);
            let reader = new BinaryReader(data);

            this.devFile.info.versionMajor = reader.readInt32();
            this.devFile.info.versionMinor = reader.readInt32();
            this.devFile.info.versionDot = reader.readInt32();

            this.devFile.info.versionNotes = reader.readString();

            this.devFile.info.numberFamilies = reader.readInt32();
            this.devFile.info.numberParts = reader.readInt32();
            this.devFile.info.numberScripts = reader.readInt32();
            this.devFile.info.compatibility = reader.readByte();
            this.devFile.info.UNUSED1A = reader.readByte();
            this.devFile.info.UNUSED1B = reader.readUInt16();
            this.devFile.info.UNUSED2 = reader.readUInt32();

            // create a version string
            this.deviceFileVersion = this.devFile.info.versionMajor + "." + this.devFile.info.versionMinor + "." + this.devFile.info.versionDot;

            // declare the arrays
            this.devFile.families = new Array(this.devFile.info.numberFamilies);
            this.devFile.partsList = new Array(this.devFile.info.numberParts);
            this.devFile.scripts = new Array(this.devFile.info.numberScripts);

            // read the families if they are there

            for(let i = 0; i < this.devFile.info.numberFamilies; i++) {

                this.devFile.families[i] = new deviceFile.DeviceFamilyParams();
                let family = this.devFile.families[i];

                family.familyID = reader.readUInt16();
                family.familyType = reader.readUInt16();
                family.searchPriority = reader.readUInt16();
                family.familyName = reader.readString();
                family.progEntryScript = reader.readUInt16();
                family.progExitScript = reader.readUInt16();
                family.readDevIDScript = reader.readUInt16();
                family.deviceIDMask = reader.readUInt32();
                family.blankValue = reader.readUInt32();
                family.bytesPerLocation = reader.readByte();
                family.addressIncrement = reader.readByte();
                family.partDetect = reader.readBoolean();
                family.progEntryVPPScript = reader.readUInt16();
                family.UNUSED1 = reader.readUInt16();
                family.eeMemBytesPerWord = reader.readByte();
                family.eeMemAddressIncrement = reader.readByte();
                family.userIDHexBytes = reader.readByte();
                family.userIDBytes = reader.readByte();
                family.progMemHexBytes = reader.readByte();
                family.eeMemHexBytes = reader.readByte();
                family.progMemShift = reader.readByte();
                family.testMemoryStart = reader.readUInt32();
                family.testMemoryLength = reader.readUInt16();
                family.vpp = reader.readSingle();
            }

            // create the family search table based on priority

            this.familySearchTable = new Array(this.devFile.info.numberFamilies).fill(0);

            for(let familyIdx = 0; familyIdx < this.devFile.info.numberFamilies; familyIdx++) {
                this.familySearchTable[this.devFile.families[familyIdx].searchPriority] = familyIdx;
            }

            // now read all parts if they are there
            
            for(let i = 0; i < this.devFile.info.numberParts; i++) {

                this.devFile.partsList[i] = new deviceFile.DevicePartParams();
                let partList = this.devFile.partsList[i];

                partList.partName = reader.readString();
                partList.family = reader.readUInt16();
                partList.deviceID = reader.readUInt32();
                partList.programMem = reader.readUInt32();
                partList.eeMem = reader.readUInt16();
                partList.eeAddr = reader.readUInt32();
                partList.configWords = reader.readByte();
                partList.configAddr = reader.readUInt32();
                partList.userIDWords = reader.readByte();
                partList.userIDAddr = reader.readUInt32();
                partList.bandGapMask = reader.readUInt32();

                // init config arrays

                partList.configMasks = new Array(Constants.NUM_CONFIG_MASKS);
                partList.configBlank = new Array(Constants.NUM_CONFIG_MASKS);

                for(let j = 0; j < Constants.NUM_CONFIG_MASKS; j++) {

                    partList.configMasks[j] = reader.readUInt16();
                }

                for(let j = 0; j < Constants.NUM_CONFIG_MASKS; j++) {
                        
                    partList.configBlank[j] = reader.readUInt16();
                }

                partList.cpMask = reader.readUInt16();
                partList.cpConfig = reader.readByte();
                partList.OSSCALSave = reader.readBoolean();
                partList.ignoreAddress = reader.readUInt32();
                partList.vddMin = reader.readSingle();
                partList.vddMax = reader.readSingle();
                partList.vddErase = reader.readSingle();
                partList.calibrationWords = reader.readByte();
                partList.chipEraseScript = reader.readUInt16();
                partList.progMemAddrSetScript = reader.readUInt16();
                partList.progMemAddrBytes = reader.readByte();
                partList.progMemRdScript = reader.readUInt16();
                partList.progMemRdWords = reader.readUInt16();
                partList.eeRdPrepScript = reader.readUInt16();
                partList.eeRdScript = reader.readUInt16();
                partList.eeRdLocations = reader.readUInt16();
                partList.userIDRdPrepScript = reader.readUInt16();
                partList.userIDRdScript = reader.readUInt16();
                partList.configRdPrepScript = reader.readUInt16();
                partList.configRdScript = reader.readUInt16();
                partList.progMemWrPrepScript = reader.readUInt16();
                partList.progMemWrScript = reader.readUInt16();
                partList.progMemWrWords = reader.readUInt16();
                partList.progMemPanelBufs = reader.readByte();
                partList.progMemPanelOffset = reader.readUInt32();
                partList.eeWrPrepScript = reader.readUInt16();
                partList.eeWrScript = reader.readUInt16();
                partList.eeWrLocations = reader.readUInt16();
                partList.userIDWrPrepScript = reader.readUInt16();
                partList.userIDWrScript = reader.readUInt16();
                partList.configWrPrepScript = reader.readUInt16();
                partList.configWrScript = reader.readUInt16();
                partList.OSCCALRdScript = reader.readUInt16();
                partList.OSCCALWrScript = reader.readUInt16();
                partList.dPMask = reader.readUInt16();
                partList.writeCfgOnErase = reader.readBoolean();
                partList.blankCheckSkipUsrIDs = reader.readBoolean();
                partList.ignoreBytes = reader.readUInt16();
                partList.chipErasePrepScript = reader.readUInt16();
                partList.bootFlash = reader.readUInt32();
                partList.UNUSED4 = reader.readUInt32();
                partList.progMemEraseScript = reader.readUInt16();
                partList.eeMemEraseScript = reader.readUInt16();
                partList.configMemEraseScript = reader.readUInt16();
                partList.reserved1EraseScript = reader.readUInt16();
                partList.reserved2EraseScript = reader.readUInt16();
                partList.testMemoryRdScript = reader.readUInt16();
                partList.testMemoryRdWords = reader.readUInt16();
                partList.eeRowEraseScript = reader.readUInt16();
                partList.eeRowEraseWords = reader.readUInt16();
                partList.exportToMPLAB = reader.readBoolean();
                partList.debugHaltScript = reader.readUInt16();
                partList.debugRunScript = reader.readUInt16();
                partList.debugStatusScript = reader.readUInt16();
                partList.debugReadExecVerScript = reader.readUInt16();
                partList.debugSingleStepScript = reader.readUInt16();
                partList.debugBulkWrDataScript = reader.readUInt16();
                partList.debugBulkRdDataScript = reader.readUInt16();
                partList.debugWriteVectorScript = reader.readUInt16();
                partList.debugReadVectorScript = reader.readUInt16();
                partList.debugRowEraseScript = reader.readUInt16();
                partList.debugRowEraseSize = reader.readUInt16();
                partList.debugReserved5Script = reader.readUInt16();
                partList.debugReserved6Script = reader.readUInt16();
                partList.debugReserved7Script = reader.readUInt16();
                partList.debugReserved8Script = reader.readUInt16();
                partList.debugReserved9Script = reader.readUInt16();

            }

            // now read all scripts if they are there

            for (let i = 0; i < this.devFile.info.numberScripts; i++) {

                this.devFile.scripts[i] = new deviceFile.DeviceScripts();
                let script = this.devFile.scripts[i];

                script.scriptNumber = reader.readUInt16();
                script.scriptName = reader.readString();
                script.scriptVersion = reader.readUInt16();
                script.UNUSED1 = reader.readUInt32();
                script.scriptLength = reader.readUInt16();
                
                // init script array

                script.script = new Array(script.scriptLength);

                for (let j = 0; j < script.scriptLength; j++) {

                    script.script[j] = reader.readUInt16();

                }

                script.comment = reader.readString();
            }

            return true;

        }
        else {
            console.log("Device file not found: " + deviceFilename);
            return false;
        }
    }

    static unitIDRead() {

        let unitID = '';

        let command = new Array(3);
        command[0] = Constants.RD_INTERNAL_EE;
        command[1] = Constants.UNIT_ID;
        command[2] = 16;

        let result = this.writeUSB(command);

        if(result){

            let data = this.readUSB();

            if(data[0] === 0x23){
                    
                for(let i = 0; i < 15; i++){

                    if (data[i + 1] === 0x00) break;
                    unitID += String.fromCharCode(data[i + 1]);
                }
    
            }
        }

        return unitID;

    }

    static computeChecksum(){

        let checksum = 0;

        let family = this.devFile.families[this.getActiveFamily()];
        let partList = this.devFile.partsList[this.activePart];

        if(family.blankValue < 0xFFFF){
            // 16F and baseline parts are calculated a word at a time

            //prog mem first
            let progMemEnd = partList.programMem;

            if(partList.OSSCALSave){
                // don't include the last location for devices with OSSCAL
                progMemEnd--;
            }

            for(let i = 0; i < progMemEnd; i++){
                checksum += this.deviceBuffers.programMemory[i];
            }

            if(partList.configWords > 0){

                if(
                    (partList.cpMask & this.deviceBuffers.configWords[partList.cpConfig -1])
                    !== partList.cpMask
                ){ // if a code protect bit is set, the checksum is computed differently

                    checksum = 0; // don't include memory
                    for(let idx = 0; idx < partList.userIDWords; idx++){
                        
                        // add last nibble of UserIDs in decreasing nibble positions of checksum
                        let idPosition = 1;
                        for(let factor = 0; factor < idx; factor++){

                            idPosition <<= 4;
                        }
                        checksum += (((0xF & this.deviceBuffers.userIDs[partList.userIDWords - idx - 1]) * idPosition) & 0xFFFFFFFF) >>> 0; 
                    }
                }

                // config words
                for(let i = 0; i < partList.configWords; i++){
                    checksum += this.deviceBuffers.configWords[i] & partList.configMasks[i];
                }
            }
            return checksum & 0xFFFF;
        } else {
            // PIC18 and PIC24 checksums are calculated a byte at a time

            let progMemEnd = (partList.configAddr / family.progMemHexBytes) & 0xFFFFFFFF;

            if(progMemEnd > partList.programMem){
                progMemEnd = partList.programMem & 0xFFFFFFFF;
            }

            for(let idx = 0; idx < progMemEnd; idx++){

                let memWord = this.deviceBuffers.programMemory[idx];
                checksum += (memWord & 0x000000FF) >>> 0;

                for(let bite = 1; bite < family.bytesPerLocation; bite++){

                    memWord >>>= 8;
                    checksum += (memWord & 0x000000FF) >>> 0;
                }
            }

            if(partList.configWords > 0){

                if(
                    (partList.cpMask & this.deviceBuffers.configWords[partList.cpConfig - 1])
                    !== partList.cpMask
                ){ // if a code protect bit is set, the checksum is computed differently
                    // NOTE: this will only match MPLAB checksum if all CP bits are set or ALL CP bits are clear.
                    checksum = 0; // don't include memory

                    for(let idx = 0; idx < partList.userIDWords; idx++){

                        // add UserIDs to checksum
                        let memWord = this.deviceBuffers.userIDs[idx];
                        checksum += (memWord & 0x000000FF) >>> 0;
                        checksum += ((memWord >>> 8) & 0x000000FF) >>> 0;
                    }
                }

                // config words
                for(let idx = 0; idx < partList.configWords; idx++){

                    let memWord = this.deviceBuffers.configWords[idx] & partList.configMasks[idx];
                    checksum += (memWord & 0x000000FF) >>> 0;
                    checksum += ((memWord >>> 8) & 0x000000FF) >>> 0;
                }
            }

            return (checksum & 0xFFFF) >>> 0;
        }

    }

    static getNewDeviceDataWithParams(

    ){
            
        let family = this.devFile.families[this.getActiveFamily()];
        let partList = this.devFile.partsList[this.activePart];

        let deviceBuffers = new DeviceData(
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

        return deviceBuffers;
    
    }

    static resetBuffers() {

        this.deviceBuffers = new DeviceData(
            this.devFile.partsList[this.activePart].programMem,
            this.devFile.partsList[this.activePart].eeMem,
            this.devFile.partsList[this.activePart].configWords,
            this.devFile.partsList[this.activePart].userIDWords,
            this.devFile.families[this.getActiveFamily()].blankValue,
            this.devFile.families[this.getActiveFamily()].eeMemAddressIncrement,
            this.devFile.families[this.getActiveFamily()].userIDBytes,
            this.devFile.partsList[this.activePart].configBlank,
            this.devFile.partsList[this.activePart].configMasks[Constants.OSCCAL_MASK]

        );
    }

    static exitUARTMode() {

        return this.writeUSB([Constants.EXIT_UART_MODE, Constants.CLR_DOWNLOAD_BUFFER, Constants.CLR_UPLOAD_BUFFER]);
    }

    static validateOSSCAL() {

        let value = this.deviceBuffers.OSCCAL;
        value &= 0xFF00;

        let partList = this.devFile.partsList[this.activePart];

        if((value !== 0) && (value === partList.configMasks[Constants.OSCCAL_MASK])){

            return true;
        }
        return false;
    }

    static familyIsEEPROM() {

        let maxLength = this.devFile.families[this.getActiveFamily()].familyName.length;
        if(maxLength > 6){
            maxLength = 6;
        }

        return this.devFile.families[this.getActiveFamily()].familyName.substring(0, maxLength) === "EEPROM";
    }

    static familyIsHeeloq() {
            
        let maxLength = this.devFile.families[this.getActiveFamily()].familyName.length;
        if(maxLength > 6){
            maxLength = 6;
        }

        return this.devFile.families[this.getActiveFamily()].familyName.substring(0, maxLength) === "KEELOQ";
    }

    static familyIsMCP() {

        let maxLength = this.devFile.families[this.getActiveFamily()].familyName.length;
        if(maxLength > 3){
            maxLength = 3;
        }

        return this.devFile.families[this.getActiveFamily()].familyName.substring(0, maxLength) === "MCP";
    }

    static familyIsPIC32() {

        let maxLength = this.devFile.families[this.getActiveFamily()].familyName.length;
        if(maxLength > 5){
            maxLength = 5;
        }

        return this.devFile.families[this.getActiveFamily()].familyName.substring(0, maxLength) === "PIC32";
    }

    static familyIsdsPIC30() {

        let maxLength = this.devFile.families[this.getActiveFamily()].familyName.length;
        if(maxLength > 7){
            maxLength = 7;
        }

        return this.devFile.families[this.getActiveFamily()].familyName.substring(0, maxLength) === "dsPIC30";
    }

    static familyIsPIC18J() {

        let maxLength = this.devFile.families[this.getActiveFamily()].familyName.length;
        if(maxLength > 9){
            maxLength = 9;
        }

        return this.devFile.families[this.getActiveFamily()].familyName.substring(0, maxLength) === "PIC18F_J_";
    }

    static rowEraseDevice() {

        // row erase script automatically increments PC by number of locations erased
        // erase program memory
        let partList = this.devFile.partsList[this.getActivePart()];
        let family = this.devFile.families[this.getActiveFamily()];
        
        let memoryRows = (partList.programMem / partList.debugRowEraseSize) & 0xFFFFFFFF;
        this.runScript(Constants.PROG_ENTRY, 1);

        if(partList.progMemWrPrepScript !== 0){
            // if prog mem address set script exsits for this part
            this.downloadAddress3(0);
            this.runScript(Constants.PROGMEM_WR_PREP, 1);
        }

        do {

            if(memoryRows >= 256){
                // erase up to 256 rows at a time
                this.runScript(Constants.ROW_ERASE, 0); // 0 = 256 times
                memoryRows -= 256;
            } else {
                this.runScript(Constants.ROW_ERASE, memoryRows);
                memoryRows = 0;
            }

        }while(memoryRows > 0);
        this.runScript(Constants.PROG_EXIT, 1);

        // erase EEPROM data
        // only dsPIC30 currently need this done
        if(partList.eeRowEraseScript > 0){

            let eeRows = (partList.eeMem / partList.eeRowEraseWords) & 0xFFFFFFFF;
            this.runScript(Constants.PROG_ENTRY, 1);

            if(partList.eeRdPrepScript !== 0){
                // if ee mem address set script exists for this part
                this.downloadAddress3((partList.eeAddr / family.eeMemBytesPerWord) & 0xFFFFFFFF);
                this.runScript(Constants.EE_RD_PREP, 1);
            }

            do {

                if(eeRows >= 256){
                    // erase up to 256 rows at a time
                    this.runScript(Constants.EEROW_ERASE, 0); // 0 = 256 times
                    eeRows -= 256;
                } else {
                    this.runScript(Constants.EEROW_ERASE, eeRows);
                    eeRows = 0;
                }

            }while(eeRows > 0);
            this.runScript(Constants.PROG_EXIT, 1);
        }

        // erase config memory
        if(partList.configMemEraseScript > 0){

            this.runScript(Constants.PROG_ENTRY, 1);
            if(partList.progMemWrPrepScript !== 0){
                // if prog mem address set script exsits for this part
                this.downloadAddress3(partList.userIDAddr);
                this.runScript(Constants.PROGMEM_WR_PREP, 1);
            }

            this.executeScript(partList.configMemEraseScript);
            this.runScript(Constants.PROG_EXIT, 1);
        }
    }

    static VddOn() {

        let command = new Array(4);
        command[0] = Constants.EXECUTE_SCRIPT;
        command[1] = 0x02;
        command[2] = Constants._VDD_GND_OFF;

        if(this.targetSelfPowered) {
            // don't turn on VDD if self-powered target!
            command[3] = Constants._VDD_OFF;
        } else {
            command[3] = Constants._VDD_ON;
        }

        let result = this.writeUSB(command);
        if(result){
            this.vddOn = true;
            return true;
        }

        return result;
    }

    static vddOff() {

        let command = new Array(4);
        command[0] = Constants.EXECUTE_SCRIPT;
        command[1] = 0x02;
        command[2] = Constants._VDD_OFF;

        if(this.targetSelfPowered) {
            // don't ground VDD if self-powered target
            command[3] = Constants._VDD_GND_OFF;
        } else {
            command[3] = Constants._VDD_GND_ON;
        }

        let result = this.writeUSB(command);
        if(result){

            this.vddOn = false;
            return true;
        }

        return result;

    }

    static setProgrammingSpeed(speed) {

        let command = new Array(4);
        command[0] = Constants.EXECUTE_SCRIPT;
        command[1] = 0x02;
        command[2] = Constants._SET_ICSP_SPEED;
        command[3] = speed & 0xFF;

        return this.writeUSB(command);
    }

    static setVddVoltage(voltage, threshold) {

        if (voltage < 2.5) {
            voltage = 2.5; // minimum, as when forcing VDD target can get set very low (last reading)
                           // and too low prevents VPP pump from working
        }

        this.vddLastSet = voltage;

        let cppValue = this.calcultateVddCPP(voltage);
        let vFault = (((threshold * voltage) / 5.0) * 255.0) & 0xFF;

        if(vFault > 210){

            vFault = 210; // ~4.12V maximum. Because of diode droop, limit threshold on high side.
        }

        let command = new Array(4);
        command[0] = Constants.SETVDD;
        command[1] = cppValue & 0xFF;
        command[2] = (cppValue >>> 8) & 0xFF;
        command[3] = vFault;

        return this.writeUSB(command);


    }

    static calcultateVddCPP(voltage) {

        let cppValue = (voltage * 32.0 + 10.5) & 0xFFFF;
        cppValue <<= 6;
        return cppValue;
    }

    static readBandGap() {

        this.runScript(Constants.PROG_ENTRY, 1);
        this.runScript(Constants.CONFIG_RD, 1);
        let data = this.uploadData();
        this.runScript(Constants.PROG_EXIT, 1);

        let configWords = this.devFile.partsList[this.activePart].configWords;
        let config = data[1] & 0xFFFFFFFF;
        config |= (data[2] << 8) & 0xFFFFFFFF;

        if(this.devFile.families[this.getActiveFamily()].progMemShift > 0){
    
                config = (config >>> 1) & this.devFile.families[this.getActiveFamily()].blankValue;
        }
        this.deviceBuffers.bandGap = config & this.devFile.partsList[this.activePart].bandGapMask;
    }

    static writeConfigOutsideProgMem(codeProtect, dataProtect){

        let partList = this.devFile.partsList[this.activePart];
        let family = this.devFile.families[this.getActiveFamily()];
        let configWords = partList.configWords;
        let checksumPk2Go = 0;

        let configBuffer = new Array(2 * configWords);

        if(partList.bandGapMask > 0){

            this.deviceBuffers.configWords[0] &= ~partList.bandGapMask;
            if(!this.learnMode)
            {
                this.deviceBuffers.configWords[0] |= this.deviceBuffers.bandGap;
            }
        }

        if(this.familyIsMCP()){
            this.deviceBuffers.configWords[0] |= 0x3FF8;
        }

        this.runScript(Constants.PROG_ENTRY, 1);

        if(partList.configWrPrepScript > 0){

            this.downloadAddress3(0);
            this.runScript(Constants.CONFIG_WR_PREP, 1);
        }

        for(let i = 0, j = 0; i < configWords; i++){

            let configWord = this.deviceBuffers.configWords[i];

            if(i === partList.cpConfig -1){

                if(codeProtect){
                    configWord &= (~partList.cpMask) & 0xFFFFFFFF;
                }

                if(dataProtect){
                    configWord &= (~partList.dpMask) & 0xFFFFFFFF;
                }
            }

            if(family.progMemShift > 0){
                // baseline & midrange
                configWord |= (~partList.configMasks[i] & ~partList.bandGapMask);
                if(!this.familyIsMCP()){
                    configWord &= family.blankValue;
                }

                configWord = configWord << 1;
            }

            configBuffer[j++] = configWord & 0xFF;
            configBuffer[j++] = (configWord >>> 8) & 0xFF;

            checksumPk2Go += configWord & 0xFF;
            checksumPk2Go += (configWord >>> 8) & 0xFF;
        }

        this.dataClrAndDownload(configBuffer, 0);

        if(this.learnMode && partList.bandGapMask > 0){

            this.metaCmd_WRITE_CFG_BANDGAP();
        } else {

            this.runScript(Constants.CONFIG_WR, 1);
        }

        this.runScript(Constants.PROG_EXIT, 1);

        return checksumPk2Go;
    }

    static readOSSCAL() {

        if(this.runScript(Constants.PROG_ENTRY, 1)){

            if( this.downloadAddress3((this.devFile.partsList[this.activePart].programMem -1) & 0xFFFFFFFF)){
                    
                if(this.runScript(Constants.OSSCAL_RD, 1)){

                    let data = this.uploadData();

                    if(this.runScript(Constants.PROG_EXIT, 1)){

                        this.deviceBuffers.OSCCAL = (data[1] + data[2] * 256) & 0xFFFFFFFF;
                        if(this.devFile.families[this.getActiveFamily()].progMemShift > 0)
                        {
                            this.deviceBuffers.OSCCAL >>>= 1;
                        }
                        this.deviceBuffers.OSCCAL &= this.devFile.families[this.getActiveFamily()].blankValue;
                        return true;
                    }
                }
            }
        }

        return false;
    }

    static writeOSSCAL(){

        if(this.runScript(Constants.PROG_ENTRY, 1)){

            let calWord = this.deviceBuffers.OSCCAL;
            let calAddress = partList.programMem - 1;

            let family = this.devFile.families[this.getActiveFamily()];
            if(family.progMemShift > 0){

                calWord <<= 1;
            }

            let addressData = new Array(5);
            addressData[0] = (calAddress & 0xFF);
            addressData[1] = ((calAddress >>> 8) & 0xFF);
            addressData[2] = ((calAddress >>> 16) & 0xFF);
            addressData[3] = (calWord & 0xFF);
            addressData[4] = ((calWord >>> 8) & 0xFF);

            this.dataClrAndDownload(addressData, 0);

            if(this.runScript(Constants.OSSCAL_WR, 1)){

                if(this.runScript(Constants.PROG_EXIT, 1)){

                    return true;
                }
            }
        }
        return false;
    }

    static checkTargetPower() {

        let result = {
            vdd: 0.0,
            vpp: 0.0,
            status: Constants.PICKIT2PWR.NO_RESPONSE
        };

        if(this.vddOn){ // if VDD is on, can't check for self-powered target

            result.status = Constants.PICKIT2PWR.VDD_ON;
            return result;
        }

        let voltages = this.readPICkitVoltages();
        result.vdd = voltages.vdd;
        result.vpp = voltages.vpp;

        if(voltages.status){

            if(voltages.vdd > Constants.VDD_THRESHOLD_FOR_SELF_POWERED_TARGET){

                this.targetSelfPowered = true;
                this.setVddVoltage(voltages.vdd, 0.85); // set VDD to target level
                result.status = Constants.PICKIT2PWR.SELFPOWERED;
                return result;
            }

            this.targetSelfPowered = false;
            result.status = Constants.PICKIT2PWR.UNPOWERED;
            return result;
        }

        this.targetSelfPowered = false;
        result.status = Constants.PICKIT2PWR.NO_RESPONSE;
        return result;
    }

    static executeScript(scriptArrayIndex) {

        // IMPORTANT NOTE: THIS ALWAYS CLEARS THE UPLOAD BUFFER FIRST!

        let scriptLength;
        if(scriptArrayIndex == 0)
            return false;

        scriptLength = this.devFile.scripts[--scriptArrayIndex].scriptLength;

        //console.log("Executing script " + scriptArrayIndex + " of length " + scriptLength);
        //console.log('Script content');
        //console.log(this.devFile.scripts[scriptArrayIndex].script);

        let command = new Array(3 + scriptLength);
        command[0] = Constants.CLR_UPLOAD_BUFFER;
        command[1] = Constants.EXECUTE_SCRIPT;
        command[2] = scriptLength & 0xFF;

        for(let i = 0; i < scriptLength; i++){
                
            command[3 + i] = this.devFile.scripts[scriptArrayIndex].script[i] & 0xFF;
        }

        //console.log('Command content');
        //console.log(command);

        return this.writeUSB(command);
    }

    static setMCLRTemp(nMCLR) {

        let releaseMCLRscript = new Array(1);

        if(nMCLR){

            releaseMCLRscript[0] = Constants._MCLR_GND_ON;
        } else {

            releaseMCLRscript[0] = Constants._MCLR_GND_OFF;
        }

        return this.sendScript(releaseMCLRscript);
    }

    static holdMCLR(nMCLR){

        this.assertMCLR = nMCLR;

        let releaseMCLRscript = new Array(1);
        if(nMCLR){

            releaseMCLRscript[0] = Constants._MCLR_GND_ON;
        } else {

            releaseMCLRscript[0] = Constants._MCLR_GND_OFF;
        }

        return this.sendScript(releaseMCLRscript);
    }

    static forcePICkitPowered() {

        this.targetSelfPowered = false;
    }

    static forceTargetPowered() {

        this.targetSelfPowered = true;
    }

    static readConfigOutsideProgMem() {

        this.runScript(Constants.PROG_ENTRY, 1);
        this.runScript(Constants.CONFIG_RD, 1);
        let data = this.uploadData();
        this.runScript(Constants.PROG_EXIT, 1);

        let configWords = this.devFile.partsList[this.activePart].configWords;
        let bufferIndex = 1;
        let family = this.devFile.families[this.getActiveFamily()];
        for(let word = 0; word < configWords; word++){

            let config = ((data[bufferIndex++]) & 0xFFFFFFFF) >>> 0;
            config |= ((data[bufferIndex++] << 8) & 0xFFFFFFFF) >>> 0;
            if(family.progMemShift > 0){

                config = (config >>> 1) & family.blankValue;
            }

            this.deviceBuffers.configWords[word] = config;
        }

        return this.deviceBuffers;
    }

    static getActiveFamily() {
        return this.devFile.partsList[this.activePart].family;
    }

    static readPICkitVoltages() {

        let result = {
            vdd: 0.0,
            vpp: 0.0,
            status: false
        };

        let command = new Array(1);
        command[0] = Constants.READ_VOLTAGES;

        if(this.writeUSB(command)){

            let data = this.readUSB();

            let valueADC = data[0] + (data[1] << 8);
            result.vdd = (valueADC / 65536) * 5.0;
            valueADC = data[2] + (data[3] << 8);
            result.vpp = (valueADC / 65536) * 13.7;
            result.status = true;
        }

        return result;
    }

    static setVppVoltage(voltage, threshold) {

        let cppValue = 0x40;
        let vppADC = (voltage * 18.61) & 0xFF;

        let vFault = (threshold * voltage * 18.61) & 0xFF;

        let command = new Array(4);
        command[0] = Constants.SETVPP;
        command[1] = cppValue;
        command[2] = vppADC;
        command[3] = vFault;

        return this.writeUSB(command);
    }

    static sendScript(script) {

        let scriptLength = script.length;

        let command = new Array(2 + scriptLength);
        command[0] = Constants.EXECUTE_SCRIPT;
        command[1] = scriptLength & 0xFF;

        for (let i = 0; i < scriptLength; i++) {
                
            command[2 + i] = script[i];
        }

        return this.writeUSB(command);
    }

    static detectDevice(familyIndex, resetOnNotFound, keepVddOn) {

        // detect a device in the given family or familyIndex, or all families

        if(familyIndex === Constants.SEARCH_ALL_FAMILIES){

            // when searching all families, set Vdd = 3.3V
            if(!this.targetSelfPowered){
                // but not if target is self-powered
                this.setVddVoltage(3.3, 0.85);
            }

            for(let searchIndex = 0; searchIndex < this.devFile.families.length; searchIndex++){

                //console.log("DETECT_DEVICE: Searching family " + this.devFile.families[this.familySearchTable[searchIndex]].familyName);

                if(this.devFile.families[this.familySearchTable[searchIndex]].partDetect){
                    
                    if(this.searchDevice(this.familySearchTable[searchIndex], true, keepVddOn)){
                        // 0 = no supported part found
                        return true;
                    }
                }
            }

            console.log("DETECT_DEVICE: No supported part found in any family");
            return false; // no supported part found in any family
        } else {

            // reset VDD
            this.setVddVoltage(this.vddLastSet, 0.85);

            if(this.devFile.families[familyIndex].partDetect){

                if(this.searchDevice(familyIndex, resetOnNotFound, keepVddOn)){

                    return true;
                }

                return false;
            } else {

                return true; // don't fail unsearchable families like baseline
            }
        }
    }

    static findLastUsedInBuffer(bufferToSearch, blankValue, startIndex){

        // go backwards from the start entry to find the last non-blank entry
        let family = this.devFile.families[this.getActiveFamily()];
        if(family.familyName.substring(0,6) !== 'KEELOQ'){

            for(let index = startIndex; index >= 0; index--){

                if(bufferToSearch[index] !== blankValue){

                    return index;
                }
            }
        } else {
            return bufferToSearch.length - 1;
        }

        return 0;
    }

    static busErrorCheck(){

        let status = this.readPkStatus();

        if((status & 0x0400) === 0x0400){
            return true; // error
        }

        let command = new Array(3);

        command[0] = Constants.EXECUTE_SCRIPT;
        command[1] = 0x01;
        command[2] = Constants._BUSY_LED_ON;

        this.writeUSB(command);

        return false; // no error
    }

    static powerStatus() {

        let status = this.readPkStatus();
        if(status === 0xFFFF){

            return Constants.PICKIT2PWR.NO_RESPONSE;
        }
        if((status & 0x0030) === 0x0030){
            
            this.vddOn = false;
            return Constants.PICKIT2PWR.VDDVPPERRORS;
        }
        if((status & 0x0020) === 0x0020){
            
            this.vddOn = false;
            return Constants.PICKIT2PWR.VPPERROR;
        }
        if((status & 0x0010) === 0x0010){

            this.vddOn = false;
            return Constants.PICKIT2PWR.VDDERROR;
        }
        if((status & 0x0002) === 0x0002){

            this.vddOn = true;
            return Constants.PICKIT2PWR.VDD_ON;
        }
        this.vddOn = false;
        return Constants.PICKIT2PWR.VDD_OFF;
    }

    static readPkStatus() {

        let command = new Array(1);
        command[0] = Constants.READ_STATUS;

        if(this.writeUSB(command)){

            let data = this.readUSB();

            return (data[1] * 256 + data[0]) & 0xFFFF;
        } else {

            return 0xFFFF;
        }
    }

    static writeUSB(commandList) {

        let data = Buffer.alloc(65, 0xAD);
        data[0] = 0x00; // always 0

        for (let i = 0; i < commandList.length; i++) {
            data[i + 1] = commandList[i];
        }

        return this.pickit.write(data) === data.length;
    }

    static readUSB() {
            
        return this.pickit.readSync();
    }

    static runScriptUploadNoLen(script, repetitions) {

        // IMPORTANT NOTE: THIS ALWAYS CLEARS THE UPLOAD BUFFER FIRST!

        let command = new Array(5);
        command[0] = Constants.CLR_UPLOAD_BUFFER;
        command[1] = Constants.RUN_SCRIPT;
        command[2] = this.scriptRedirectTable[script].redirectToScriptLocation & 0xFF;
        command[3] = repetitions & 0xFF;
        command[4] = Constants.UPLOAD_DATA_NOLEN;

        let result = this.writeUSB(command);

        if(result){
            let data = this.readUSB();
            return data;
        }
        
        return false;
    }

    static runScriptUploadNoLen2(script, repetitions) {

        // IMPORTANT NOTE: THIS ALWAYS CLEARS THE UPLOAD BUFFER FIRST!

        let command = new Array(6);
        command[0] = Constants.CLR_UPLOAD_BUFFER;
        command[1] = Constants.RUN_SCRIPT;
        command[2] = this.scriptRedirectTable[script].redirectToScriptLocation & 0xFF;
        command[3] = repetitions & 0xFF;
        command[4] = Constants.UPLOAD_DATA_NOLEN;
        command[5] = Constants.UPLOAD_DATA_NOLEN;

        let result = this.writeUSB(command);

        if(result){
                
            let data = this.readUSB();
            return data;
        }

        return false;


    }

    static getUpload(){

        return this.readUSB();
    }

    static uploadData() {

        let command = new Array(1);
        command[0] = Constants.UPLOAD_DATA;

        let result = this.writeUSB(command);

        if(result){

            let data = this.readUSB();
            return data;
        }

        return false;
    }

    static uploadDataNoLen() {
            
        let command = new Array(1);
        command[0] = Constants.UPLOAD_DATA_NOLEN;

        let result = this.writeUSB(command);

        if(result){

            let data = this.readUSB();
            return data;
        }

        return false;
    }

    static runScript(script, repetitions){

        // IMPORTANT NOTE: THIS ALWAYS CLEARS THE UPLOAD BUFFER FIRST!

        let command = new Array(4);
        command[0] = Constants.CLR_UPLOAD_BUFFER;
        command[1] = Constants.RUN_SCRIPT;
        command[2] = this.scriptRedirectTable[script].redirectToScriptLocation & 0xFF;
        command[3] = repetitions & 0xFF;

        if(this.writeUSB(command)){

            if((script == Constants.PROG_EXIT) && !this.assertMCLR){

                return this.holdMCLR(false);
            }
            return true;
        } else {
            return false;
        }
    }

    static dataClrAndDownload(dataArray, startIndex) {

        // returns index of next byte to be transmitted. 0 = failed
        if(startIndex >= dataArray.length){
                
            return 0;
        }

        let length = dataArray.length - startIndex;
        if(length > 61){
                
            length = 61;
        }

        let command = new Array(3 + length);
        command[0] = Constants.CLR_DOWNLOAD_BUFFER;
        command[1] = Constants.DOWNLOAD_DATA;
        command[2] = length & 0xFF;

        for (let i = 0; i < length; i++) {
            command[i + 3] = dataArray[startIndex + i];
        }

        if(this.writeUSB(command)){

            return startIndex + length;
        } else {
            return 0;
        }
    }

    static dataDownload(dataArray, startIndex, lastIndex) {

        // return index of next byte to be transmitted. 0 = failed

        if(startIndex >= lastIndex){
            return 0;
        }

        let length = lastIndex - startIndex;
        if(length > 62){
            length = 62;
        }

        let command = new Array(2 + length);

        command[0] = Constants.DOWNLOAD_DATA;
        command[1] = length & 0xFF;

        for(let i = 0; i < length; i++){

            command[i + 2] = dataArray[startIndex + i];
        }

        if(this.writeUSB(command)){

            return startIndex + length;
        } else {
            return 0;
        }
    }

    static downloadAddress3(address) {

        let command = new Array(6);

        command[0] = Constants.CLR_DOWNLOAD_BUFFER;
        command[1] = Constants.DOWNLOAD_DATA;
        command[2] = 3;
        command[3] = address & 0xFF;
        command[4] = (address >> 8) & 0xFF;
        command[5] = (address >> 16) & 0xFF;

        return this.writeUSB(command);
    }

    static downloadAddress3MSBFirst(address) {

        let command = new Array(6);

        command[0] = Constants.CLR_DOWNLOAD_BUFFER;
        command[1] = Constants.DOWNLOAD_DATA;
        command[2] = 3;
        command[3] = (address >> 16) & 0xFF;
        command[4] = (address >> 8) & 0xFF;
        command[5] = address & 0xFF;

        return this.writeUSB(command);
    }

    static searchDevice(familyIndex, resetOnNoDevice, keepVddOn) {

        let lastPart = this.activePart; // remember the current part
        if(this.activePart !== 0){
            this.lastFoundPart = this.activePart;
        }

        // NOTE: the interface portion should ensure that self-powered targets
        // are detected before calling this function

        // Set VPP voltage by family
        let vpp = this.devFile.families[familyIndex].vpp;
        if(vpp < 1){
            // when nominally zero, use VDD voltage
            this.setVppVoltage(this.vddLastSet, 0.7);
        } else {
            this.setVppVoltage(vpp, 0.7);
        }

        // Turn on Vdd (if self-powered, just turns off ground resistor)
        this.setMCLRTemp(true); // assert /MCLR to prevent code execution before programming mode entered
        this.VddOn();

        // use direct execute scripts when checking for a part
        if(this.vppFirstEnabled && this.devFile.families[familyIndex].progEntryVPPScript > 0){

            this.executeScript(this.devFile.families[familyIndex].progEntryVPPScript);
        } else {

            this.executeScript(this.devFile.families[familyIndex].progEntryScript);
            //console.log(`FamilyIndex ${familyIndex} => ProgEntryScript: ${this.devFile.families[familyIndex].progEntryScript}`);
        }

        this.executeScript(this.devFile.families[familyIndex].readDevIDScript);
        //console.log(`FamilyIndex ${familyIndex} => ReadDevIDScript: ${this.devFile.families[familyIndex].readDevIDScript}`)
        let data = this.uploadData();
        this.executeScript(this.devFile.families[familyIndex].progExitScript);
        //console.log(`FamilyIndex ${familyIndex} => ProgExitScript: ${this.devFile.families[familyIndex].progExitScript}`)

        // Turn off Vdd (if PICkit-powered, turns on ground resistor)
        if(!keepVddOn){
            // don't want it off when user wants PICkit 2 VDD "ON"
            this.vddOff();
        }

        if(!this.assertMCLR){

            this.holdMCLR(false);
        }

        // NOTE: parts that only return 2 bytes for DevID will have junk in upper word. This is OK - it gets masked off.
        let deviceID = (data[4] * 0x1000000 + data[3] * 0x10000 + data[2] * 256 + data[1]) & 0xFFFFFFFF;

        for(let shift = 0; shift < this.devFile.families[familyIndex].progMemShift; shift++){
            deviceID = deviceID >>>= 1; // midrange/baseline part results must be shifted by 1
        }

        if(data[0] === 0x04) // 16-bit/32-bit parts have Rev in separate word
        {
            this.lastDeviceRev = (data[4] * 256 + data[3]) & 0xFFFFFFFF;
            if(this.devFile.families[familyIndex].blankValue === 0xFFFFFFFF) // PIC32
            {
                this.lastDeviceRev = this.lastDeviceRev >> 4;
            }
        } else {
            this.lastDeviceRev = (deviceID & ~this.devFile.families[familyIndex].deviceIDMask) & 0xFFFFFFFF;
        }

        deviceID = deviceID & this.devFile.families[familyIndex].deviceIDMask; // mask off version bits
        this.lastDeviceID = deviceID;

        //console.log(`SEARCH_DEVICE: Family ${this.devFile.families[familyIndex].familyName} DeviceID = ${deviceID.toString(16)} Rev = ${this.lastDeviceRev.toString(16)}`);

        // Search through the device file to see if we find the part
        this.activePart = 0; // no device is default

        for(let partEntry = 0; partEntry < this.devFile.partsList.length; partEntry++){

            if(this.devFile.partsList[partEntry].family === familyIndex){

                // don't check deviceID if in a different family
                if(this.devFile.partsList[partEntry].deviceID === deviceID){

                    this.activePart = partEntry;
                    break; // found a match - get out of the loop
                }
            }
        }

        if(this.activePart === 0){ // not a known part
            // still need a buffer object in existance.
            if(lastPart !== 0){
                
                // IMPORTANT!! do a deep copy of the part buffer!
                this.devFile.partsList[this.activePart] = JSON.parse(JSON.stringify(this.devFile.partsList[lastPart]));
                this.devFile.partsList[this.activePart].deviceID = 0;
                this.devFile.partsList[this.activePart].partName = "Unsupported Part";
            }

            if(resetOnNoDevice){
                this.resetBuffers();
            }
            return false; // we're done
        }

        if((this.activePart === this.lastFoundPart) && (this.scriptBufferChecksum === this.getScriptBufferChecksum())){
            // same as the last part we were connected to
            return true; // don't need to download scripts as they should already be there
        }

        // Getting here means we've found a part, but it's a new one so we need to download the scripts
        this.downloadPartScripts(familyIndex);

        // create a new set of device buffers
        // If only need to redownload scripts, don't clear buffers
        if(this.activePart != this.lastFoundPart){

            this.resetBuffers();
        }

        // Get OSCCAL if exists
        if(this.devFile.partsList[this.activePart].OSSCALSave){

            this.VddOn();
            this.readOSSCAL();
        }

        if(this.devFile.partsList[this.activePart].bandGapMask > 0){
                
            this.VddOn();
            this.readBandGap();
        }

        if(!keepVddOn){

            this.vddOff();
        }

        return true;

    }

    static downloadPartScripts(familyIndex) {

        let command = new Array(1);
        command[0] = Constants.CLR_SCRIPT_BUFFER; // clear script buffer - we're loading new scripts

        let result = this.writeUSB(command);

        // clear the script redirect table
        for(let i = 0; i < this.scriptRedirectTable.length; i++){

            this.scriptRedirectTable[i].redirectToScriptLocation = 0;
            this.scriptRedirectTable[i].deviceFileScriptNumber = 0;
        }

        // program entry
        if(this.devFile.families[familyIndex].progEntryScript != 0){ // don't download non-existant scripts

            if(this.vppFirstEnabled && this.devFile.families[familyIndex].progEntryVPPScript != 0){

                // download VPP first program mode entry
                this.downloadScript(Constants.PROG_ENTRY, this.devFile.families[familyIndex].progEntryVPPScript);
            } else {
                // standard program mode entry
                this.downloadScript(Constants.PROG_ENTRY, this.devFile.families[familyIndex].progEntryScript);
            }
        }
        // program exit
        if(this.devFile.families[familyIndex].progExitScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.PROG_EXIT, this.devFile.families[familyIndex].progExitScript);
        }
        // read device ID
        if(this.devFile.families[familyIndex].readDevIDScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.RD_DEVID, this.devFile.families[familyIndex].readDevIDScript);
        }
        // read program memory
        if(this.devFile.partsList[this.activePart].progMemRdScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.PROGMEM_RD, this.devFile.partsList[this.activePart].progMemRdScript);
        }
        // chip erase prep
        if(this.devFile.partsList[this.activePart].chipErasePrepScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.ERASE_CHIP_PREP, this.devFile.partsList[this.activePart].chipErasePrepScript);
        }
        // set program memory address
        if(this.devFile.partsList[this.activePart].progMemAddrSetScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.PROGMEM_ADDRSET, this.devFile.partsList[this.activePart].progMemAddrSetScript);
        }
        // prepare for program memory write
        if(this.devFile.partsList[this.activePart].progMemWrPrepScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.PROGMEM_WR_PREP, this.devFile.partsList[this.activePart].progMemWrPrepScript);
        }
        // program memory write
        if(this.devFile.partsList[this.activePart].progMemWrScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.PROGMEM_WR, this.devFile.partsList[this.activePart].progMemWrScript);
        }
        // prep for ee read
        if(this.devFile.partsList[this.activePart].eeRdPrepScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.EE_RD_PREP, this.devFile.partsList[this.activePart].eeRdPrepScript);
        }
        // ee read
        if(this.devFile.partsList[this.activePart].eeRdScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.EE_RD, this.devFile.partsList[this.activePart].eeRdScript);
        }
        // prep for ee write
        if(this.devFile.partsList[this.activePart].eeWrPrepScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.EE_WR_PREP, this.devFile.partsList[this.activePart].eeWrPrepScript);
        }
        // ee write
        if(this.devFile.partsList[this.activePart].eeWrScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.EE_WR, this.devFile.partsList[this.activePart].eeWrScript);
        }
        // prep for config read
        if(this.devFile.partsList[this.activePart].configRdPrepScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.CONFIG_RD_PREP, this.devFile.partsList[this.activePart].configRdPrepScript);
        }
        // config read
        if(this.devFile.partsList[this.activePart].configRdScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.CONFIG_RD, this.devFile.partsList[this.activePart].configRdScript);
        }
        // prep for config write
        if(this.devFile.partsList[this.activePart].configWrPrepScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.CONFIG_WR_PREP, this.devFile.partsList[this.activePart].configWrPrepScript);
        }
        // config write
        if(this.devFile.partsList[this.activePart].configWrScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.CONFIG_WR, this.devFile.partsList[this.activePart].configWrScript);
        }
        // prep for user ID read
        if(this.devFile.partsList[this.activePart].userIDRdPrepScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.USERID_RD_PREP, this.devFile.partsList[this.activePart].userIDRdPrepScript);
        }
        // user ID read
        if(this.devFile.partsList[this.activePart].userIDRdScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.USERID_RD, this.devFile.partsList[this.activePart].userIDRdScript);
        }
        // prep for user ID write
        if(this.devFile.partsList[this.activePart].userIDWrPrepScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.USERID_WR_PREP, this.devFile.partsList[this.activePart].userIDWrPrepScript);
        }
        // user ID write
        if(this.devFile.partsList[this.activePart].userIDWrScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.USERID_WR, this.devFile.partsList[this.activePart].userIDWrScript);
        }
        // read OSCCAL
        if(this.devFile.partsList[this.activePart].OSCCALRdScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.OSSCAL_RD, this.devFile.partsList[this.activePart].OSCCALRdScript);
        }
        // write OSCCAL
        if(this.devFile.partsList[this.activePart].OSCCALWrScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.OSSCAL_WR, this.devFile.partsList[this.activePart].OSCCALWrScript);
        }
        // chip erase
        if(this.devFile.partsList[this.activePart].chipEraseScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.ERASE_CHIP, this.devFile.partsList[this.activePart].chipEraseScript);
        }
        // program memory erase
        if(this.devFile.partsList[this.activePart].progMemEraseScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.ERASE_PROGMEM, this.devFile.partsList[this.activePart].progMemEraseScript);
        }
        // ee erase
        if(this.devFile.partsList[this.activePart].eeMemEraseScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.ERASE_EE, this.devFile.partsList[this.activePart].eeMemEraseScript);
        }
        // row erase
        if(this.devFile.partsList[this.activePart].debugRowEraseScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.ROW_ERASE, this.devFile.partsList[this.activePart].debugRowEraseScript);
        }
        // test memory read
        if(this.devFile.partsList[this.activePart].testMemoryRdScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.TESTMEM_RD, this.devFile.partsList[this.activePart].testMemoryRdScript);
        }
        // ee row erase
        if(this.devFile.partsList[this.activePart].eeRowEraseScript != 0){ // don't download non-existant scripts

            this.downloadScript(Constants.EEROW_ERASE, this.devFile.partsList[this.activePart].eeRowEraseScript);
        }

        // get script buffer checksum
        this.scriptBufferChecksum = this.getScriptBufferChecksum();
    }

    static getScriptBufferChecksum() {

        if(this.learnMode){
            return 0;
        }

        let command = new Array(1);
        command[0] = Constants.SCRIPT_BUFFER_CHKSUM;

        if(this.writeUSB(command)){

            let data = this.readUSB();

            let checksum = data[3] & 0xFFFFFFFF;
            checksum += (data[2] << 8) & 0xFFFFFFFF;
            checksum += (data[1] << 16) & 0xFFFFFFFF;
            checksum += (data[0] << 24) & 0xFFFFFFFF;

            return checksum;
        } else {
            return 0;
        }
    }

    static downloadScript(scriptBufferLocation, scriptArrayIndex) {

        // see if we've already downloaded the script. Some devices use the same script
        // for different functions. Not downloading it several times saves space in the script buffer
        let redirectTo = scriptBufferLocation; // default doesn't redirect, calls itself

        for(let i = 0; i < this.scriptRedirectTable.length; i++){

            if(scriptArrayIndex === this.scriptRedirectTable[i].deviceFileScriptNumber){

                redirectTo = i; // redirect to this buffer location
                break;
            }
        }

        this.scriptRedirectTable[scriptBufferLocation].redirectToScriptLocation = redirectTo; // set redirection
        this.scriptRedirectTable[scriptBufferLocation].deviceFileScriptNumber = scriptArrayIndex; // set script number
        // note: since the FOR loop above always finds the first instance of a script, we don't have to
        // worry about redirecting to a redirect.
        if(scriptBufferLocation !== redirectTo){

            // we're redirecting
            return true; // we're all done
        }

        let scriptLength = this.devFile.scripts[--scriptArrayIndex].scriptLength;

        let command = new Array(3 + scriptLength);

        command[0] = Constants.DOWNLOAD_SCRIPT;
        command[1] = scriptBufferLocation & 0xFF;
        command[2] = scriptLength & 0xFF;

        for(let i = 0; i < scriptLength; i++){

            let scriptEntry = this.devFile.scripts[scriptArrayIndex].script[i] & 0xFFFF;

            if(this.fastProgramming){

                command[3 + i] = scriptEntry & 0xFF;
            } else {

                if(scriptEntry == 0xAAE7){
                    // delay short
                    let nextEntry = this.devFile.scripts[scriptArrayIndex].script[i + 1] & 0xFF;
                    if((nextEntry < 170) && (nextEntry !== 0)){

                        command[3 + i++] = scriptEntry & 0xFF;
                        let delay = this.devFile.scripts[scriptArrayIndex].script[i] & 0xFF;
                        command[3 + i] = delay + (delay/2) & 0xFF; // 1.5x delay
                    } else {

                        command[3 + i++] = Constants._DELAY_LONG;
                        command[3 + i] = 2;
                    }
                } else if(scriptEntry == 0xAAE8){
                    // delay long
                    let nextEntry = this.devFile.scripts[scriptArrayIndex].script[i + 1] & 0xFF;
                    if((nextEntry < 171) && (nextEntry !== 0)){
                        
                        command[3 + i++] = scriptEntry & 0xFF;
                        let delay = this.devFile.scripts[scriptArrayIndex].script[i] & 0xFF;
                        command[3 + i] = delay + (delay/2) & 0xFF; // 1.5x delay
                    } else {
                            
                        command[3 + i++] = Constants._DELAY_LONG;
                        command[3 + i] = 0; // max out
                    }
                } else {
                    command[3 + i] = scriptEntry & 0xFF;
                }
            }
        }

        return this.writeUSB(command);
    }

    static metaCmd_CHANGE_CHKSM_FRMT(format) {

        let command = new Array(3);

        command[0] = Constants.MC_CHANGE_CHKSM_FRMT;
        command[1] = format & 0xFF;
        command[2] = 0;

        return this.writeUSB(command);
    }
}

module.exports = PICkitFunctions;