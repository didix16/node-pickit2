let fs = require('fs');
let path = require('path');

const Constants = require('./constants');
const PK2 = require('./pickit_functions');
const TextReader = require('./text_reader');

class ImportExportHex {

    lastWriteTime = Date.now();

    static getLastWriteTime(){
            
        return this.lastWriteTime;
    }

    static getFileLastWriteTime(filePath){

        let stats = fs.statSync(filePath);
        return stats.mtime.getTime();
    }

    static async importHexFile(filePath, progMem, eeMem){

        // NOTE: The device buffers being read into must all be set to blank value before getting here!
        
        try {

            let stats = fs.statSync(filePath);
            let extension = path.extname(filePath).toUpperCase();

            this.lastWriteTime = stats.mtime.getTime();

            TextReader.openFile(filePath);

            let family = PK2.devFile.families[PK2.getActiveFamily()];
            let partList = PK2.devFile.partsList[PK2.getActivePart()];

            let bytesPerWord = family.progMemHexBytes;
            let eeMemBytes = family.eeMemHexBytes;
            let eeAddr = partList.eeAddr >>> 0;
            let progMemSizeBytes = (partList.programMem * bytesPerWord) & 0xFFFFFFFF;
            let segmentAddress = 0;
            let configRead = false;
            let lineExceedsFlash = true;
            let fileExceedsFlash = false;
            let userIDs = partList.userIDWords;
            let userIDAddr = partList.userIDAddr;

            if(userIDAddr === 0){

                userIDAddr = 0xFFFFFFFF;
            }

            let userIDMemBytes = family.userIDHexBytes;
            // need to set config words to memory blank
            let configWords = partList.configWords;
            let configLoaded = new Array(configWords).fill(false);

            for(let cw = 0; cw < configWords; cw++){

                PK2.deviceBuffers.configWords[cw] = family.blankValue;
                configLoaded[cw] = false;
            }

            let cfgBytesPerWord = bytesPerWord;
            let programMemStart = 0;
            let bootMemStart = 0;
            let bootMemSize = partList.bootFlash;

            if(family.blankValue > 0xFFFFFF){
                // PIC32
                programMemStart = Constants.P32_PROGRAM_FLASH_START_ADDR;
                bootMemStart = Constants.P32_BOOT_FLASH_START_ADDR;
                progMemSizeBytes -= bootMemSize * bytesPerWord;
                progMemSizeBytes += programMemStart;
                cfgBytesPerWord = 2;
            }

            let bootMemEnd = bootMemStart + bootMemSize * bytesPerWord;
            let bootArrayStart = partList.programMem - bootMemSize;

            for await (const line of TextReader.readLines()){

                console.log(`Line from file: ${line}`);

                if(line[0] === ':' && line.length >= 11){
                    // skip line if not hex line entry, or not minimum length ":BBAAAATTCC"

                    let byteCount = parseInt(line.substring(1, 3), 16);
                    let fileAddress = segmentAddress + parseInt(line.substring(3, 7), 16);
                    let recordType = parseInt(line.substring(7, 9), 16);

                    if(recordType === 0){
                        // Data Record
                        if(line.length >= (11 + (2 * byteCount))){
                            // skip line isn't long enough for byte count

                            for(let lineByte = 0; lineByte < byteCount; lineByte++){

                                let byteAddress = fileAddress + lineByte;
                                // compute array address from hex file address # bytes per memory location
                                let arrayAddress = ((byteAddress - programMemStart) / bytesPerWord) & 0xFFFFFFFF;
                                // compute byte position within memory word
                                let bytePosition = byteAddress % bytesPerWord;
                                // get the byte value from hex file
                                let wordBye = ((0xFFFFFF00 | parseInt(line.substring(9 + (2 * lineByte), 11 + (2 * lineByte)), 16)) & 0xFFFFFFFF) >>> 0;
                                // shift the byte into its proper position in the word
                                for(let shift = 0; shift < bytePosition; shift++){

                                    wordBye <<= 8;
                                    wordBye |= 0xFF; // shift in ones
                                }

                                lineExceedsFlash = true; // if not in any memory section, then error

                                // Program Memory Section
                                if((byteAddress >= programMemStart) && (byteAddress < progMemSizeBytes)){

                                    if(progMem){
                                        // if imporing program memory
                                        PK2.deviceBuffers.programMemory[arrayAddress] &= wordBye; // add byte 
                                    }
                                    lineExceedsFlash = false;
                                    // NOTE: program memory locations containing config words may get modified
                                    // by the config section below that applies the config masks.
                                }

                                // Boot Memory Section
                                if((bootMemSize > 0) && (byteAddress >= bootMemStart) && (byteAddress < bootMemEnd)){

                                    arrayAddress = bootArrayStart + ((byteAddress - bootMemStart) / bytesPerWord);
                                    if(progMem){
                                        // if importing program memory
                                        PK2.deviceBuffers.programMemory[arrayAddress] &= wordBye; // add byte
                                    }
                                    lineExceedsFlash = false;
                                    // NOTE: program memory locations containing config words may get modified
                                    // by the config section below that applies the config masks.
                                }

                                // EE data section
                                if((byteAddress >= eeAddr) && (eeAddr > 0) && (partList.eeMem > 0)){

                                    let eeAddress = (byteAddress - eeAddr) / eeMemBytes;
                                    if(eeAddress < partList.eeMem){

                                        lineExceedsFlash = false;
                                        if(eeMem){
                                            // skip if not importing ee memory
                                            if(eeMemBytes === bytesPerWord){
                                                // same # hex bytes per ee location as progMem location
                                                PK2.deviceBuffers.eePromMemory[eeAddress] &= wordBye; // add byte
                                            } else {
                                                // PIC18F/J
                                                let eeshift = (bytePosition / eeMemBytes) * eeMemBytes;
                                                for(let reshift = 0; reshift < eeshift; reshift++){
                                                    // shift byte into proper position
                                                    wordBye >>= 8;
                                                }
                                                PK2.deviceBuffers.eePromMemory[eeAddress] &= wordBye; // add byte

                                            }
                                        }
                                    }
                                } // Some 18F parts without EEPROM have hex files created with blank EEPROM by MPLAB
                                else if((byteAddress >= eeAddr) && (eeAddr > 0) && partList.eeMem === 0){
                                    
                                    lineExceedsFlash = false; // don't give too-large file error
                                }

                                // Config Words Section
                                if((byteAddress >= partList.configAddr) && (configWords > 0)){

                                    let configNum = ((byteAddress - (partList.configAddr)) / cfgBytesPerWord) & 0xFFFFFFFF;

                                    if((cfgBytesPerWord !== bytesPerWord) && (bytePosition > 1))
                                    {
                                        // PIC32
                                        wordBye = (wordBye >>> 16) & family.blankValue;
                                    }

                                    if(configNum < partList.configWords)
                                    {
                                        lineExceedsFlash = false;
                                        configRead = true;
                                        configLoaded[configNum] = true;
                                        if(progMem){
                                            // if importing program memory
                                            PK2.deviceBuffers.configWords[configNum] &= (wordBye & partList.configMasks[configNum]);

                                            if(family.blankValue === 0xFFF){
                                                // baseline, set OR mask bits
                                                PK2.deviceBuffers.configWords[configNum] |= partList.configMasks[5];
                                            }

                                            if(byteAddress < progMemSizeBytes)
                                            {
                                                // also mask off the word if in program memory
                                                let orMask = 0;
                                                if(family.blankValue === 0xFFFF){
                                                    // PIC18J
                                                    orMask = 0xF000;
                                                } else {
                                                    // PIC24 is currently only other case of config in program mem
                                                    orMask = ((0xFF0000 | (partList.configBlank[configNum] & ~partList.configMasks[configNum])) & 0xFFFFFFFF) >>> 0;
                                                }
                                                PK2.deviceBuffers.programMemory[arrayAddress] &= (wordBye & partList.configMasks[configNum]); // add byte
                                                PK2.deviceBuffers.programMemory[arrayAddress] |= orMask;
                                            }
                                        }
                                    }
                                }

                                // User IDs Section
                                if(userIDs > 0){

                                    if(byteAddress >= userIDAddr){

                                        let uIDAddress = ((byteAddress - userIDAddr) / userIDMemBytes) & 0xFFFFFFFF;
                                        if(uIDAddress < userIDs){

                                            lineExceedsFlash = false;
                                            if(progMem){
                                                // if importing program memory

                                                if(userIDMemBytes === bytesPerWord){
                                                    // same # hex bytes per ee location as progMem location
                                                    PK2.deviceBuffers.userIDs[uIDAddress] &= wordBye; // add byte
                                                } else {
                                                    // PIC18F/J, PIC24H/dsPIC33
                                                    let uIDshift = (bytePosition / userIDMemBytes) * userIDMemBytes;
                                                    for(let reshift = 0; reshift < uIDshift; reshift++){
                                                        // shift byte into proper position
                                                        wordBye >>= 8;
                                                    }
                                                    PK2.deviceBuffers.userIDs[uIDAddress] &= wordBye; // add byte
                                                }

                                            }
                                        }
                                    }
                                }

                                // ignore data in hex file
                                if(partList.ignoreBytes > 0){

                                    if(byteAddress >= partList.ignoreAddress){

                                        if(byteAddress < (partList.ignoreAddress + partList.ignoreBytes)){

                                            // if data is in the ignore region, don't do anything with it
                                            // but don't genearate a "hex file larger than device" warning
                                            lineExceedsFlash = false;
                                        }
                                    }
                                }

                                // skip test memory section


                            }
                        }

                        if(lineExceedsFlash){

                            fileExceedsFlash = true;
                        }
                    } // end if recordType === 0

                    if(recordType === 2 || recordType === 4){

                        // segment address
                        if(line.length >= (11 + (2 * byteCount))){
                            // skip if line isn't long enough for bytecount
                            segmentAddress = parseInt(line.substring(9, 13), 16);
                        }

                        if(recordType === 2){

                            segmentAddress <<= 4;
                        } else {
                            segmentAddress <<= 16;
                        }

                    } // end if recordType === 2 || recordType === 4

                    if(recordType === 1){
                        // end of record
                        break;
                    }

                    if(extension === '.NUM'){
                        // only read first line of SQTP file
                        break;
                    }

                }
            }

            if(configWords > 0){

                if(!configRead){

                    return Constants.FILEREAD.NOCONFIG;
                }

                for(let cw = 0; cw < configWords; cw++){

                    if(!configLoaded[cw]){

                        return Constants.FILEREAD.PARTIALCFG;
                    }
                }
            }

            if(fileExceedsFlash){

                return Constants.FILEREAD.LARGEMEM
            }

            return Constants.FILEREAD.SUCCESS;


        }catch(e){

            return Constants.FILEREAD.FAILED;
        }
    }
}

module.exports = ImportExportHex;