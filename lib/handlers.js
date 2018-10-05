/*
*Request handlers
*
*/

//Dependencies
const _data = require('./data');
const helpers = require('./helpers');
const config = require('./config');
const util = require('util');

const debug = util.debuglog('server/handlers');

let handlers = {};

/*
* HTML APP HANDLERS
*
*/
handlers.index = async (data, callback) => {
    //Accept only GET
    if(data.method == 'get'){
        console.log('entered get /');
        //Prepare the data for interpolation - head.title, head.description, body.class, body.description
        let templateData = {
            'head-title' : 'Welcome to Kisup!',
            'head-description' : 'An online service for checking on your favorite websites!',
            'body-title': 'Hello templated world',
            'body-class' : 'index'
        };
        //Read in the index template as a string
        try{
            let template = await helpers.getTemplate('index', templateData);
            //The interpolation funciton adds the globals automatically
            let pageData = await helpers.addUniversalTemplates(template, templateData);
            callback(200, pageData, 'html');
        } catch (error) {
            //@TODO - Add an error page?
            callback(500, undefined, 'html');
        }
    } else {
        callback(405, undefined, 'html');
    }
};

handlers.accountCreate = async (data, callback) => {
    //Accept only GET
    if(data.method == 'get'){
        console.log('entered get /accountCreate');
        //Prepare the data for interpolation - head.title, head.description, body.class, body.description
        let templateData = {
            'head-title' : 'Create an account',
            'head-description' : 'Sign up is simple! All you need is an SMS numbner and a few seconds.',
            'body-class' : 'accountCreate'
        };
        //Read in the index template as a string
        try{
            let template = await helpers.getTemplate('accountCreate', templateData);
            //The interpolation funciton adds the globals automatically
            let pageData = await helpers.addUniversalTemplates(template, templateData);
            callback(200, pageData, 'html');
        } catch (error) {
            //@TODO - Add an error page?
            callback(500, undefined, 'html');
        }
    } else {
        callback(405, undefined, 'html');
    }
};

handlers.accountCreate = async (data, callback) => {
    //Accept only GET
    if(data.method == 'get'){
        console.log('entered get /accountCreate');
        //Prepare the data for interpolation - head.title, head.description, body.class, body.description
        let templateData = {
            'head-title' : 'Login to your account',
            'head-description' : 'Please enter your phone and password',
            'body-class' : 'sessionCreate'
        };
        //Read in the index template as a string
        try{
            let template = await helpers.getTemplate('sessionCreate', templateData);
            //The interpolation funciton adds the globals automatically
            let pageData = await helpers.addUniversalTemplates(template, templateData);
            callback(200, pageData, 'html');
        } catch (error) {
            //@TODO - Add an error page?
            callback(500, undefined, 'html');
        }
    } else {
        callback(405, undefined, 'html');
    }
};

/*
* JSON API HANDLERS
*
*/
handlers.users = (data, callback) => {
    let acceptedMethods = ['post', 'get', 'put', 'delete'];
    if(acceptedMethods.indexOf(data.method) > -1){
        handlers._users[data.method](data,callback);
    } else {
        callback(405, {'error': 'Unsupported method'});
    }
};

handlers.tokens = (data, callback) => {
    let acceptedMethods = ['post', 'get', 'put', 'delete'];
    if(acceptedMethods.indexOf(data.method) > -1){
        handlers._tokens[data.method](data,callback);
    } else {
        callback(405, {'error': 'Unsupported method'});
    }
};

handlers.checks = (data, callback) => {
    let acceptedMethods = ['post', 'get', 'put', 'delete'];
    if(acceptedMethods.indexOf(data.method) > -1){
        handlers._checks[data.method](data,callback);
    } else {
        callback(405, {'error': 'Unsupported method'});
    }
};

//Container for all the tokens methods
handlers._tokens = {};

