#! /usr/bin/env node
/**
 * Created by bryancross on 12/27/16.
 *
 */

'use strict';
const fs = require('fs');
const http = require('http');
const GitHubClient = require('github'); // https://github.com/mikedeboer/node-github
//const GHClient = require('./lib/github/lib/index.js'); // https://github.com/mikedeboer/node-github
const HttpDispatcher = require('httpdispatcher');
const HashMap = require('hashmap');
const Worker = require('./worker.js');
const JSComp = require('./lib/json-compare.js');
const Logger = require('./lib/logger.js');
const uNameTest = require('github-username-regex');
const PORT = process.env.PORT || 3000;
const ERR_LOADING_TEMPLATE = 1;
var events = require('events');
var eventEmitter = new events.EventEmitter;

module.exports = RepoTemplate;

function RepoTemplate() {
	try {
        this.init();
	}
	catch(err)
	{
		if(err.code == 'ENOENT' && err.errno == -2)
		{
			this.logger.syslog("No configuration found.","RepoTemplate","Exception",err);
			this.suspended = true;
		}
		else
		{
			this.logger.endlog("Error initializing server","RepoTemplate","Fatal",err);
			process.exit(0);
		}
	}

	this.initHTTPServer();
}

RepoTemplate.prototype.init = function () {
    var color = Math.floor(Math.random() * 6) + 30;
    var colorString = '\x1b[' + color + 'm';

	this.logger = new Logger({
        "syslogPath": "./log/repo-template.log",
        "logPath": "./log/" + this.ID + ".json",
        "columnSpec": {cols: [30, 40,15, 30, 50, 50], padding: 10, prefix:"SYSLOG: "},
        "ID":null,
        "color":"\x1b[36m"
    });
    this.logger.syslog('Server startup', 'init()', 'OK');

	this.suspended = false;
	this.config = {};
	this.loadConfig();
	this.workers = new HashMap();

	if(this.config.GitHubPAT)
	{
		this.initGitHubClient();
        this.loadRepoConfigs();
	}
	else
	{
		this.logger.syslog("No PAT present, GitHub client not authenticated", "init","NoPAT");
		this.suspended = true;
		return;
	}

    // Load repository configs


};

RepoTemplate.prototype.initHTTPServer = function(){
	let self = this;
	this.dispatcher = new HttpDispatcher();
	this.dispatcher.onPost('/pullrequest', this.handlePullRequest);
	this.dispatcher.onPost('/createRepo', this.handleCreateRepo);
	this.dispatcher.onGet('/status', this.handleStatus);
	this.dispatcher.onPost('/stop',this.handleStop);
	this.dispatcher.onGet('/suspend', this.handleSuspend);
	this.dispatcher.onGet('/resume',this.handleResume);
	this.dispatcher.onGet('/reloadConfig',this.loadConfig);
	this.dispatcher.onGet('/loadRepoConfigs',this.handleLoadRepoConfigs);
	this.dispatcher.onGet('/init',this.handleInit);
	this.dispatcher.onPost('/setCallbackURL', this.handleSetCallbackURL);
	this.server = http.createServer((request, response) => {
			try {
                request.rt = self;
    			//request.respond = self.respond;

				response.respond = function(status, msg, format, err) {
                    if (typeof format == 'undefined') //default is JSON
                    {
                        try {
                            JSON.parse(msg);
                            format = 'json'
                        }
                        catch(err)
						{
							msg = {message: msg};
							format = 'json'
						}
                    }
					if (format == 'json')
					{
						format = 'application/json';
					}
					else if (format == 'html')
					{
						format = 'text/html';
					}
					else
					{
						format = 'text/plain';
					}


                    if (typeof err != 'undefined') {
                        this.error = err;
                    }
                    this.writeHead(status, {'Content-Type': format});
                    this.end((format === 'application/json' ? JSON.stringify(msg) : msg));
                	};

				// Dispatch
					if (self.suspended
						&& request.url !== '/resume'
						&& request.url !== '/init'
						&& request.url !== '/reloadConfig')
					{
						response.respond(503, this.getStatusMessage());
						this.logger.syslog(this.getStatusMessage(), "createServer.dispatch","OK");
						return;
					}
					this.dispatcher.dispatch(request, response);
				} catch (err) {
					if (err.message === 'SHUTDOWN')			{
						throw err;
						}
				self.logger.syslog('Error dispatching HTTP request', 'this.server.dispatcher', 'OK', err);
        		response.respond(503, "Error dispatching HTTP request",err.message);
				}
		});

	// Startup the server
	this.server.listen(PORT, () => {
		// Callback when server is successfully listening
		self.logger.syslog('Server listening on: http://localhost: ' + PORT, 'init()', 'OK');
	});

	// Cleanup after ourselves if we get nerve-pinched
	process.on('SIGTERM', function () {
		this.server.close(() => {
			self.shutdown();
		});
	});
};

