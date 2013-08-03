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

module.exports = TaskRunner;

var EventEmitter = require('events').EventEmitter,
	BuildTask = require('./tasks/BuildTask.js'),
	PragmaLogger = require('pragma-logger'),
	PragmaScheduler = require('pragma-scheduler'),
	util = require('util');

util.inherits(TaskRunner, EventEmitter);

/**
 * Create new instance of task runner service.
 * @param {PragmaConfig} config Configuration object with 'tasks' section.
 * @param {BuildManager} buildManager Build manager.
 * @constructor
 */
function TaskRunner(config, buildManager) {
	TaskRunner.super_.call(this);
	this._config = config;
	this._logger = new PragmaLogger(config);
	this._buildManager = buildManager;
	this._pendingCheckScheduler = new PragmaScheduler(0, config.tasks.checkInterval,
	                                                  this._checkPendingBuild.bind(this));
}

/**
 * Configuration object with 'tasks' section.
 * @type {PragmaConfig}
 * @private
 */
TaskRunner.prototype._config = null;

/**
 * Current logger instance.
 * @type {PragmaLogger}
 * @private
 */
TaskRunner.prototype._logger = null;

/**
 * Current instance of build manager.
 * @type {BuildManager}
 * @private
 */
TaskRunner.prototype._buildManager = null;

/**
 * Current instance of scheduler which checks for pending builds.
 * @type {PragmaScheduler}
 * @private
 */
TaskRunner.prototype._pendingCheckScheduler = null;

/**
 * Current processing task.
 * @type {BuildTask}
 * @private
 */
TaskRunner.prototype._currentTask = null;

/**
 * Check for task in pending state.
 * @private
 */
TaskRunner.prototype._checkPendingBuild = function () {

	if (this._currentTask) {
		return;
	}

	this._buildManager.getPendingBuild(function (error, build) {
		if (error || !build) {
			return;
		}
		this._startTask(build);
	}.bind(this));
};

/**
 * Handle build trigger.
 * @param {String} key Trigger key.
 */
TaskRunner.prototype.handleTrigger = function (key) {
	this._logger.info(util.format('Trying create build by trigger "%s"', key));

	this._buildManager.createBuildByTriggerKey(key);
};

/**
 * Start next task.
 * @param {Object} build Build object in pending state.
 * @private
 */
TaskRunner.prototype._startTask = function (build) {
	this._logger.info(util.format('Starting build for project "%s"', build.name));

	this._pendingCheckScheduler.stop();

	this._currentTask = new BuildTask(this._config, build);
	this._currentTask.on('stateChanged', this._stateChangedHandler.bind(this, build, this._currentTask));
	this._currentTask.run();
};

TaskRunner.prototype._stateChangedHandler = function (build, task, state) {

	this._logger.info(util.format('Build #%d of project "%s" changed state to %s',
	                              build.number, build.name, state));

	this._buildManager.setBuildState(build._id, state, function (error, newBuild) {
		if(error){
			task.kill();
			return;
		}

		if (task.isFinished) {
			task.removeAllListeners();
			this._currentTask = null;
			this._pendingCheckScheduler.start();
		}
	}.bind(this));
};

/**
 * Start task runner service.
 */
TaskRunner.prototype.start = function () {
	this._pendingCheckScheduler.start();
};