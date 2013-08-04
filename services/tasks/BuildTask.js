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
	util = require('util');

util.inherits(BuildTask, EventEmitter);

/**
 * Create new instance of build task.
 * @param {PragmaConfig} config Current configuration with 'tasks' section.
 * @param {Mongoose.Document} build Build of task.
 * @constructor
 */
function BuildTask(config, build) {
	BuildTask.super_.call(this);
	this._build = build;
	this._logger = new PragmaLogger(config);
	this._killByTimeoutScheduler = new PragmaScheduler(build.timeout, 0,
	                                      this.kill.bind(this));
}

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
 * Kill this task.
 */
BuildTask.prototype.kill = function () {
	if (this.isFinished) {
		return;
	}
	this.isFinished = true;
	this.emit('stateChanged', 'killed');
};

/**
 * Run this task.
 */
BuildTask.prototype.run = function () {
	this._killByTimeoutScheduler.start();
	this._logger.info(util.format('Project "%s" build #%d: running build task...',
	                              this._build.name,
	                              this._build.number));
	this._cloneRepository();
	this._runTests();
	this._runPreDeploymentScript();
	this._runPostDeploymentScript();
	this._deploy();
};

/**
 * Clone git repository specified in build.
 * @private
 */
BuildTask.prototype._cloneRepository = function () {
	if(this.isFinished){
		return;
	}
	this._logger.info(util.format('Project "%s" build #%d: git clone from %s branch %s',
	                              this._build.name,
	                              this._build.number,
	                              this._build.git,
	                              this._build.branch || 'master'
	));

};

/**
 * Run tests specified in build.
 * @private
 */
BuildTask.prototype._runTests = function () {
	if(this.isFinished){
		return;
	}
	this._logger.info(util.format('Project "%s" build #%d: run tests',
	                              this._build.name,
	                              this._build.number));
};

/**
 * Run pre-deployment script specified in build.
 * @private
 */
BuildTask.prototype._runPreDeploymentScript = function () {
	if (!this._build.preDeploymentScript || this.isFinished) {
		return;
	}

	this._logger.info(util.format('Project "%s" build #%d: run pre-deployment script',
	                              this._build.name,
	                              this._build.number));
};

/**
 * Run post-deployment script specified in build.
 * @private
 */
BuildTask.prototype._runPostDeploymentScript = function () {
	if (!this._build.postDeploymentScript || this.isFinished) {
		return;
	}

	this._logger.info(util.format('Project "%s" build #%d: run post-deployment script',
	                              this._build.name,
	                              this._build.number));
};

/**
 * Deploy build to specified location.
 * @private
 */
BuildTask.prototype._deploy = function () {
	if (!this._build.deploymentPath || this.isFinished) {
		return;
	}

	this._logger.info(util.format('Project "%s" build #%d: deploy "%s" to "%s"',
	                              this._build.name,
	                              this._build.number,
	                              this._build.deploymentRoot || '.',
	                              this._build.deploymentPath));
};