RepoTemplate.prototype.handleSetCallbackURL = function(req,res)
{
    var URL = "";
    //Validation? Nah.
    //var regex = /^([a-z|0-9]){40}$/;
    var msg = '';
    var status = 202;
    try{
    	URL = JSON.parse(req.body).callbackURL // {callbackURL:"http://foo"}
		req.rt.config.global.callbackURL = URL;
    	msg = "Callback URL set to " + URL;
        req.rt.logger.syslog(msg, 'handleSetCallbackURL', 'OK');
	}
	catch(err)
	{
		msg = "Failed to set callback URL: " + err.message;
        req.rt.logger.syslog(msg, 'handleSetCallbackURL', 'Error',err);
	}
    res.respond(status,msg,'json');
}

RepoTemplate.prototype.handleInit = function(req,res)
{
    var PAT = req.headers.auth;
    var regex = /^([a-z|0-9]){40}$/;
    var msg = '';

    if (typeof PAT == 'undefined' || !regex.test(PAT))
    {

        msg = "Authentication failed: Missing or invalid PAT";
    	res.respond(401, msg, "Missing or invalid PAT");
        req.rt.logger.syslog(msg,"handleInit","ERROR");
        return;
    }
    req.rt.config.GitHubPAT = req.headers.auth;
	try {
        req.rt.initGitHubClient();
        req.rt.suspended = false;
        req.rt.loadRepoConfigs(req);
        msg = "GitHub client initialization successful";
        res.respond(202, msg, "Client initialized");
        req.rt.logger.syslog(msg,"handleInit","OK");
	}
	catch(err)
	{
		msg = "Error initializing GitHub client: " + err.message
        res.respond(501, msg, "Error initializing client");
        req.rt.logger.syslog(msg,"handleInit","ERROR");
    }




}

RepoTemplate.prototype.handleSuspend = function(req, res)
{
	let that = req.rt;
	that.suspended = true;
    res.respond(200,{message: 'Server SUSPEND received.  Server is suspended.'},'json');
	that.logger.syslog('Server SUSPEND received.  Server is suspended.')
};

RepoTemplate.prototype.handleResume = function(req, res)
{
    let that = req.rt
	that.suspended = false;
    res.respond(200,{message: 'Server RESUME received.  Server is resumed.'},'json');
    that.logger.syslog('Server RESUME received.  Server is resumed.')
};

RepoTemplate.prototype.handleStop = function(req,res)
{
	let that = req.rt;
    this.logger.syslog('Server STOP received: ' + msg);
    this.server.close(() => {
		self.shutdown();
	});
}

RepoTemplate.prototype.getStatusMessage = function(){

    if(!this.config.global)
	{
		return "Server is suspended.  No configuration loaded";
	}
	if(this.suspended && this.config.GitHubPAT)
    {
        return "Server is suspended";
    }
    else if (this.suspended && (!this.config.hasOwnProperty('GitHubPAT') || this.config.GitHubPAT.length != 40))
    {
        return "Server is suspended.  No PAT set";
    }
    else if (!this.suspended)
    {
        return "Server is active";
    }
}

// Initiate, authenticate, and validate the GitHub Client
RepoTemplate.prototype.initGitHubClient = function(){
	var self = this;
	this.GHClient = new GitHubClient({
		debug: this.config.global.githubAPIDebug,
		pathPrefix: this.config.global.TemplateSourceHost === 'github.com' ? '' : '/api/v3',
		host: this.config.global.TemplateSourceHost === 'github.com' ? 'api.github.com' : this.config.global.TemplateSourceHost,
		protocol: 'https',
		headers: {'user-agent': this.config.global.userAgent}
	});

	// Authenticate using configured credentials
	this.GHClient.authenticate({
		type: this.config.global.authType,
		token: this.config.GitHubPAT
	});

	// Validate connection by retrieving current user info
	this.GHClient.users.get(
        {
        //No Parameters
        }).then(function(result)
			{
				self.logger.syslog("GitHub connection validated. ", "initGitHubClient()", "OK");
		}).catch(function(err)
	{
		self.logger.syslog("GitHub connection not valid. Resetting PAT to ''","initGitHubClient","Error",err);
		self.config.GitHubPAT = "";
	});


};

