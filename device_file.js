class DeviceFile {

    info;
    families = [];
    partsList = [];
    scripts = [];

    constructor() {

        this.info = new DeviceFileParams();
    }
}

class DeviceFileParams {
    
    versionMajor;
    versionMinor;
    versionDot;

    versionNotes;

    numberFamilies;
    numberParts;
    numberScripts;
    compatibility;
    UNUSED1A;
    UNUSED1B;
    UNUSED2;


}

class DeviceFamilyParams {

    familyID;
    familyType;
    searchPriority;
    familyName;
    progEntryScript;
    progExitScript;
    readDevIDScript;
    deviceIDMask;
    blankValue;
    bytesPerLocation;
    addressIncrement;
    partDetect;
    progEntryVPPScript;
    UNUSED1;
    eeMemBytesPerWord;
    eeMemAddressIncrement;
    userIDHexBytes;
    userIDBytes;
    progMemHexBytes;
    eeMemHexBytes;
    progMemShift;
    testMemoryStart;
    testMemoryLength;
    vpp;
}

class DevicePartParams {

    partName;
    family;
    deviceID;
    programMem;
    eeMem;
    eeAddr;
    configWords;
    configAddr;
    userIDAddr;
    userIDWords;
    userIDAddr;
    bandGapMask;
    configMasks = [];
    configBlank = [];
    cpMask;
    cpConfig;
    OSSCALSave;
    ignoreAddress;
    vddMin;
    vddErase;
    calibrationWords;
    chipEraseScript;
    progMemAddrSetScript;
    progMemAddrBytes;
    progMemRdScript;
    eeRdPrepScript;
    eeRdScript;
    eeRdLocations;
    userIDRdPrepScript;
    userIDRdScript;
    configRdPrepScript;
    configRdScript;
    progMemWrPrepScript;
    progMemWrScript;
    progMemWrWords;
    progMemPanelBufs;
    progMemPanelOffset;
    eeWrPrepScript;
    eeWrScript;
    eeWrLocations;
    userIDWrPrepScript;
    userIDWrScript;
    configWrPrepScript;
    configWrScript;
    OSCCALRdScript;
    OSCCALWrScript;
    dPMask;
    writeCfgOnErase;
    blankCheckSkipUsrIDs;
    ignoreBytes;
    chipErasePrepScript;
    bootFlash;
    UNUSED4;
    progMemEraseScript;
    eeMemEraseScript;
    configMemEraseScript;
    reserved1EraseScript;
    reserved2EraseScript;
    testMemoryRdScript;
    testMemoryRdWords;
    eeRowEraseScript;
    eeRowEraseWords;
    exportToMPLAB;
    debugHaltScript;
    debugRunScript;
    debugStatusScript;
    debugReadExecVerScript;
    debugSingleStepScript;
    debugBulkWrDataScript;
    debugBulkRdDataScript;
    debugWriteVectorScript;
    debugReadVectorScript;
    debugRowEraseScript;
    debugRowEraseSize;
    debugReserved5Script;
    debugReserved6Script;
    debugReserved7Script;
    debugReserved8Script;
    debugReserved9Script;
}

class DeviceScripts {

    scriptNumber;
    scriptName;
    scriptVersion;
    UNUSED1;
    scriptLength;
    script = [];
    comment;
}

exports.DeviceFile = DeviceFile;
exports.DeviceFileParams = DeviceFileParams;
exports.DeviceFamilyParams = DeviceFamilyParams;
exports.DevicePartParams = DevicePartParams;
exports.DeviceScripts = DeviceScripts;