/*
*Helper methods for various tasks
*
*/

//Dependencies
const crypto = require('crypto');
const config = require('./config');
const querystring = require('querystring');
const https = require('https');
const util = require('util');
const path = require('path');
const {fs} = require('./promisified');

helpers = {};
promisified = {};

promisified.request = util.promisify(https.request);

helpers.hash = (str) => {
    if (typeof(str) == 'string' && str.length > 0){
        return crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
    } else{
        return false;
    }
};

//Parse a string to an object without throwing
helpers.parseStringToObject = (str) => {
    try{
        return JSON.parse(str);
    } catch (err){
        return {};
    }
};

helpers.randomString = (length) => {
    length = typeof(length) == 'number' && length > 0? length : false;
    if (length) {
        let allowedChars = '0123456789abcdefghijklmnopqrstuvwxyz';
        let str = '';
        for (let i = 0; i < length; i++){
            str += allowedChars.charAt(Math.floor(Math.random() * allowedChars.length));
        }
        return str;
    } else {
        return false;
    }
};

helpers.sendTwilioSms = async (phone, message) => {
    return new Promise( (resolve, reject) => {

        //Validate params
        phone = typeof(phone) == 'string' 
            && phone.trim().length == 10 
            ? phone.trim() : false;

        message = typeof(message) == 'string' 
            && message.trim().length > 0 
            && message.trim().length < 1600 
            ? message.trim() : false;

        if (phone && message){
            //Configure the request payload
            let payload = {
                "From" : config.twilio.fromPhone,
                "To" : '+1'+phone,
                'Body': message
            };
            //Configure the request details
            let stringPayload = querystring.stringify(payload);
            let requestDetails = {
                'protocol': 'https:',
                'hostname' : 'api.twilio.com',
                'method' : 'POST',
                'path' : '/2010-04-01/Accounts/'+config.twilio.accountSid+'/Messages.json',
                'auth' : config.twilio.accountSid+':'+config.twilio.authToken,
                'headers': {
                    'Content-Type' : 'application/x-www-form-urlencoded',
                    'Content-Length' : Buffer.byteLength(stringPayload),
                }
            };
            //Instantiate a request object
            let req = https.request(requestDetails, (res) => {
                //Grab the status of the sent request
                var status = res.statusCode;

                //@TODO - REMOVE ME
                let buffer = '';
                res.on('data', (data)=>{
                    buffer += data;
                    console.log(buffer);
                });

                //Return success if the request went through
                if(status >= 200 && status < 300){
                    resolve();
                } else {
                    reject('Twilio rejected the request');
                    console.log(status);
                }
            });
            //Bind to the error event so it doesn't get thrown
            req.on('error', (error) => {
                reject(error);
            });

            //Add the payload
            req.write(stringPayload);

            //End the request
            req.end();

        } else {
            reject("Given parameters were missing or invalid"); 
        }
    });
};

helpers.getTemplate = async (templateName, data) => {
    templateName = typeof(templateName) == 'string' && templateName.length > 0 ? templateName : false;
    if (templateName) {
        let templatesDir = path.join(__dirname,'/../templates/');
        let templateStr = await fs.readFile(templatesDir+templateName+'.html', 'utf-8');
        if (templateStr && templateStr.length > 0){
            //Interpolate on the string
            let finalString = helpers.interpolate(templateStr, data);
            return finalString;
        } else {
            throw 'No template could be found'
        }
        
    } else {
        throw 'A valid template name was not provided'
    }
};

// Add the universal header and footer to a string and pass the provided data object passing the provided data object to them for interpolation
helpers.addUniversalTemplates = async (str, data) => {
    str = typeof(str) == 'string' && str.length > 0 ? str : '';
    data = typeof(data) == 'object' && data !== null ? data : {};
    //Get the header and footer
    let headerString = await helpers.getTemplate('_header', data);
    let footerString = await helpers.getTemplate('_footer', data);
    return headerString + str + footerString;
};

//Find and replace all keys in a string
helpers.interpolate = (str, data) => {
    str = typeof(str) == 'string' && str.length > 0 ? str : '';
    data = typeof(data) == 'object' && data !== null ? data : {};

    // Add the templateGlobals to the data object, prepending their key name with "global." - Note that these are TOP LEVEL key names!"
    for(let keyName in config.templateGlobals){
        if(config.templateGlobals.hasOwnProperty(keyName)){
            data['global-'+keyName] = config.templateGlobals[keyName];
        }
    }

    // For each key in the data object, insert its value into the string at the corresponding placeholder
    for (let key in data){
        if(data.hasOwnProperty(key) && typeof(data[key] == 'string')){
            let replace = data[key];
            let find = `{{${key}}}`;
            str = str.replace(find, replace);
        }
    }
    return str;
};

// Get the contents of a static (public asset)
helpers.getStaticAsset = async (fileName) => {
    fileName = typeof(fileName) == 'string' && fileName.length > 0 ? fileName : false;
    if(fileName){
        let publicDir = path.join(__dirname, '/../public/');
        let assetData = await fs.readFile(publicDir+fileName);
        return assetData;
    } else {
        throw 'A valid file name was not provided';
    }
};

module.exports = helpers;