RepoTemplate.prototype.handleCreateRepo = function (req, res) {

    //God this is a hack-a-saurus rex.  But how else to get a reference to the calling object?
    //Interestingly, if we try to assign this to self it complains on startup that self is already defined.
    //Should debug when we get time
    let that = req.rt;
    var reqJSON;
    try{
        reqJSON = JSON.parse(req.body);
	}
	catch(err)
	{
        res.respond(400, {message: 'JSON request does not conform to template',detail: req.body})
		that.logger.syslog("Invalid JSON in request","handleCreateRepo()","Error",err);
		return;
	}

    // Validate that the request JSON is properly formed
	const diffs = JSComp.compareJSON(reqJSON, JSON.parse(fs.readFileSync('./config/repo_requests/request-default-example.json')));
	if (diffs) {
		that.logger.syslog('JSON request does not conform to template: ' + JSON.stringify(diffs), 'handleCreateRepo()', 'OK');
		res.respond(400, {message: 'JSON request does not conform to template', detail: diffs})
		that.logger.syslog("Invalid request: JSON does not conform to template","handleCreateRepo","Error",new Error(JSON.stringify({message:diffs})));
		return;
	}
	var validationErrors = [];
	if(!uNameTest.test(reqJSON.newRepoOwner))
	{
		validationErrors.push("newRepoOwner value is invalid: " + reqJSON.newRepoOwner);
	}
	if(!uNameTest.test(reqJSON.newRepoName))
	{
		validationErrors.push("newRepoName value is invalid: " + reqJSON.newRepoName);
	}
	if(!uNameTest.test(reqJSON.newRepoTemplate))
	{
		validationErrors.push("newRepoTemlate value is invalid: " + reqJSON.newRepoTemplate);
	}
	if(!uNameTest.test(reqJSON.newRepoRequester))
	{
    	validationErrors.push("newRepoRequester value is invalid: " + reqJSON.newRepoRequester);
	}

	if(validationErrors.length > 0)
	{
        res.respond(400, {message: 'One or more request parameters are invalid', detail: validationErrors})
        that.logger.syslog(validationErrors.length + " invalid request parameters","handleCreateRepo","Error",new Error(JSON.stringify({message:validationErrors})));
        return;
	}
	let worker;
	try {
		worker = new Worker(reqJSON, that.cloneGlobalConfig());
		worker.events.on('worker.event',function(msg){
			if(msg.type && msg.type == 'done')
			{
                that.popWorker(msg.id);
			}

		});
		that.workers.set(worker.ID, worker);
	} catch (err) {
		if(err.message && err.message == "OAuth2 authentication requires a token or key & secret to be set")
		{
			that.logger.syslog("No valid PAT set.  Use authenticate endpoint to supply one","handleCreateRepo()","Error",err);
			res.respond(500,{message: 'Could not create server object.  Authentication not set',error: err.message})
			return
		}
		that.logger.syslog('Error creating worker', 'handleCreateRepo()', 'OK', err);
		var msg = {
            message: 'Could not create server object',
            error: err.message
        };
		res.respond(500,msg,err.message);
		return;
	}
	res.respond(201,{jobID: worker.getID()})
	worker.createPullRequest();
};


RepoTemplate.prototype.popWorker = function(id){
	if(this.workers.has(id))
	{
		this.logger.syslog("Popping worker " + id + " from workers collection","popWorker","OK");
		this.workers.remove(id);
	}
	else
	{
		this.logger.syslog("Request to pop worker " + id + " failed.  Not found in workers hashmap","popWorker","Exception");
	}
};


