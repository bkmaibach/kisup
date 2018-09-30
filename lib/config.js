/*
* Create and export configuration variables
*
*/

// Container for all of the environments
let environments = {};

// Default to staging environment
environments.staging = {
    'httpPort' : 3000,
    'httpsPort' : 3001,
    'envName' : 'staging',
    'hashingSecret' : process.env.HASHING_SECRET,
    'maxChecks' : 5,
    'twilio' : {
        'accountSid' : process.env.TWILIO_ACCOUNT_SID,
        'authToken' : process.env.TWILIO_AUTH_TOKEN,
        'fromPhone' : process.env.TWILIO_FROM_PHONE
    }
};

// Production object
environments.production = {
    'httpPort' : 80,
    'httpsPort' : 443,
    'envName' : 'production',
    'hashingSecret' : process.env.HASHING_SECRET,
    'maxChecks' : 5,
    'twilio' : {
        'accountSid' : process.env.TWILIO_ACCOUNT_SID,
        'authToken' : process.env.TWILIO_AUTH_TOKEN,
        'fromPhone' : process.env.TWILIO_FROM_PHONE
    }
};

// Determine which environemt was passed as a command-line arg
var selectedEnv = typeof(process.env.NODE_ENV) == 'string' ? process.env.NODE_ENV.toLowerCase() : 'staging';

// Check that the currentEnv is valid
var envToExport = typeof(environments[selectedEnv]) == 'object' ? environments[selectedEnv] : environments.staging;

module.exports = envToExport;