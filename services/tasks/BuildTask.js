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

function BuildTask(config, build) {
	BuildTask.super_.call(this);
	this._build = build;
	this._logger = new PragmaLogger(config);
	this._scheduler = new PragmaScheduler(build.timeout, 0,
	                                      this.kill.bind(this));
}

BuildTask.prototype._scheduler = null;

BuildTask.prototype.isFinished = false;

BuildTask.prototype._build = null;

BuildTask.prototype.kill = function () {
	if(this.isFinished){
		return;
	}
	this.isFinished = true;
	this.emit('stateChanged', 'killed');
};

BuildTask.prototype.run = function () {
	this._scheduler.start();
	this._logger.info(util.format('Running task for project "%s" build #%d',
	                              this._build.name,
	                              this._build.number));
};