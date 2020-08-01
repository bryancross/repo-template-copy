/**
 * Created by bryancross on 6/22/18.
 */

const fs = require('fs');
const querystring = require('querystring');
const http = require('http'); //Shouldn't be using this ever, really
const https = require('https');
const crypto = require('crypto');
const GitHubClient = require('github'); // https://github.com/mikedeboer/node-github
const httpOptions = {};
const HashMap = require('hashmap');
const config = JSON.parse(fs.readFileSync('./create-PRs.json'));
const URL = require('url');
if(!config.hasOwnProperty("timeout"))
{
    config.timeout = 60;
}
var PAT = '';
var regex = /^([a-z|0-9]){40}$/;
var mode;
var startTime = new Date();


if(process.argv.length != 4)
{
    console.log("USAGE: node create-PRs.js <PAT> <create|status|merge>");
    process.exit(1);
}
if(!regex.test(process.argv[2]))
{
    console.log("Missing or invalid PAT argument");
    process.exit(1);
}
if(!['create','status','merge'].includes(process.argv[3]))
{

    console.log("USAGE: node create-PRs.js <PAT> <create|status|merge>");
    console.log("INVALID MODE");
    process.exit(1);
}
else
{
    mode = process.argv[3];
}

PAT = process.argv[2];
init();
if(mode == 'create') {
    generatePRs();
}
else if (mode == 'status')
{
    getJobStatus();
}
else if (mode = 'merge')
{
    merge();
}


//process.exit(0);

function init()
{
    var req;

    httpOptions.hostname = config.rtHost;
    httpOptions.port = config.rtPort;
    httpOptions.headers = {'Content-Type': 'application/json','Auth':PAT};
    console.log("Options: " + JSON.stringify(httpOptions));
    httpOptions.path = '/init';
    httpOptions.method = 'GET'

    req = http.request(httpOptions, function(res)
    {
        res.setEncoding('utf8');
        res.on('data',function (body){
            console.log('Body: ' + body);
        });
    });

    req.on('error',function(err)
    {
        console.log("Error with request: " + err.message);
    });

    req.end();

};

function generatePRs() {
    var req;
    var reqBody = {};
    var prefix = config.hasOwnProperty('repoNamePrefix') ? config.repoNamePrefix : '';
    var jobID = '';
    var jobIDs = [];

    httpOptions.method = 'POST';
    httpOptions.path = '/createRepo';
    var numResponses = 0;

    for (var i = 0; i < config.numRepos; i++)
    {
        reqBody.newRepoOwner = config.repoOwner;
        reqBody.newRepoName = prefix + crypto.randomBytes(5).toString('hex');
        reqBody.newRepoTemplate = config.repoConfig;
        reqBody.newRepoRequester = config.repoRequestor;

        console.log("Repo " + i + ": " + JSON.stringify(reqBody));

         req = new http.request(httpOptions, function(res)
         {
            console.log('Status: ' + res.statusCode);
            console.log('Headers: ' + JSON.stringify(res.headers));
            res.setEncoding('utf8');
            res.on('data',function (data)
            {
                jobID = JSON.parse(data).message.jobID;
                res.jobID = jobID;
                //jobIDs.set(jobID,{"status":"pending"});
                jobIDs.push({"key":jobID,"value":"pending"});
            });
            res.on('error',function(body){
                console.log("ERROR: " + body.message);
            });
             res.on('end', function() {
                 numResponses++;
                 if (numResponses == config.numRepos || (((new Date() - startTime)/1000) > config.timeout))
                 {
                     console.log(numResponses + '/' + config.numRepos + " processed in " + (new Date() - startTime)/1000 + " seconds.");
                     fs.writeFileSync("jobIDs.json",JSON.stringify(jobIDs));
                     process.exit(0);
                 }
             });
         });
         req.on('error',function(err)
         {
             console.log("REQ Error: " + err.message);
         });

         try{
             req.write(JSON.stringify(reqBody));
             req.end();
         }
         catch(err)
         {
             console.log(err.message);
         }

    };
};

function getJobStatus()
{
        var responseData = {};
        var jobIDs = JSON.parse(fs.readFileSync("jobIDs.json"));
        var prData = [];
        var jobID = '';
        var numJobs = jobIDs.length;


        //jobIDs.forEach(function (value, key){
        for (var i = 0; i < numJobs; i++)
        {
            jobID = jobIDs[i].key;
            console.log("Asking for jobID: " + jobID);
            httpOptions.method = 'GET';
            httpOptions.path = '/status?' + querystring.stringify({
                    jobID: jobID,
                    format: "json"
                });
            req = new http.request(httpOptions, function (res) {
                res.setEncoding('utf8');
                res.on('data', function (data) {
                    responseData = JSON.parse(data);
                    prData.push(responseData.APIUrl);
                    //Would be better to identify the particular array element and remove it, but whatever.
                    //jobIDs.delete(responseData.ID);
                    console.log("PR Data received for " + prData.length +"/" + numJobs + " requests.");
                });
                res.on('error', function (body) {
                    console.log("ERROR: " + body.message);
                });
                res.on('end', function () {
                    if(prData.length == numJobs || ((new Date() - startTime)/1000) > config.timeout)
                    {
                        //console.log("PRData: " + JSON.stringify(prData));
                        console.log("Received " + prData.length + " statuses in " + (new Date() - startTime)/1000 + " seconds");
                        var shlString = "";
                        shlString = prData[0] + '\n';
                        for(var y = 1; y < prData.length - 1; y++)
                        {
                            shlString = shlString + prData[y] + '\n';
                        }
                        shlString = shlString + prData[prData.length - 1];
                        //fs.writeFileSync("PRData.json", JSON.stringify(prData))
                        fs.writeFileSync("PRData.txt", shlString)
                        process.exit(0);
                    }
                })
            });
            req.on('error', function (err) {
                console.log("REQ Error: " + err.message);
            });

            try {
                //req.write();
                req.end();
            }
            catch (err) {
                console.log(err.message);
            }
        }
};