let fs = require('fs');
let readLine = require('readline');


class TextReader {

    fileSteam = null;
    rl = null;
    
    static openFile(filePath){

        this.fileSteam = fs.createReadStream(filePath);

        this.rl = readLine.createInterface({
            input: this.fileSteam,
            crlfDelay: Infinity
        });
        
    }

    static async *readLines(){

        for await (const line of this.rl){

            yield line;
        }
    }
}

module.exports = TextReader;