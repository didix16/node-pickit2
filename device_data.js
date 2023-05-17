class DeviceData {

    programMemory = [];
    eePromMemory = [];
    configWords = [];
    userIDs = [];
    OSCCAL;
    bandGap;

    constructor(progMemSize, eeMemSize, numConfigs, numIDs,
        memBlankVal, eeBytes, idBytes, configBlank, OSCCALinit) {

        this.programMemory = new Array(progMemSize);
        this.eePromMemory = new Array(eeMemSize);
        this.configWords = new Array(numConfigs);
        this.userIDs = new Array(numIDs);

        // init program memory to blank
        this.clearProgramMemory(memBlankVal);

        // init eeProm to blank
        this.clearEEPromMemory(eeBytes, memBlankVal);

        // init configuration to blank
        this.clearConfigWords(configBlank);

        // init userIDs to blank
        this.clearUserIDs(idBytes, memBlankVal);

        // init OSCCAL & bandGap
        this.OSCCAL = OSCCALinit | 0xFF;
        this.bandGap = memBlankVal;

    }

    clearProgramMemory(memBlankVal) {

        if(this.programMemory.length > 0) {
            for (let i = 0; i < this.programMemory.length; i++) {
                this.programMemory[i] = memBlankVal;
            }
        }
    }

    clearConfigWords(configBlank) {

        if(this.configWords.length > 0) {
            for (let i = 0; i < this.configWords.length; i++) {
                this.configWords[i] = configBlank[i];
            }
        }
    }

    clearUserIDs(idBytes, memBlankVal) {

        if(this.userIDs.length > 0) {

            let idBlank = memBlankVal;
            
            if(idBytes == 1) {

                idBlank = 0xFF;
            }

            for (let i = 0; i < this.userIDs.length; i++) {
                this.userIDs[i] = idBlank;
            }
        }
    }

    clearEEPromMemory(eeBytes, memBlankVal) {

        if(this.eePromMemory.length > 0) {

            let eeBlankVal = 0xFF;
            
            if(eeBytes == 2) {

                eeBlankVal = 0xFFFF;
            }

            if(memBlankVal == 0xFFF) {

                eeBlankVal = 0xFFF;
            }

            for (let i = 0; i < this.eePromMemory.length; i++) {
                this.eePromMemory[i] = eeBlankVal;
            }
        }
    }
}

module.exports = DeviceData;