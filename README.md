# node-pickit2
Microchip's PICKIT 2 software port written in Vanilla Javascript. It only supports PIC18F_K_ family. Feel free to expand for more families.

The code is originally picked up from C# PicKit 2 application source code at [Pickit 2 PC Application Source Code v2.61](https://ww1.microchip.com/downloads/aemDocuments/documents/OTH/ProductDocuments/SoftwareLibraries/Firmware/PICkit2_PCAppSource_V2_61.zip)

I leave the code here in the repository in case link above does not work anymore. [PICkit2_PCAppSource_V2_61.zip](PICkit2_PCAppSource_V2_61.zip)

You can find more source code for firmwares and application source versions by searching 'PicKit' on their web page at https://www.microchip.com/en-us/search?searchQuery=PicKit&category=ALL&fq=start%3D0%26rows%3D500

# Requirements

The application runs on Node.JS 16.13+ for backend and use electron ^24.2+ for frontend. It has makers for Windows (squirrel), Linux (deb and rpm) and Mac OS X (zip).

- Node.JS ^16.13+
- Electron ^24.2+
- node-hid ^2.1.2 package for USB Human Interface Device communication

# Install

The following command will install all necessary packages for development and build tools and packages.

With npm
```bash
$ npm install
```

With yarn
```bash
$ yarn install
```

# Run

With npm
```bash
$ npm run start
```

With yarn
```bash
$ yarn start
```

# Compile

Compile node-hid for electron.

With npm
```bash
$ npm run postinstall
```

With yarn
```bash
$ yarn postinstall
```

# Build

Build for the current executing platform

with npm
```bash
$ npm run build
```

with yarn
```bash
$ yarn build
```

The output will be located at out/node-pickit2-{platform}.
Also don't forget to copy ```PK2DeviceFile.dat``` to main folder root of binary executable of node-pickit2.