//Required data - phone and password
//Optional data - none
handlers._tokens.post = async (data,callback) => {
    console.log('entered post /tokens');
    let phone = typeof(data.payload.phone) == 'string' 
        && data.payload.phone.trim().length == 10 
        ? data.payload.phone.trim() : false;

    let password = typeof(data.payload.password) == 'string' ? data.payload.password.trim() : false;

    if (phone && password){
        try{
            //Lookup the user that matches that phone number
            let gotUser = await _data.read('users', phone);
            sentPwHash = helpers.hash(data.payload.password);
            if (gotUser.pwHash == sentPwHash){
                //the password is correct
                let id = helpers.randomString(20);
                let  expires = Date.now() + 1000 * 60 * 60;
                let tokenObj = {
                    phone,
                    expires,
                    id
                };
                //Store the token
                try{
                    await _data.create('tokens', id, tokenObj);
                    callback(200, tokenObj)
                } catch (error){
                    console.log(error);
                    callback(500, {'error':'could not record token'})
                }   
            } else {
                //The password is inccorect
                callback(400, {'error': 'The password did not match the user\'s stored password'});
            }
        } catch(error) {
            if (error.code == 'ENOENT'){
                callback(400, {'error': 'The specified user does not exist'});
            } else{
                callback(500, {'error': 'There was a problem getting the user'});
            }
        }
    } else {
        callback(400, {'error': 'Missing required fields'});
    }
};

//Required data - id
//Optional data - none
handlers._tokens.get = async (data,callback) => {
    console.log('entered get /tokens');
    let id = typeof(data.queryStringObject.id) == 'string' 
        && data.queryStringObject.id.trim().length == 20 
        ? data.queryStringObject.id.trim() : false;

    if(id){
        try{
            let gotToken = await _data.read('tokens', id);
            callback(200, gotToken);
        }
        catch(error) {
            if (error.code == 'ENOENT'){
                callback(400, {'error': 'The queried token could not be found'});
            } else{
                callback(500, {'error': 'There was a problem getting the token'});
            }
        };

    } else {
        callback(400, {'error': 'Missing required field'});
    }
};

//Required data: id, extend
//Optional data: none
handlers._tokens.put = async (data,callback) => {
    console.log('entered put /tokens');
    let id = typeof(data.payload.id) == 'string' 
        && data.payload.id.trim().length == 20 
        ? data.payload.id.trim() : false;

    let extend = typeof(data.payload.extend) == 'boolean' 
        && data.payload.extend === true 
        ? data.payload.extend : false;
    if(id && extend){
        try{
            let gotToken = await _data.read('tokens', id);
            
            if(gotToken.expires > Date.now()){
                gotToken.expires = Date.now() + 1000 * 60 * 60;
                try{
                    await _data.update('tokens', id, gotToken);
                    callback(200, {'message':'Successfully updated token'});
                } catch (error) {
                    callback(500, {'error': 'Could not update token'});
                }
            }
            else {
                callback(400, {'error': 'The token is expired'});
            }
        } catch(error) {
            callback(400, {'error': 'Could not locate token'});
        };
    } else {
        callback(400, {'error': 'Missing required field'});
    }
};

//Required data: id
handlers._tokens.delete = async (data,callback) => {
    //Deleting a token is equivelant to logging out
    // Check that the phone number is valid
    console.log('entered delete /tokens');
    let id = typeof(data.queryStringObject.id) == 'string' 
        && data.queryStringObject.id.trim().length == 20 
        ? data.queryStringObject.id.trim() : false;

    if(id){
        try{
            await _data.delete('tokens', id);
            callback(200, {'message' : 'Successfully deleted token'});
        }

        catch(error) {
            if (error.code == 'ENOENT'){
                callback(400, {'error': 'The queried token id could not be found'});
            } else{
                callback(500, {'error': 'There was a problem getting the token'});
            }
        };

    } else {
        callback(400, {'error': 'Missing required field'});
    }
};

//Container for the users submethods
handlers._users = {};

