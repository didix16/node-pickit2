const PICkitFunctions = require('./pickit_functions.js');
const Constants = require('./constants.js');
let searchOnStartup = true;

PICkitFunctions.readDeviceFile('PK2DeviceFile.dat');

PICkitFunctions.resetBuffers();

PICkitFunctions.detectPICkit2Device();

PICkitFunctions.exitUARTMode(); // just in case we are still in UART mode

PICkitFunctions.vddOff();

PICkitFunctions.setVddVoltage(3.3, 0.85);

// set programming speed as FAST
PICkitFunctions.setProgrammingSpeed(0);

let voltages = PICkitFunctions.readPICkitVoltages();

if(voltages.status){

    console.log(`PICkit2 VDD: ${voltages.vdd.toFixed(2)}V, VPP: ${voltages.vpp.toFixed(2)}V`);
}

console.log('Dettecting Device...');
if(searchOnStartup && PICkitFunctions.detectDevice(Constants.SEARCH_ALL_FAMILIES, true, false)){

    console.log(`Device Detected: ${PICkitFunctions.getDeviceName()}`);
}else {

    console.log('No Device Detected');
}