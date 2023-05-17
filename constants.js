let Constants = {

    USB_REPORTLENGTH: 64,

    MICROCHIP_VENDOR_ID: 0x04d8,
    PICKIT2_PRODUCT_ID: 0x0033,

    VDD_THRESHOLD_FOR_SELF_POWERED_TARGET: 2.3,

    UPLOAD_BUFFER_SIZE: 128,
    DOWNLOAD_BUFFER_SIZE: 256,

    OSCCAL_MASK: 7,
    NUM_CONFIG_MASKS: 8,

    // EEPROM config words
    PROTOCOL_CFG: 0,
    ADR_MASK_CFG: 1,
    ADR_BITS_CFG: 2,
    CS_PINS_CFG : 3,

    // EEPROM Protocols
    I2C_BUS      : 1,
    SPI_BUS      : 2,
    MICROWIRE_BUS: 3,
    UNIO_BUS     : 4,
    READ_BIT:  true,
    WRITE_BIT: false,

    // Commands
    FIRMWARE_VERSION: 0x76,
    SETVDD: 0xA0,
    SETVPP: 0xA1,
    READ_STATUS: 0xA2,
    READ_VOLTAGES: 0xA3,
    DOWNLOAD_SCRIPT: 0xA4,
    RUN_SCRIPT: 0xA5,
    EXECUTE_SCRIPT: 0xA6,
    CLR_DOWNLOAD_BUFFER: 0xA7,
    DOWNLOAD_DATA: 0xA8,
    CLR_UPLOAD_BUFFER: 0xA9,
    UPLOAD_DATA: 0xAA,
    CLR_SCRIPT_BUFFER: 0xAB,
    UPLOAD_DATA_NOLEN: 0xAC,
    SCRIPT_BUFFER_CHKSUM: 0xAF,
    RD_INTERNAL_EE: 0xB2,
    EXIT_UART_MODE: 0xB4,

    // META COMMANDS
    MC_READ_OSCCAL: 0x80,
    MC_WRITE_OSCCAL: 0x81,
    MC_START_CHECKSUM: 0x82,
    MC_VERIFY_CHECKSUM: 0x83,
    MC_CHECK_DEVICE_ID: 0x84,
    MC_READ_BANDGAP: 0x85,
    MC_WRITE_CFG_BANDGAP: 0x86,
    MC_CHANGE_CHKSM_FRMT: 0x87,

    // Script Commands?
    _VDD_ON: 0xFF,
    _VDD_OFF: 0xFE,
    _VDD_GND_ON: 0xFD,
    _VDD_GND_OFF: 0xFC,
    _MCLR_GND_ON: 0xF7,
    _MCLR_GND_OFF: 0xF6,
    _BUSY_LED_ON: 0xF5,
    _SET_ICSP_SPEED: 0xEA,
    _DELAY_LONG: 0xE8,

    SEARCH_ALL_FAMILIES: 0xFFFFFF,

    // Script Buffer Reserved Locations
    PROG_ENTRY     : 0,
    PROG_EXIT      : 1,
    RD_DEVID       : 2,
    PROGMEM_RD     : 3,
    ERASE_CHIP_PREP: 4,
    PROGMEM_ADDRSET: 5,
    PROGMEM_WR_PREP: 6,
    PROGMEM_WR     : 7,
    EE_RD_PREP     : 8,
    EE_RD          : 9,
    EE_WR_PREP     : 10,
    EE_WR          : 11,
    CONFIG_RD_PREP : 12,
    CONFIG_RD      : 13,
    CONFIG_WR_PREP : 14,
    CONFIG_WR      : 15,
    USERID_RD_PREP : 16,
    USERID_RD      : 17,
    USERID_WR_PREP : 18,
    USERID_WR      : 19,
    OSSCAL_RD      : 20,
    OSSCAL_WR      : 21,
    ERASE_CHIP     : 22,
    ERASE_PROGMEM  : 23,
    ERASE_EE       : 24,
    //ERASE_CONFIG   : 25,
    ROW_ERASE      : 26,
    TESTMEM_RD     : 27,
    EEROW_ERASE    : 28,

    PICKIT2USB: {

        FOUND: 0,
        NOT_FOUND: 1,
        WRITE_ERROR: 2,
        READ_ERROR: 3,
        FIRMWARE_INVALID: 4,
        BOOTLOADER: 5,

    },

    PICKIT2PWR : {
        NO_RESPONSE: 0,
        VDD_ON: 1,
        VDD_OFF: 2,
        VDDERROR: 3,
        VPPERROR: 4,
        VDDVPPERRORS: 5,
        SELFPOWERED: 6,
        UNPOWERED: 7,
    },

    FILEREAD: {

        SUCCESS: 0,
        FAILED: 1,
        NOCONFIG: 2,
        PARTIALCFG: 3,
        LARGEMEM: 4
    },

    // PICkit 2 internal EEPROM Locations
    ADC_CAL_L : 0x00,
    ADC_CAL_H : 0x01,
    CPP_OFFSET: 0x02,
    CPP_CAL   : 0x03,
    UNIT_ID   : 0xF0,

    // PIC 32 related
    P32_PROGRAM_FLASH_START_ADDR: 0x1D000000,
    P32_BOOT_FLASH_START_ADDR: 0x1FC00000,
};

module.exports = Constants;