// POST to /pullrequest
RepoTemplate.prototype.handlePullRequest = function (req, res) {
    //God this is a hack-a-saurus rex.  But how else to get a reference to the calling object?
    //Interestingly, if we try to assign this to self it complains on startup that self is already defined.
    //Should debug when we get time
    let that = req.rt;
    res.respond(202,{
        message: 'PR event received'
    });
	that.logger.syslog('PR event received', 'handlePullRequest()', 'OK');

	let PR;

	try {
		PR = JSON.parse(req.body);
	} catch (err) {
		that.logger.syslog('Error parsing Pull Request JSON', 'handlePullRequest()', 'OK', err);
		return;
	}

	if (!PR.pull_request || !PR.pull_request.merged) {
		that.logger.syslog('Skipping non-merge PR event: ' + PR.action, 'handlePullRequest()', 'OK');
		return;
	}

	if (PR.pull_request.base.ref !== that.config.global.repoRequestBranch) {
		that.logger.syslog('Skipping merge.  Base is not ' + that.config.global.repoRequestBranch, 'handlePullRequest()', 'OK');
		return;
	}

  // Var PRBody = PR.pull_request.body.replace(/[\n\r]+/g,'')
	const config = that.cloneGlobalConfig();
	config.params = {TemplateSourceHost: PR.pull_request.url.split('/', 3)[2]};
	config.params.username = config.adminUserName;
	config.params.userPAT = that.config.GitHubPat;
	let worker = new Worker(null, config, PR);
    worker.events.on('worker.event',function(msg){
        if(msg.type && msg.type == 'done')
        {
            that.popWorker(msg.id);
        }

    });
	that.workers.set(worker.getID(), worker);
	that.logger.syslog('Created worker with ID: ' + worker.getID(), 'handlePullRequest()', 'OK');
	worker.createRepositoryRequestPR();
};

// GET /status
RepoTemplate.prototype.handleStatus = function (req, res, self) {
	//God this is a hack-a-saurus rex.  But how else to get a reference to the calling object?
	//Interestingly, if we try to assign this to self it complains on startup that self is already defined.
	//Should debug when we get time
	let that = req.rt;
	that.logger.syslog('Status request received', 'handleStatus()', 'OK');

	if(that.suspended)
	{
 		res.respond(200,that.getStatusMessage());
 		return;
	};


	const URL = require('url');
	let jobID;
	let format = 'json';

    // If no query parameters, return the state of the server
	if (!URL.parse(req.url).query) {
		that.logger.syslog('Received status request', 'Status', 'OK');
		res.respond(200, {serverState: that.getStatusMessage()});
		return;
	}

	try {
		jobID = URL.parse(req.url).query.split('=')[1].split('&')[0];
	} catch (err) {
		that.logger.syslog('Error parsing parameters from url: ' + req.url, 'handleStatus()', 'OK', err.message);
		return;
	}

	that.logger.syslog('Received status request for job with ID: ' + jobID, 'handleStatus()', 'OK');
	try {
		const formatParam = URL.parse(req.url).query.split('=')[2];
		if (formatParam === 'html') {
			format = 'html';
		}
	} catch (err) {
		that.logger.syslog('No format parameter specified.  Returning JSON', 'handleStatus()', 'OK');
	}

    // Search the array of workers in memory

	const curWorker = that.workers.get(jobID);
	let logData;
	let logDataHTML;
	if (curWorker) {
		logData = curWorker.getLog(true);
		logDataHTML = curWorker.getLog(true, 'html');
	} else {
        // If we're still here the job is finished and the job object deleted from the global array
        // So let's see if there's info in the log...
        //Get the logfile from the repository
        that.GHClient.repos.getContent({
            owner: that.config.global.TemplateSourceRepo.split('/')[0],
            repo: that.config.global.TemplateSourceRepo.split('/').pop(),
            path: 'log/' + jobID + '.json'
        }).then(function (log) {

            logDataHTML = fs.readFileSync('HTMLLogTemplate.html').toString();
            const B64 = require('js-base64/base64.js').Base64;
            logData = JSON.parse(B64.decode(log.content));
            logDataHTML = logDataHTML.replace('$$HEADER$$', '<h2>Repository Creation Job: ' + logData.ID + '<br/> Status: ' + logData.status + ' </h2><br/>');
            logDataHTML = logDataHTML.replace('$$LOGDATA$$', JSON.stringify(logData));
			res.respond(200,format === 'html' ? logDataHTML : logData, format === 'html' ? 'html' : 'json');
            that.logger.syslog('Status request processed successfully for jobID: ' + jobID, 'handleStatus()', 'OK');
        })
            .catch(function (err) {
                // No file found
                if (err.errno === -2) {
                    that.logger.syslog('No log data found for jobID: ' + jobID, 'handleStatus()', 'OK', err);
                    res.respond(404, {message: 'No job data found for job ID: ' + jobID}, 'json');
                } else {
                    // Something else went wrong
                    that.logger.syslog('Error retrieving status data for jobID: ' + jobID, 'handleStatus()', 'OK', err);
                    res.respond(500, {message: 'Error retrieving log file for job ID: ' + jobID + ' ' + err.message}, 'json');
                }
            });
                }
};


