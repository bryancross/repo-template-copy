const inquirer = require("inquirer");
const RT = require('./repo-template.js');
var rt;
fs = require('fs');
const config = require('./config/config.json');
var http = require('http');
var github = require('github');

var httpOptions = {
    host:"localhost"
    ,port: (process.env.PORT || 3000)
};


/*var answers = {
    "repoRequestHost": "octodemo.com",
    "repoRequestRepo": "repo-requests",
    "repoRequestOwner": "rebelware",
    "repoRequestBranch": "master",
    "repoRequestPAT": "61114aca9883c6690a726efa668e563a2013d28c",
    "TemplateSourceHost": "octodemo.com",
    "TemplateSourceOwner": "rebelware",
    "TemplateSourceRepo": "repo-template",
    "TemplateSourcePath": "config/repo_templates",
    "TemplateRepoPAT": "61114aca9883c6690a726efa668e563a2013d28c",
    "repoDescriptionSuffix": " -- Created by repo-template",
    "statusCallbackURL": "http://localhost:3000",
    "repoRequestApproversTeam": "repoApprovers",
    "commitMsg": "committed by repo-template",
    "newRepoRequester":"rey",
};
*/
//createConfigs(answers);
getUserInput();
function getUserInput() {

    inquirer.prompt([{
        type: 'input',
        name: 'repoRequestHost',
        message: "Request repository host",
        default: 'github.com'
    }
        , {
            type: 'input',
            name: 'repoRequestRepo',
            message: "Request Repository name",
            default: "repoRequests",
            validate: function(response){
                var regex = /^[0-9a-zA-Z_-]+$/;
                return(regex.test(response));
            }
        }
        , {
            type: 'input',
            name: 'repoRequestOwner',
            message: "Request repository owner",
            validate: function (response) {
                var regex = /^[0-9a-z_-]+$/;
                return (regex.test(response));
            }
        }
        , {
            type: 'input',
            name: 'repoRequestBranch',
            message: "Request repository branch",
            default: 'master',
            validate: function(response) {
                var regex = /^[0-9a-zA-Z_-]+$/;
                return (regex.test(response));
            }
        }
        , {
            type: 'input',
            name: 'repoRequestPAT',
            message: "Request repository PAT",
            validate: function(response) {
                var regex = /^[0-9a-z_-]+$/;
                return (regex.test(response) && (response.length == 40));
            }
        }
        , {
            type: 'input',
            name: 'TemplateSourceHost',
            message: "Template repository host",
            default: 'github.com'
        }
        , {
            type: 'input',
            name: 'TemplateSourceOwner',
            message: "Template Source owner"
        }
        , {
            type: 'input',
            name: 'TemplateSourceRepo',
            message: "Template repository name",
            default: 'repo-template'
        }
        , {
            type: 'input',
            name: 'TemplateSourcePath',
            message: "Template repository source path",
            default: 'config/repo_templates'
        }
        , {
            type: 'input',
            name: 'TemplateRepoPAT',
            message: "Template repository PAT"
        }
        , {
            type: 'input',
            name: 'repoDescriptionSuffix',
            message: "Default new repo description suffix",
            default: ' -- Created by repo-template'
        }
        , {
            type: 'input',
            name: 'statusCallbackURL',
            message: "Repo-template server URL",
            default: "http://localhost:3000"
        }
        , {
            type: 'input',
            name: 'repoRequestApproversTeam',
            message: "Repo request approvers team name",
            default: 'repoApprovers'
        }
        , {
            type: 'input',
            name: 'commitMsg',
            message: "Repo request commit message",
            default: 'committed by repo-template'
        },
        {
            type: 'input',
            name: 'newRepoRequester',
            message: "Your GitHub username"
        }
    ]).then(function (answers) {
        //console.log("All done");
        //console.log("Answers" + JSON.stringify(answers));
        createConfigs(answers);
    });
};

function createConfigs(answers)
{
    config.global.TemplateSourceHost = answers.TemplateSourceHost;
    config.global.TemplateSourceRepo = answers.TemplateSourceOwner + "/" + answers.TemplateSourceRepo;
    config.global.TemplateSourcePath = answers.TemplateSourcePath;
    config.global.repoDescriptionSuffix = answers.repoDescriptionSuffix;
    config.global.commitMsg = answers.commitMsg;
    config.global.statusCallbackURL = answers.statusCallbackURL + '/status';
    config.prHookURL = answers.statusCallbackURL + '/pullrequest';

    config.repoRequestHost = answers.repoRequestHost;
    config.repoRequestRepo = answers.repoRequestOwner + "/" + answers.repoRequestRepo;
    config.repoRequestBranch = answers.repoRequestBranch;

    config.global.repoRequestHost = config.global.TemplateSourceHost;
    config.global.repoRequestRepo = config.global.TemplateSourceRepo;
    config.global.repoRequestBranch = "master";
    config.global.repoRequestPRLabels = ["Repo Request"];
    config.GitHubPAT = answers.repoRequestPAT;
    config.newRepoRequester = answers.newRepoRequester;
    config.newRepoOwner = answers.repoRequestOwner;
    config.newRepoTemplate = "repo-request";
    config.newRepoName = answers.repoRequestRepo;
    fs.writeFileSync('./config/config.json',JSON.stringify({global:config.global}));
    authenticate();
}

