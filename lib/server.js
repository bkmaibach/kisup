/*
*Server related tasks
*
*/

//Dependencies
const http = require('http');
const https = require('https');
const url = require('url');
const {StringDecoder} = require('string_decoder');
const config = require('./config');
const fs = require('fs');
const handlers = require('./handlers');
const helpers = require('./helpers');
const path = require('path');
const util = require('util');

const debug = util.debuglog('server');

//Instantiate the server module object
var server = {};

//Instantiate the HTTP server
server.httpServer = http.createServer((req, res) => {
    server.unifiedServer(req, res)
});

// Prepare to instantiate the HTTPS server
// Extra step for HTTPS instantiation (see ./scripts/genssl.sh)
let httpsServerOptions = {
    'key' : fs.readFileSync(path.join(__dirname, '/../https/key.pem')),
    'cert' : fs.readFileSync(path.join(__dirname, '/../https/cert.pem'))
};

// Instantiate the HTTPS server
server.httpsServer = https.createServer(httpsServerOptions, (req, res) => {
    server.unifiedServer(req, res)
});

// All server functionality independent of http or https specifically
server.unifiedServer = function(req, res){
    //Get the URL and parse it
    //The second path is true to enable parsing query string data
    let parsedUrl = url.parse(req.url, true);    

    //Get the path from the URL
    let path = parsedUrl.pathname;
    let trimmedPath = path.replace(/^\/+|\/+$/g, '');

    //Avoid undefined path
    trimmedPath = typeof(trimmedPath) == 'undefined' ? '' : trimmedPath;

    //Get the HTTP method
    let method = req.method.toLowerCase();

    //Get the query string as an object
    let queryStringObject = parsedUrl.query;

    let headers = req.headers;

    //Payloads only come in as an event called data
    //This event provides a data parameter that can be used by a StringDecoder object
    let decoder = new StringDecoder('utf-8');
    let buffer = '';
    req.on('data', (data) => {
        buffer += decoder.write(data);
    });

    //Another event fires when the request and all the data is done, regardless of whether there was a payload
    req.on('end', () => {
        //Tie off the buffer and we have our payload
        buffer += decoder.end();
        let payload = helpers.parseStringToObject(buffer);

        //Avoid undefined path
        trimmedPath = typeof(trimmedPath) == 'undefined' ? '' : trimmedPath;
        
        //Select the handler form the router
        let chosenHandler = typeof(server.router[trimmedPath]) == 'undefined' ? server.router.notFound : server.router[trimmedPath]; 
        let data = {
            trimmedPath,
            queryStringObject,
            method,
            headers,
            payload 
        };
        chosenHandler(data, (statusCode, payload, contentType) => {
            debug('REQUEST HANDLED - Handler prepared payload:');
            debug(JSON.stringify(payload));

            //Default content type to json and statusCode to 200
            contentType = typeof(contentType) == 'string' ? contentType : 'json';
            statusCode = typeof(statusCode) == 'number' ? statusCode : 200;

            //Return the response - parts that are content-specific
            let payloadString = '';
            if(contentType == 'json'){
                res.setHeader('Content-Type', 'application/json');

                //Use the replied payload, or default to empty object
                payload = typeof(payload) == 'object' ? payload : {};

                //Convert the payload to a string
                let payloadString = JSON.stringify(payload);

            } else if (contentType == 'html'){
                res.setHeader('Content-Type', 'text/html');
                payloadString = typeof(payload) == 'string' ? payload : '';
            }

            //Return the response - parts that are common to all content-types
            res.writeHead(statusCode);
            res.end(payloadString);


            //Log what path the client was asking for so we can see requests
            debug(`Request is received on path: ${trimmedPath} with method ${method}`, queryStringObject);
            debug('Received headers: ', headers);
            debug('Request contained payload: ', buffer);

            if(statusCode >= 200 && statusCode < 300){
                debug('\x1b[32m%s\x1b[0m', method.toUpperCase() + ' /' + trimmedPath + ' ' + statusCode);
            } else {
                debug('\x1b[31m%s\x1b[0m', method.toUpperCase() + ' /' + trimmedPath + ' ' + statusCode);
            }
        });
    });
}

server.router = {
    'favicon.ico' : handlers.notFound,
    '': handlers.index,
    'account/create': handlers.accountCreate,
    'account/edit': handlers.accountEdit,
    'account/deleted': handlers.accountDeleted,
    'session/create': handlers.SessionCreate,
    'session/deleted': handlers.sessionDeleted,
    'checks/all': handlers.checkList,
    'check/create': handlers.checksCreate,
    'checks/edit': handlers.checksEdit,
    'ping': handlers.ping,
    'notFound': handlers.notFound,
    'api/users' : handlers.users,
    'api/tokens' : handlers.tokens,
    'api/checks' : handlers.checks
};

//Init server
server.init = () => {

    //Start the HTTP server
    server.httpServer.listen(config.httpPort, () => {
        console.log('\x1b[36m%s\x1b[0m', `HTTP server now listening on port ${config.httpPort} in environment ${config.envName}!`);
    });

    // Start the HTTPS server
    server.httpsServer.listen(config.httpsPort, () => {
        console.log('\x1b[35m%s\x1b[0m', `HTTPS server now listening on port ${config.httpsPort} in environment ${config.envName}!`)
    });


    
};

module.exports = server;