/*
* Frontend logic for web app
*
*/
let app = {};

//config
app.config = {
    'sessionToken' : false
};

//config
app.client = {};

//Interface for making API calls
app.client.request = function(headers, path, method, queryStringObject, payload, callback) {
    //Set tedious defaults

    headers = typeof(headers) == 'object' && headers != null ? headers : {};
    path = typeof(path) == 'string' ? path : '/';
    method = typeof(method) == 'string' && ['POST', 'GET', 'PUT', 'DELETE'].indexOf(method.toUpperCase()) > -1 ? method.toUpperCase() : 'GET';
    queryStringObject = typeof(queryStringObject) == 'object' && queryStringObject != null ? queryStringObject : {};
    payload = typeof(payload) == 'object' && payload != null ? payload : {};
    callback = typeof(callback) == 'function' ? callback : false;

    //For each query string parameter sent, add it to the path
    let requestUrl = path;
    var counter = 0;
    //This loop builds the query string from the object by looping through the keys, and knowing when to add a '&' via the counter
    for(let key in queryStringObject){
        if(queryStringObject.hasOwnProperty(key)){
            // If at least one query string param has already been added, prepend the next with an ampersand;
            if(counter == 0){
                requestUrl+='?';
            }
            else if(counter >= 1){
                requestUrl+='&';
            }
            //Add the actual quet string value
            requestUrl += key + '=' + queryStringObject[key];
            counter++;
        }
    }

    let xhr = new XMLHttpRequest();
    xhr.open(method, requestUrl, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    // For each header sent, add it to the request
    for(let key in headers){
        if(headers.hasOwnProperty(key)){
            xhr.setRequestHeader(key, headers[key]);
        }
    }

    //If there is a current session token, this needs to be added to the header separately:
    if(app.config.sessionToken){
        xhr.setRequestHeader('token', app.config.sessionToken.id);
    }

    //When the request comes back, handle dat response:
    xhr.onreadystatechange = function () {
        if(xhr.readyState == XMLHttpRequest.DONE){
            let statusCode = xhr.status;
            let responseReturned = xhr.responseText

            //Callback if necessary
            if(callback){
                try{
                    let parsedResponse = JSON.parse(responseReturned);
                    callback(statusCode, parsedResponse);
                } catch (error){
                    callback(statusCode, false);
                }
            }
        }
    }
    //Send the payload as JSON
    let payloadString = JSON.stringify(payload);
    xhr.send(payloadString);
};


