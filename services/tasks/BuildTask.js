/* 
 * pragma-ci
 *
 * Copyright (c) 2013 Pragma Dudes and project contributors.
 *
 * pragma-ci's license follows:
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge, 
 * publish, distribute, sublicense, and/or sell copies of the Software, 
 * and to permit persons to whom the Software is furnished to do so, 
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS 
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 * This license applies to all parts of pragma-ci that are not externally
 * maintained libraries.
 */
module.exports = BuildTask;

var EventEmitter = require('events').EventEmitter,
	PragmaLogger = require('pragma-logger'),
	PragmaScheduler = require('pragma-scheduler'),
	util = require('util'),
	path = require('path'),
	fse = require('fs-extra'),
	Q = require('Q'),
	child_process = require('child_process');

util.inherits(BuildTask, EventEmitter);

/**
 * Create new instance of build task.
 * @param {PragmaConfig} config Current configuration with 'tasks' section.
 * @param {Mongoose.Document} build Build of task.
 * @constructor
 */
function BuildTask(config, build) {
	BuildTask.super_.call(this);
	this._config = config;
	this._build = build;
	this._logger = new PragmaLogger(config);
	this._childProcess = [];
	this._killByTimeoutScheduler = new PragmaScheduler(build.timeout, 0,
	                                                   this.stop.bind(this, 'timeout'));

	this._buildPath = path.join(path.resolve(config.tasks.buildRootDirectory),
	                            util.format('%s-%s-%s', path.basename(build.git, '.git'),
	                                        build.branch,
	                                        build.number)
	);
}

BuildTask.prototype._outputCounter = 0;

/**
 * Current configuration with 'tasks' section.
 * @type {null}
 * @private
 */
BuildTask.prototype._config = null;

/**
 * Scheduler which will kill this task by timeout.
 * @type {PragmaScheduler}
 * @private
 */
BuildTask.prototype._killByTimeoutScheduler = null;

/**
 * Is this task finished.
 * @type {boolean}
 */
BuildTask.prototype.isFinished = false;

/**
 * Current build of task.
 * @type {Mongoose.Document}
 * @private
 */
BuildTask.prototype._build = null;

/**
 * Current build path.
 * @type {string}
 * @private
 */
BuildTask.prototype._buildPath = '';

/**
 * Set of child processes.
 * @type {array}
 * @private
 */
BuildTask.prototype._childProcess = null;

/**
 * Run this task.
 */
BuildTask.prototype.run = function () {
	this._killByTimeoutScheduler.start();
	this._logger.info(util.format('Project "%s" build #%d: running build task...',
	                              this._build.name,
	                              this._build.number));
	Q.nfcall(fse.mkdirs.bind(fse), this._buildPath)
		.then(this._cloneRepository.bind(this))
		.then(this._resolveDependencies.bind(this))
		.then(this._runTests.bind(this))
		.then(this._runPreDeploymentScript.bind(this))
		.then(this._runPostDeploymentScript.bind(this))
		.then(this._deploy.bind(this))
		.then(this.stop.bind(this, 'success'))
		.fail(this._logger.error.bind(this._logger))
		.fail(this.stop.bind(this, 'error'))
		.done();

	this._changeState('in progress');
};

/**
 * Clone git repository specified in build.
 * @returns {Q.Promise}
 * @private
 */
BuildTask.prototype._cloneRepository = function () {
	if (this.isFinished) {
		return null;
	}

	this._logger.info(util.format('Project "%s" build #%d: git clone from %s branch %s',
	                              this._build.name,
	                              this._build.number,
	                              this._build.git,
	                              this._build.branch || 'master'
	));

	var command = util.format('git clone --branch %s --recursive %s %s',
	                          this._build.branch, this._build.git, this._buildPath),
		options = {
			cwd: path.resolve(this._config.tasks.buildRootDirectory),
			timeout: this._build.timeout
		};

	return Q.nfcall(this._execCommand.bind(this), command, options);
};

/**
 * Resolve all dependencies via npm.
 * @returns {Q.Promise}
 * @private
 */
BuildTask.prototype._resolveDependencies = function () {

	if (this.isFinished) {
		return null;
	}

	this._logger.info(util.format('Project "%s" build #%d: resolve dependencies',
	                              this._build.name,
	                              this._build.number));

	var options = {
		cwd: this._buildPath,
		timeout: this._build.timeout
	};

	return Q.nfcall(this._execCommand.bind(this), 'npm install', options);
};

/**
 * Run tests specified in build.
 * @returns {Q.Promise}
 * @private
 */