//Required data: firstName, lastName, phone, password, tosAgreement
//Optional data: none
handlers._users.post = async (data,callback) => {
    console.log('entered post /users');
    //Check that all required fields are present
    let firstName = typeof(data.payload.firstName) == 'string' 
        && data.payload.firstName.trim().length > 0 
        ? data.payload.firstName.trim() : false;

    let lastName = typeof(data.payload.lastName) == 'string' 
        && data.payload.lastName.trim().length > 0 
        ? data.payload.lastName.trim() : false;

    let phone = typeof(data.payload.phone) == 'string' 
        && data.payload.phone.trim().length == 10 
        ? data.payload.phone.trim() : false;

    let password = typeof(data.payload.password) == 'string' 
        && data.payload.password.trim().length >= 8 
        ? data.payload.password.trim() : false;

    let tosAgreement = data.payload.tosAgreement === true ? true : false;

    if(firstName && lastName && phone && password && tosAgreement){
        try {
            //Ensure uniqueness of user phone number
            let data = await _data.read('users', phone);
            callback(400, {'error' : `User with phone number ${data.phone} already exists`} );
        }

        catch (error) {
            
            if (error.code == 'ENOENT'){
                //This catch block is entered if no user exists. The new user may be created.
                let pwHash = helpers.hash(password);

                if(pwHash){
                    //create the user object
                    let userObj = {
                        firstName,
                        lastName,
                        phone,
                        pwHash,
                        tosAgreement
                    };

                    //Store the user
                    try{
                        await _data.create('users', phone, userObj);
                        callback(200, {'Message' : `A new user has been created under the phone number ${phone}`});
                    } catch (err){
                        console.log(err);
                        callback(500, {'error' : 'Could not create a new user'});
                    }
                }
            }
            else{
                callback(500, {'error' : 'There was a problem reading user data'} );
            }  
        };
    } else {
        callback(400, {'error' : 'Missing required field'});
    }
};
//Users - get
//Required data: phone
//Optional data: none
handlers._users.get = async (data,callback) => {
    console.log('entered get /users');
    let phone = typeof(data.queryStringObject.phone) == 'string' 
        && data.queryStringObject.phone.trim().length == 10 
        ? data.queryStringObject.phone.trim() : false;

    if(phone){
        //All methods requiring authentication must first obtain the token from the headers
        let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
        if(await handlers._tokens.verifyToken(token, phone)){
            try{
                let gotUser = await _data.read('users', phone);
                console.log(gotUser);
                delete gotUser.pwHash;
    
                callback(200, gotUser);
            } catch(error) {
                if (error.code == 'ENOENT'){
                    callback(400, {'error': 'The queried phone number could not be found'});
                } else{
                    callback(500, {'error': 'There was a problem getting the user'});
                }
            }
        } else {
            callback(403, {'error': 'The request was not authenticated'});
        }
    } else {
        callback(400, {'error': 'Missing required field'});
    }
};

//Users - put
//Required data: phone
//Optional data: firstName, lastName, password (at least one must be specified)
handlers._users.put = async (data,callback) => {
    console.log('entered put /users');
    //Check for the required field
    let phone = typeof(data.payload.phone) == 'string' 
        && data.payload.phone.trim().length == 10 
        ? data.payload.phone.trim() : false;

    //Check for the optional fields
    let firstName = typeof(data.payload.firstName) == 'string' 
        && data.payload.firstName.trim().length > 0 
        ? data.payload.firstName.trim() : false;

    let lastName = typeof(data.payload.lastName) == 'string' 
        && data.payload.lastName.trim().length > 0 
        ? data.payload.lastName.trim() : false;

    let password = typeof(data.payload.password) == 'string' 
        && data.payload.password.trim().length == 8 
        ? data.payload.password.trim() : false;

    //The request must have the phone and one of the required fields
    if(phone & (firstName || lastName || password)){

        let token = typeof(data.headers.token) == 'string' 
        && data.headers.token.trim().length === 20 
        ? data.headers.token : false;

        if(await handlers._tokens.verifyToken(token, phone)){
            try {
                let gotUser = await _data.read('users', phone);
                gotUser.firstName = firstName ? firstName : gotUser.firstName;
                gotUser.lastName = lastName ? lastName : gotUser.lastName;
                gotUser.pwHash = password ? helpers.hash(password) : gotUser.pwHash;

                //Write (update) the values
                try {
                    _data.update('users', phone, gotUser);
                    callback(200, {'message' : 'User updated successfully'});
                }
                catch (error){
                    callback(500, {'error': 'There was an unknown error updating the user'});
                }
            } catch (error){
                if (error.code == 'ENOENT'){
                    callback(400, {'error': 'The queried phone number could not be found'});
                } else{
                    callback(500, {'error': 'There was an unknown error getting the user'});
                }
            }
        } else {
            callback(403, {'error': 'The request was not authenticated'});
        }
    } else {
        callback(400, {'error': 'Requires phone and at least one optional field'});
    }
};

