/*
*Worker related tasks
*
*/

// Dependencies
const _data = require('./data');
const http = require('http');
const https = require('https');
const helpers = require('./helpers');
const url = require('url');
const _logs = require('./logs');
const util = require('util');

const debug = util.debuglog('workers');

//Instantiate the worker object
var workers = {};

//Lookup all checks, get their data, send to a validator
workers.gatherAllChecks = async () => {
    try{
        let checks = await _data.list('checks');
        if (checks && checks.length > 0){
            checks.forEach(async (checkId) => {
                let originalCheckData = await _data.read('checks', checkId);
                workers.validateCheckAndBegin(originalCheckData);
            });
        } else {
            debug('Error: there are no checks to process');
        }
    } catch (error){
        debug(error);
    }   
};

//Sanity checking the check data
workers.validateCheckAndBegin = (originalCheckData) => {
    //Start with original check data validation
    originalCheckData = typeof(originalCheckData) == 'object' 
        && originalCheckData !== null
        ? originalCheckData : {};

    originalCheckData.id = typeof(originalCheckData.id) == 'string'
        && originalCheckData.id.trim().length == 20
        ? originalCheckData.id.trim() : false;

    originalCheckData.userPhone = typeof(originalCheckData.userPhone) == 'string'
        && originalCheckData.userPhone.trim().length == 10
        ? originalCheckData.userPhone.trim() : false;

    originalCheckData.protocol = typeof(originalCheckData.protocol) == 'string'
        && ['http', 'https'].indexOf(originalCheckData.protocol) > -1
        ? originalCheckData.protocol : false;

    originalCheckData.url = typeof(originalCheckData.url) == 'string'
        && originalCheckData.url.trim().length > 0
        ? originalCheckData.url.trim() : false;

    originalCheckData.method = typeof(originalCheckData.method) == 'string'
        && ['post', 'get', 'put', 'delete'].indexOf(originalCheckData.method) > -1
        ? originalCheckData.method : false;

    originalCheckData.successCodes = typeof(originalCheckData.successCodes) == 'object'
        && originalCheckData.successCodes instanceof Array
        ? originalCheckData.successCodes : false;

    originalCheckData.timeoutSeconds = typeof(originalCheckData.timeoutSeconds) == 'number'
        && originalCheckData.timeoutSeconds % 1 === 0
        && originalCheckData.timeoutSeconds > 0
        && originalCheckData.timeoutSeconds < 5
        ? originalCheckData.timeoutSeconds : false;

    //Set two new keys, state and lastChecked
    originalCheckData.state = typeof(originalCheckData.state) == 'string'
        && ['up', 'down'].indexOf(originalCheckData.state) > -1
        ? originalCheckData.state : 'down';

    originalCheckData.lastChecked = typeof(originalCheckData.lastChecked) == 'number'
        && originalCheckData.lastChecked > 0
        ? originalCheckData.lastChecked : false;

    if(originalCheckData.id 
    && originalCheckData.userPhone
    && originalCheckData.protocol
    && originalCheckData.url
    && originalCheckData.successCodes
    && originalCheckData.timeoutSeconds){
        workers.performCheck(originalCheckData);
    } else {
        debug('Check ' + originalCheckData.id + ' is malformed');
    }
};

