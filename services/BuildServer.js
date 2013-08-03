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

module.exports = BuildServer;

var TaskRunner = require('./TaskRunner.js'),
	BuildManager = require('./BuildManager.js'),
	TriggerListener = require('./TriggerListener.js');

function BuildServer(config){
	this._triggerListener = new TriggerListener(config);
	this._taskRunner = new TaskRunner(config, new BuildManager(config));

	this._triggerListener.on('trigger', function(key){
		this._taskRunner.handleTrigger(key);
	}.bind(this));
}

BuildServer.prototype._taskRunner = null;
BuildServer.prototype._triggerListener = null;

BuildServer.prototype.start = function () {
	this._taskRunner.start();
	this._triggerListener.start();
};