// Requried field: Phone
handlers._users.delete = async (data,callback) => {
    // Check that the phone number is valid
    console.log('entered delete /users');
    let phone = typeof(data.queryStringObject.phone) == 'string'
        && data.queryStringObject.phone.trim().length == 10 
        ? data.queryStringObject.phone.trim() : false;

    if(phone){
        let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
        if(await handlers._tokens.verifyToken(token, phone)){
            try{
                //Read the user and delete each check associated with it
                let gotUser = await _data.read('users', phone);
                if(gotUser.checks){
                    gotUser.checks.forEach((check) => {
                        try{
                            _data.delete('checks', check);
                        } catch (error){
                            callback(500, {'error': 'Could not delete associated user data'});
                            throw 'Internal error deleting associated user data'
                        }
                    });
                }
                await _data.delete('users', phone);
                
                callback(200, {'message' : 'Successfully deleted user'});
            }
            catch(error) {
                if (error.code == 'ENOENT'){
                    callback(400, {'error': 'The queried phone number could not be found'});
                } else{
                    callback(500, {'error': 'There was a problem deleting the user'});
                }
            };
        } else {
            callback(403, {'error': 'The request was not authenticated'});
        }
    } else {
        callback(400, {'error': 'Missing required field'});
    }
};

// Verify if a given token id is valid for a given user
handlers._tokens.verifyToken = async (id, phone) => {
    //Lookup the token
    try{
        let gotToken = await _data.read('tokens', id);
        if(gotToken.phone == phone && gotToken.expires > Date.now()){
            return true;
        } else {
            return false;
        }
    }
    catch (error){
        //console.log(error);
        return false;
    }
}

handlers._checks = {};

//Required: protocol, url, method, successCodes,
handlers._checks.post = async (data, callback) => {
    let protocol = typeof(data.payload.protocol) == 'string' 
        && ['http', 'https'].indexOf(data.payload.protocol.trim()) > -1 
        ? data.payload.protocol.trim() : false;
        //console.log(protocol);
    
    let url = typeof(data.payload.url) == 'string' 
        && data.payload.url.trim().length > 0 
        ? data.payload.url.trim() : false;
        //console.log(url);
    
    let method = typeof(data.payload.method) == 'string' 
        && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1
        ? data.payload.method : false;
        //console.log(method);
    
    let successCodes = typeof(data.payload.successCodes) == 'object'
        && data.payload.successCodes instanceof Array 
        && data.payload.successCodes.length > 0 
        ? data.payload.successCodes : false;
        //console.log(successCodes);
    
    let timeoutSeconds = typeof(data.payload.timeoutSeconds) == 'number' 
        && data.payload.timeoutSeconds % 1 == 0 
        && data.payload.timeoutSeconds > 0 
        && data.payload.timeoutSeconds < 5
        ? data.payload.timeoutSeconds : false;
        //console.log(timeoutSeconds);

    if (protocol && url && method && successCodes && timeoutSeconds){
        //Get the token from the headers and ensure authorization
        let token = typeof(data.headers.token) == 'string' 
            && data.headers.token.trim().length === 20 
            ? data.headers.token : false;

        if (await handlers._tokens.verifyToken){
            try{
                let gotToken = await _data.read('tokens', token);
                let gotUser = await _data.read('users', gotToken.phone);
                let userChecks = typeof(gotUser.checks) == 'object' 
                    && gotUser.checks instanceof Array 
                    ? gotUser.checks : [];

                    //Verify that the user has less than the number of max checks
                    if(userChecks.length < config.maxChecks){
                        let checkId = helpers.randomString(20);
                        //Create the check object and reference the users phone

                        let checkObject = {
                            'id': checkId,
                            'userPhone': gotToken.phone,
                            protocol,
                            url,
                            method,
                            successCodes,
                            timeoutSeconds
                        };
                        //Persist the check object and the check id
                        try{
                            await _data.create('checks', checkId, checkObject);
                            userChecks.push(checkId);
                            gotUser.checks = userChecks;
                            await _data.update('users', gotUser.phone, gotUser);
                            callback(200, {'message': 'The check was created successfully', 'id':checkId});
                        } catch (error){
                            console.log(error);
                            callback(500, {'error': 'The check could not be saved'});
                        }
                        
                    } else {
                        callback(400, {'error' : `The user already has the maximum number of checks ${config.maxChecks}`});
                    }

            } catch (error){
                //console.log(error);
                callback(403, {'error':'The request was not authenticated'});
            }
        }
    } else {
        callback(400, {'error' : 'Missing required inputs or inputs are invalid'});
    }
};

