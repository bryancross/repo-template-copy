/**
 * Created by bryancross on 1/14/17.
 */

const fs = require('fs');
const format = require('date-fns/format');  // https://github.com/date-fns/date-fns
const Columnizer = require('./columnizer.js');
const extend = require('util')._extend;
const jpp = require('json-path-processor');

var status = 'open';

function Logger(config) {
	//self = this;
	this.config = config;
	this.logData = {};
	if(config.color)
	{
		this.color = config.color;
	}
	if(config.columnSpec)
	{
        this.columnizer = new Columnizer(config.columnSpec);
	}
	if(config.ID)
	{
		this.logData.ID = config.ID;
	}
    var logpath = this.config.logPath.split('/');
    var logdir = logpath[logpath.length - 2];
    if(!fs.existsSync(logdir)){
        fs.mkdirSync(logdir);
    }

}

module.exports = Logger;

Logger.prototype.log = function (msg, execPoint, status, error) {
	if(!msg == 'undefined')
	{
		msg = "no msg supplied";
	}
	if(!execPoint)
	{execPoint = "no execPoint supplied";};
	if(!status)
	{
		status = "no status supplied";
	}
	const datestamp = format(new Date());
	if(!this.logData.msgs)
	{
		this.logData.msgs = [];
	}
	if(!this.logData.errors)
	{
		this.logData.errors = [];
	}
		if (status) {
			this.logData.status = status;
		}
		const logEntry = {time: datestamp, ID:(this.logData.ID ? this.logData.ID : 'no ID'), msg:msg, execPoint:execPoint, status:status, error: (error ? error : '')};
		this.logData.msgs.push(logEntry);
		try {
            if (error && typeof(error) == 'string') {
                this.logData.errorMessage = error;
                this.logData.errors.push(error);
            }
            else if (error && typeof(error) == 'object' && Object.prototype.toString.call(error) == '[object Error]') {
                this.logData.errorMessage = error.message;
                this.logData.errors.push(error.message);
            }
            else if (error) {
                this.logData.errorMessage = error.toString();
                this.logData.errors.push(error.toString());
            }
        }
        catch(err)
		{
			this.logData.errors.push("Error attempting to resolve error.  It's a meta-error");
		}
    // This.syslog(msg, execPoint, status, error);
	if(this.columnizer)
	{
        console.log((this.color ? this.color : '') + this.columnizer.columnify({data: [datestamp, (this.logData.ID ? this.logData.ID : 'no ID'), status, execPoint, msg, (error ? error.message : '')]}));
	}
	else
	{
		console.log((this.color ? this.color : '') + datestamp + "\t" + (this.logData.ID ? this.logData.ID : 'no ID') + "\t" + status  + "\t" + execPoint + "\t" + msg + "\t" + (error ? error.message : ''));
	}
};

Logger.prototype.append = function(objToAppend)
{
	this.logData = extend(this.logData, objToAppend);
};

Logger.prototype.prepend = function(objsToPrepend, key)
{
	var newLogData = {};
	var prependedData = {};
	var origLogData = JSON.parse(JSON.stringify(this.logData));
	for(i = 0;i < objsToPrepend.length;i++)
	{
        prependedData = extend(prependedData, objsToPrepend[i])
    }
    newLogData[key]=prependedData;

	this.logData = extend(newLogData, this.logData);

};

Logger.prototype.getLog = function(pathsToRedact, redactPhrase)
{
    if(!pathsToRedact)
	{
		return this.logData;
	}
	var data = this.logData;
	    for(var i = 0;i < pathsToRedact.length;i++)
        {
            jpp(data).set(pathsToRedact[i], redactPhrase);
        }
    return data;
};

Logger.prototype.endlog = function (path, pathsToRedact, redactPhrase) {
	this.flushToFile(path, pathsToRedact,redactPhrase);
};

Logger.prototype.flushToFile = function(path, pathsToRedact, redactPhrase)
{
    var logContent = JSON.stringify(this.getLog(pathsToRedact, redactPhrase));

    fs.writeFile(this.config.logPath, logContent, err => {
        if (err) {
            // Console.log("Error writing job log to file: " + err)
            const e = {message: 'Error writing job log to file' + err};
            throw (e);
        }
    });
};

Logger.prototype.syslog = function (msg, execPoint, status, error) {
    if(!msg == 'undefined')
    {
        msg = "no msg supplied";
    }
    if(!execPoint)
    {execPoint = "no execPoint supplied";};
    if(!status)
    {
        status = "no status supplied";
    }
	const datestamp = format(new Date());
	const logString = (this.columnizer ? this.columnizer.columnify({data: [datestamp, (this.logData.ID ? this.logData.ID : 'no ID'), status, execPoint, msg, (error ? error.message : '')]})
								  : datestamp + "\t" + status + "\t" + execPoint + "\t" + msg + "\t" + (error ? error.message : ""));
   console.log((this.color ? this.color : '') + logString);

	if (fs.existsSync(this.config.syslogPath)) {
		fs.appendFile(this.config.syslogPath, '\n' + logString, err => {
			if (err) {
				console.log('Error appending to SYSLOG: ' + err);
			}
		});
	} else {
		fs.writeFile(this.config.syslogPath, logString, err => {
			if (err) {
				console.log('Error writing to SYSLOG: ' + err);
			}
		});
	}
};