//Perform the check
workers.performCheck = async (originalCheckData) => {
    //Prepare the initial check out come
    let checkOutcome = {
        'error' : false,
        'responseCode' : false
    };

    // Mark that the outcome has not yet been sent
    let outcomeSent = false;

    //Parse the hostname and the path out of the original check data
    //debug('url: ' + originalCheckData.url);
    debug('checking: ' + originalCheckData.protocol+'://'+originalCheckData.url);
    let parsedUrl = url.parse(originalCheckData.protocol+'://'+originalCheckData.url, true);
    let hostName = parsedUrl.hostname;
    let path = parsedUrl.path; //path will contain the query string, as opposed to pathname

    //Construct the request
    let requestDetails = {
        'protocol': originalCheckData.protocol + ':',
        'hostname' : hostName,
        'method' : originalCheckData.method.toUpperCase(),
        'path' : path,
        'timeout' : originalCheckData.timeoutSeconds * 1000
    };

    let _moduleToUse = originalCheckData.protocol == 'http' ? http : https;

    let req = _moduleToUse.request(requestDetails, (res) => {
        let status = res.statusCode;

        //Update the check outcome and pass the data along
        checkOutcome.responseCode = status;
        if(!outcomeSent){
            workers.processCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });
    //Bind to the error event so it doesnt stop the thread
    req.on('error', (err) => {
        //Update the checkOutcome and pass data along
        debug('GENERAL ERROR TRIGGERED');
        //debug(err);
        checkOutcome.error = {
            'error' : true,
            'value' : err
        }
        if(!outcomeSent){
            workers.processCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    //Bind to the timeout event so it doesnt stop the thread
    req.on('timeout', (error) => {
        //Update the checkOutcome and pass data along
        debug('TIMEOUT ERROR TRIGGERED');
        checkOutcome.error = {
            'error' : true,
            'value' : 'timeout'
        }
        if(!outcomeSent){
            workers.processCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    //End the request
    req.end();
};

//Process the check outcome and update the check data as needed, trigger and alert if needed
//Special logic for accomodating a check that has never been tested before ie lastChecked = false
workers.processCheckOutcome = async (originalCheckData, checkOutcome) => {
    //Decide if the check is considered up or down
    //the "is up" in kisup :D
    //debug('checkOutcome.error: '+ checkOutcome.error);
    //debug('originalCheckData.successCodes: '+ originalCheckData.successCodes);
    //debug('checkOutcome.responseCode: '+ checkOutcome.responseCode);

    let state = !checkOutcome.error 
        && checkOutcome.responseCode 
        && originalCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1
        ? 'up' : 'down';

        //Decide if an alert is needed - ie it was previously up and went to down or vice-versa
        let alertWarranted = originalCheckData.lastChecked && originalCheckData.state !== state;
        let timeOfCheck = Date.now();

        // Update the check data
        let newCheckData = originalCheckData;
        originalCheckData.state = state;
        newCheckData.lastChecked = timeOfCheck;

        //Log the outcome
        workers.log(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck);

        //Log the original check data

        // Save the updates
        try{
            await _data.update('checks', originalCheckData.id, newCheckData);
            
            //Send the alert if needed
            if(alertWarranted){
                workers.alertUserToStatusChange(newCheckData);
            }
        } catch (error){
            debug('Error saving new check data: ' + error);
        }
};

//Alert the user as to a change in their check status
workers.alertUserToStatusChange = async (newCheckData) => {
    var message = 'Alert: your check for '+newCheckData.method.toUpperCase()+' '+newCheckData.protocol+'://'+newCheckData.url+' is currently ' + newCheckData.state;
    try {
        await helpers.sendTwilioSms(newCheckData.userPhone, message);
        debug('Success! User was alerted to a status change in their check via SMS')
    } catch (error){
        debug(error);
    }
    
};

workers.log = (check, outcome, state, alert, time) => {
    //Form the log data
    let logData = {
        check,
        outcome,
        state,
        alert,
        time
    };

    //Create a string
    let logString = JSON.stringify(logData);

    //What to call the log file?
    let logFileName = check.id;

    //Append
    try {
        _logs.append(logFileName, logString);
    } catch (error) {
        debug(error);
    }
};

//Timer to execute the worker process once per minute
workers.loop = () => {
    setInterval( () => {
        workers.gatherAllChecks();
    }, 1000 * 60);
};

//Compress the log files
workers.rotateLogs = async () => {
    //List all the non compressed log files in the .logs folder
    try {
        let logs = await _logs.list(false);//Boolean indicates if compressed files should be listed as well
        logs.forEach(async (logName) => {
            //Compress the data to a different file
            let logId = logName.replace('.log', '');
            let newFileId = logId+'-'+Date.now();
            await _logs.compress(logId, newFileId);
            await  _logs.truncate(logId);
            debug('Successfully truncated log file');
        });
    } catch (error){
        debug(error);
    }


};

//Timer to executre log rotation once per day
workers.logRotationLoop = () => {
    setInterval( () => {
        workers.rotateLogs();
    }, 1000 * 60 * 60 * 24);
};


//Initialization function to be started from index.js
workers.init = () => {

    //YELLOW! :D
    console.log('\x1b[33m%s\x1b[0m','Background workers starting...');

    // Execute all the checks upon start
    workers.gatherAllChecks();

    //Loop the checks
    workers.loop();

    //Compress all the logs immediately
    workers.rotateLogs();

    // Call the compression loop so logs will be compressed later on
    workers.logRotationLoop();
};

module.exports = workers;