RepoTemplate.prototype.handleLoadRepoConfigs = function(req,res)
{
    res.respond(202, {message: "Load repo configs request received"},'json');
	req.rt.loadRepoConfigs(req);
};


RepoTemplate.prototype.loadRepoConfigs = function (req) {
    let self = req.rt;
	self.logger.syslog('Loading repository configurations.', 'loadRepoConfigs()', 'OK');
	self.config.repoConfigs = new HashMap();

	self.GHClient.repos.getContent({
		owner: self.config.global.TemplateSourceRepo.split('/')[0],
		repo: self.config.global.TemplateSourceRepo.split('/').pop(),
		path: self.config.global.TemplateSourcePath,
		ref: self.config.global.TemplateSourceBranch
	}).then(result => {
		for (let i = 0; i < result.length; i++) {
			self.logger.syslog('Loading config: ' + result[i].path.split('/').pop(), 'loadRepoConfigs()', 'OK');
			self.GHClient.repos.getContent({
				owner: self.config.global.TemplateSourceRepo.split('/')[0],
				repo: self.config.global.TemplateSourceRepo.split('/').pop(),
				path: result[i].path,
				ref: self.config.global.TemplateSourceBranch
				}).then(result => {
					const B64 = require('js-base64/base64.js').Base64;
					const config = JSON.parse(B64.decode(result.content));
					self.config.repoConfigs.set(config.configName, config);
					self.logger.syslog('Loaded config: ' + config.configName, 'loadRepoConfigs()', 'OK');
				}).catch(err => {
					self.logger.syslog('Error retrieving repository configuration files.  Server will shutdown', 'loadRepoConfigs()', 'FATAL', err);
					self.shutdown();
		});
	}
	}).catch(err => {
        if (err.message == 'Bad credentials'
    )
    {
        self.logger.syslog("Bad credentials.  Repo configs not loaded.", "loadRepoConfigs()", "Error", err);
    }
    else
    {
        self.logger.syslog('Error retrieving repository configuration directory. Server will shutdown', 'loadRepoConfigs()', 'FATAL', err);
        self.shutdown();
    }
});
};

RepoTemplate.prototype.loadConfig = function () {
    let self = this;
    let newConfig = {};
    let origRepoConfigs = new HashMap();

    if (this.config && Object.prototype.hasOwnProperty.call(this.config, 'repoConfigs')) {
        //origRepoConfigs = JSON.parse(JSON.stringify(this.config.repoConfigs));
        origRepoConfigs = new HashMap(this.config.repoConfigs);
        delete this.config["repoConfigs"];
    }

    this.logger.syslog('Loading system configuration.', 'loadConfig()', 'OK');

    newConfig = JSON.parse(fs.readFileSync('./config/config.json'));

    this.config.global = JSON.parse(JSON.stringify(newConfig.global));
    if (origRepoConfigs) {
        this.config.repoConfigs = origRepoConfigs;
    }

    // GitHub Enterprise uses /api/v3 as a prefix to REST calls, while GitHub.com does not.
    this.config.global.GitHubAPIURLPrefix = (this.config.global.repoRequestHost === 'github.com') ? '' : '/api/v3';

    // If we're going to GitHub, prepend the host with 'api', otherwise leave it be
    this.config.global.targetHost = (this.config.targetHost === 'github.com') ? 'api.github.com' : this.config.global.targetHost;
    this.logger.syslog('Server configuration loaded', 'loadConfig()', 'OK');

};

RepoTemplate.prototype.cloneGlobalConfig = function () {
	const repoConfigs = this.config.repoConfigs;
	const newConfig = JSON.parse(JSON.stringify(this.config));
	newConfig.repoConfigs = repoConfigs;
	return newConfig;
};