//Required data - id (of check)
//Optional data - none
handlers._checks.get = async (data, callback) => {
    console.log('entered get /checks');
    let id = typeof(data.queryStringObject.id) == 'string' 
        && data.queryStringObject.id.trim().length == 20 
        ? data.queryStringObject.id.trim() : false;

    if(id){
        try{
            let gotCheck = await _data.read('checks', id);
            let phone = gotCheck.userPhone;
            let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
            if(await handlers._tokens.verifyToken(token, phone)){
                callback(200, gotCheck);
            } else {
                callback(403, {'error': 'The request was not authenticated'});
            }
        } catch (error){
            console.log(error);
            callback(500, {'error' : 'Could not retrieve check data'});
        }
    } else {
        callback(400, {'error': 'Missing required field'});
    }
};

//Required data - id (of check)
//Optional data - protocol, url, method, successCodes, timeoutSeconds
handlers._checks.put = async (data, callback) => {
    console.log('entered put /checks');

    let id = typeof(data.payload.id) == 'string' 
        && data.payload.id.trim().length == 20 
        ? data.payload.id.trim() : false;
        //console.log(id);

    let protocol = typeof(data.payload.protocol) == 'string' 
        && ['http', 'https'].indexOf(data.payload.protocol.trim()) > -1 
        ? data.payload.protocol.trim() : false;
        //console.log(protocol);

    let url = typeof(data.payload.url) == 'string' 
        && data.payload.url.trim().length > 0 
        ? data.payload.url.trim() : false;
        //console.log(url);

    let method = typeof(data.payload.method) == 'string' 
        && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1
        ? data.payload.method : false;
        //console.log(method);

    let successCodes = typeof(data.payload.successCodes) == 'object'
        && data.payload.successCodes instanceof Array 
        && data.payload.successCodes.length > 0 
        ? data.payload.successCodes : false;
        //console.log(successCodes);

    let timeoutSeconds = typeof(data.payload.timeoutSeconds) == 'number' 
        && data.payload.timeoutSeconds % 1 == 0 
        && data.payload.timeoutSeconds > 0 
        && data.payload.timeoutSeconds < 5
        ? data.payload.timeoutSeconds : false;
        //console.log(timeoutSeconds);

    if (id && (protocol || url || method || successCodes || timeoutSeconds)){
        try{
            gotCheck = await _data.read('checks', id);
            let phone = gotCheck.userPhone;
            let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
            if(await handlers._tokens.verifyToken(token, phone)){
                gotCheck.protocol = protocol ? protocol : gotCheck.protocol;
                gotCheck.url = url ? url : gotCheck.url;
                gotCheck.method = method ? method : gotCheck.method;
                gotCheck.successCodes = successCodes ? successCodes : gotCheck.successCodes;
                gotCheck.timeoutSeconds = timeoutSeconds ? timeoutSeconds : gotCheck.timeoutSeconds;
                try{
                    await _data.update('checks', gotCheck.id, gotCheck);
                    callback(200, {'message':'Check data updated successfully'});
                } catch (error){
                    console.log(error);
                    callback(500, {'error':'There was a problem updating the check data'});
                }
            } else {
                callback(403, {'error': 'The request was not authenticated'});
            }
        } catch (error){
            if (error.code == 'ENOENT'){
                callback(400, {'error': 'The queried check id could not be found'});
            } else{
                callback(500, {'error': 'There was a problem reading the check data'});
            }
        }
    } else {
        callback(400, {'error' : 'Missing id or at least one of protocol, url, successCodes, or timeoutSeconds'});
    }
};