BuildTask.prototype._runTests = function () {
	if (this.isFinished) {
		return null;
	}

	this._logger.info(util.format('Project "%s" build #%d: run tests',
	                              this._build.name,
	                              this._build.number));
	var options = {
		cwd: this._buildPath,
		timeout: this._build.timeout
	};

	return Q.nfcall(this._execCommand.bind(this), 'npm test', options);
};

/**
 * Run pre-deployment script specified in build.
 * @returns {Q.Promise}
 * @private
 */
BuildTask.prototype._runPreDeploymentScript = function () {
	if (!this._build.preDeploymentScript || this.isFinished) {
		return null;
	}

	this._logger.info(util.format('Project "%s" build #%d: run pre-deployment script',
	                              this._build.name,
	                              this._build.number));

	var options = {
		cwd: this._buildPath,
		timeout: this._build.timeout
	};

	return Q.nfcall(this._execCommand.bind(this), this._build.preDeploymentScript, options);
};

/**
 * Run post-deployment script specified in build.
 * @returns {Q.Promise}
 * @private
 */
BuildTask.prototype._runPostDeploymentScript = function () {
	if (!this._build.postDeploymentScript || this.isFinished) {
		return null;
	}

	this._logger.info(util.format('Project "%s" build #%d: run post-deployment script',
	                              this._build.name,
	                              this._build.number));

	var options = {
		cwd: this._buildPath,
		timeout: this._build.timeout
	};

	return Q.nfcall(this._execCommand.bind(this), this._build.postDeploymentScript, options);
};

/**
 * Deploy build to specified location.
 * @returns {Q.Promise}
 * @private
 */
BuildTask.prototype._deploy = function () {
	if (!this._build.deploymentPath || this.isFinished) {
		return null;
	}

	this._logger.info(util.format('Project "%s" build #%d: deploy "%s" to "%s"',
	                              this._build.name,
	                              this._build.number,
	                              this._build.deploymentRoot || './',
	                              this._build.deploymentPath));

	var deploymentRoot = path.resolve(this._buildPath, this._build.deploymentRoot);

	return Q.nfcall(fse.mkdirs.bind(fse), this._build.deploymentPath)
		.then(fse.copy.bind(fse), deploymentRoot, this._build.deploymentPath);
};

/**
 * Exec specified shell command.
 * @param {string} command Command to execute.
 * @param {object} option Option object.
 * @param {function} callback Result callback.
 * @private
 */
BuildTask.prototype._execCommand = function (command, option, callback) {
	var child = child_process.exec(command, option, callback);

	child.on('exit', this._handleProcessExit.bind(this));

	this._childProcess.unshift(child);
	this._handleStreams(child.stdout, child.stderr);
};

/**
 * Concatenate output and synchronize it with storage.
 * @param {string} data Next part of data.
 * @param {boolean} isEnd Is data ended?
 * @private
 */
BuildTask.prototype._concatOutput = function (data, isEnd) {
	this._outputCounter++;
	this._build.output += data;
	if (this._outputCounter % 5 === 0 || isEnd) {
		this._build.save();
	}
};

/**
 * Handle child process streams.
 * @param {Stream} stdout Standart output stream.
 * @param {Stream} stderr Standart error stream.
 * @private
 */
BuildTask.prototype._handleStreams = function (stdout, stderr) {
	var concatOutput = this._concatOutput.bind(this),
		endOutput = this._concatOutput.bind(this, '', true);
	stdout.on('data', concatOutput);
	stderr.on('data', concatOutput);
	stdout.on('close', endOutput);
	stderr.on('close', endOutput);
	stdout.pipe(process.stdout);
	stderr.pipe(process.stderr);
};

/**
 * Handle child process's exit.
 * @param {number} code Exit code.
 * @private
 */
BuildTask.prototype._handleProcessExit = function (code) {
	if (code === 0) {
		return;
	}

	this.stop('failed');
};

/**
 * Stop current task with specified state.
 * @param {string} state Finish state of task.
 * @private
 */
BuildTask.prototype.stop = function (state) {
	if (this.isFinished) {
		return;
	}

	this._killByTimeoutScheduler.stop();
	this.isFinished = true;
	this._childProcess.forEach(function (process) {
		process.kill('SIGKILL');
	});

	this._changeState(state);
};

/**
 * Change state to specified.
 * @param {string} state Specified state.
 * @private
 */
BuildTask.prototype._changeState = function (state) {
	this._build.state = state;
	Q.fcall(this._build.save.bind(this._build))
		.then(this.emit('stateChanged', state))
		.done();
};