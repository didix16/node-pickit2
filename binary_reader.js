/**
 * Simple port of BinaryReader from C# to JavaScript
 */

class BinaryReader {

    buffer;
    offset = 0;

    constructor(buffer) {
        this.buffer = buffer;
    }

    readByte() {
        return this.buffer.readUInt8(this.offset++);
    }

    readBoolean() {
        return this.readByte() != 0;
    }

    readInt16() {
        let value = this.buffer.readInt16LE(this.offset);
        this.offset += 2;
        return value;
    }

    readUInt16() {
        let value = this.buffer.readUInt16LE(this.offset);
        this.offset += 2;
        return value;
    }

    readInt32() {
        let value = this.buffer.readInt32LE(this.offset);
        this.offset += 4;
        return value;
    }

    readUInt32() {
        let value = this.buffer.readUInt32LE(this.offset);
        this.offset += 4;
        return value;
    }

    readSingle() {
        let value = this.buffer.readFloatLE(this.offset);
        this.offset += 4;
        return value;
    }

    readDouble() {
        let value = this.buffer.readDoubleLE(this.offset);
        this.offset += 8;
        return value;
    }

    read7BitEncodedInt() {
        let count = 0;
        let shift = 0;
        let b;
        do {
            b = this.readByte();
            count |= (b & 0x7F) << shift;
            shift += 7;
        } while ((b & 0x80) != 0);
        return count;
    }

    readString() {
        let length = this.read7BitEncodedInt();
        let value = this.buffer.toString('ascii', this.offset, this.offset + length);
        this.offset += length;
        return value;
    }

}

module.exports = BinaryReader;