function controller(step,status,msg,err)
{
    switch(step) {
        case 'authenticate':
            resume();
            break;
        case 'resume':
            setConfig();
            break;
        case 'setConfig':
            loadRepoConfigs();
            break;
        case 'loadRepoConfigs':
            createRepoRequestRepoPR();
            break;
        case 'createRepoRequestRepoPR':
            console.log("GOt back to controller");
            resetConfig();
            break;
        case 'resetConfig':
            console.log("All done!");
            console.log("A pull request has been created in " + config.global.templateSourceRepo + ".  Merge this PR to create your Repository request repo.");
            console.log("./config/config.json has been updated with the values you supplied.");
            console.log("Update config.json->statusCallbackURL with the URL where you'll be deploying, commit the file to the master branch on " + config.global.templateSourceRepo + " and you're ready to deploy!");
        //process.exit(0);
    };
};

function authenticate()
{
    //server authenticate
    //server config
    //server resume
    //server createRepo
    rt = new RT();
    httpOptions.method = 'PUT';
    httpOptions.path = '/authenticate';
    httpOptions.headers = {'Content-Type':'application/json','Auth':config.GitHubPAT};

    var req;

    req = http.request(httpOptions,function(response){
        var str = '';
        response.on('data',function(chunk){
            str += chunk;
        });

        response.on('end',function() {
            controller("authenticate", "OK",str);
        })
    });

    req.write('');
    req.end();
}

function resume()
{
    httpOptions.method = 'get';
    httpOptions.path = '/resume';

    var req;

    req = http.request(httpOptions,function(response){
        var str = '';
        response.on('data',function(chunk){
            str += chunk;
        });

        response.on('end',function() {
            controller("resume", "OK",str);
        })
    });

    req.write('');
    req.end();
}



function resetConfig()
{
    console.log("Reset Config");
    config.global.repoRequestHost = config.repoRequestHost;
    config.global.repoRequestRepo = config.repoRequestRepo;
    config.global.repoRequestBranch = config.repoRequestBranch;
    fs.writeFileSync('./config/config.json',JSON.stringify({global:config.global}));

    controller('resetConfig',"OK","");
}

function setConfig() {

    httpOptions.method = "GET";
    httpOptions.path = '/reloadConfig';
    httpOptions.headers = {'Content-Type': 'application/json'};

    var req;

    req = http.request(httpOptions,function(response){
        var str = '';
        response.on('data',function(chunk){
            str += chunk;
        });

        response.on('end',function() {
            controller("setConfig", "OK",str);
        })
    });

    req.write('');
    req.end();

};


function loadRepoConfigs() {

    httpOptions.method = "GET";
    httpOptions.path = '/reloadRepoConfigs';
    httpOptions.headers = {'Content-Type': 'application/json'};

    var req;

    req = http.request(httpOptions,function(response){
        var str = '';
        response.on('data',function(chunk){
            str += chunk;
        });

        response.on('end',function() {
            controller("loadRepoConfigs", "OK",str);
        })
    });

    req.write('');
    req.end();

};


function createRepoRequestRepoPR()
{
    var reqOptions = require('./config/repo_requests/request-default-example.json');
    reqOptions.newRepoOwner = config.newRepoOwner;
    reqOptions.newRepoName = config.newRepoName;
    reqOptions.newRepoTemplate = 'repo-request';
    reqOptions.newRepoRequester = config.newRepoRequester;
    httpOptions.method = "POST";
    httpOptions.path = '/createRepo';
    httpOptions.headers = {'Content-Type': 'application/json'};

    var req;

    req = http.request(httpOptions,function(response){
        var str = '';
        response.on('data',function(chunk){
            console.log("got a response");
            str += chunk;
        });

        response.on('end',function() {
            console.log("got to end: " + str);
            controller("createRepoRequestRepoPR", "OK",str);
        })
    });

    req.write(JSON.stringify(reqOptions));
    req.end();
};