//Required data - id
//Optional data - none
handlers._checks.delete = async (data, callback) => {
    console.log('entered delete /checks');

    let id = typeof(data.queryStringObject.id) == 'string' 
        && data.queryStringObject.id.trim().length == 20 
        ? data.queryStringObject.id.trim() : false;
        //console.log(id);

    if(id){
        try{
            gotCheck = await _data.read('checks', id);
            let phone = gotCheck.userPhone;
            let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
            if(await handlers._tokens.verifyToken(token, phone)){
                try{
                    let gotUser = await _data.read('users', gotCheck.userPhone);
                    let userChecks = gotUser.checks;
                    let checkIndex = userChecks.indexOf(id);
                    if (checkIndex > -1){
                        //This is the function for removing one or more items from any location in an array
                        userChecks.splice(checkIndex, 1);
                        gotUser.checks = userChecks;
                        await _data.update('users', gotUser.phone, gotUser);
                        await _data.delete('checks', id);
                        callback(200, {'message' : 'Successfully deleted check'});
                    }else {
                        throw 'The check data could not be found within the user data';
                    }
                }
                catch(error) {
                    console.log(error);
                    callback(500, {'error': 'There was a problem deleting the check'});
                };
            } else {
                callback(403, {'error': 'The request was not authenticated'});
            }
        } catch (error){
            if (error.code == 'ENOENT'){
                callback(400, {'error': 'The queried check id could not be found'});
            } else{
                callback(500, {'error': 'There was a problem reading the check'});
            }
        }

    } else {
        callback(400, {'error': 'Missing required field'});
    }
};

/*
* MISC HANDLERS
*
*/
handlers.ping = async (data, callback) => {
    console.log('ping handler activated');
    callback(200, {"message": "Ping!"});
};

handlers.notFound = async (data, callback) => {
    console.log('notFound handler activated');
    callback(404);
};

/*
* STATIC ASSET HANDLERS
*
*/

handlers.favicon = async (data, callback) => {
    if(data.method == 'get'){
        // Read in the favicon data
        try{
            let faviconData = await helpers.getStaticAsset('favicon.ico');
            callback(200, faviconData, 'favicon');
        } catch (error){
            callback(500);
        }
    } else {
        callback(405);
    }
};

handlers.public = async (data, callback) => {
    if(data.method == 'get'){
        // Read in the favicon data
        let trimmedAssetName = data.trimmedPath.replace('public/', '').trim();

        if(trimmedAssetName.length > 0){
            try{
                let staticAsset = await helpers.getStaticAsset(trimmedAssetName);
                // Determine the content type, default to plain text
                let contentType = 'plain';
                contentType = trimmedAssetName.endsWith('.css') ? 'css' : contentType;
                contentType = trimmedAssetName.endsWith('.png') ? 'png' : contentType;
                contentType = trimmedAssetName.endsWith('.jpg') ? 'jpg' : contentType;
                contentType = trimmedAssetName.endsWith('.ico') ? 'favicon' : contentType;
    
                callback(200, staticAsset, contentType);
            } catch (error){
                if(error.code == 'ENOENT'){
                    callback(404);
                } else {
                    callback(500);
                } 
            }
        } else {
            callback(404);
        }

    } else {
        callback(405);
    }
};



 module.exports = handlers;