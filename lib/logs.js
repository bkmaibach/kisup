/*
* Library for storing and rotating logs
*
*/
const path = require('path');
const {fs} = require('./promisified');
const {zlib} = require('./promisified');
const util = require('util');

const debug = util.debuglog('logs');

//Container for module
let lib = {};

lib.baseDir = path.join(__dirname, '/../.logs/');

//Append a string to a file, create if non existant

lib.append = async (file, str) => {
    debug('Appending file ', lib.baseDir+file+'.log');
    let fd = await fs.open(lib.baseDir+file+'.log', 'a');
    await fs.appendFile(fd, str+'\n');
    await fs.close(fd);
};

lib.list = async (includeCompressed) => {
    let fileNames = await fs.readdir(lib.baseDir);
    debug(fileNames[0]);
    if (fileNames.length > 0){
        let trimmedFileNames = [];
        fileNames.forEach(element => {
            // Add the .log files
            if(element.indexOf('.log') > -1){
                trimmedFileNames.push(element.replace('.log', ''));
            }

            //Add on the .gz files
            if(element.indexOf('.gz.b64') > -1 && includeCompressed){
                trimmedFileNames.push(element.replace('.gz.b64', ''));
            }
        });
        return trimmedFileNames;
    } else {
        throw 'The directory is empty'
    }
};

//Acts on one .log file to create a .gz.b64 file in the same directory
lib.compress = async (logId, newFileId) => {
    let sourceFile = logId+'.log';
    let destFile = newFileId+'.gz.b64';

    //Read the source file
    let toCompress = await fs.readFile(lib.baseDir+sourceFile,'utf-8');
    let buffer = await zlib.gzip(toCompress);

    //Send the new data to the destination file
    let fd = await fs.open(lib.baseDir+destFile, 'wx');
    await fs.writeFile(fd, buffer.toString('base64'));
    await fs.close(fd);
};

lib.decompress = async (fileId) => {
    let fileName = fieldId+'gz.b64';
    let fileString = await fs.readFile(lib.baseDir+fileName,'utf-8');
    let inputBuffer = Buffer.from(fileString, 'base64');
    let outputBuffer = await zlib.unzip(inputBuffer);
    let returnString = outputBuffer.toString();
    return returnString;
};

lib.truncate = async (logId) => {
    await fs.truncate(lib.baseDir+logId+'.log', 0);
};

//Export
module.exports = lib;