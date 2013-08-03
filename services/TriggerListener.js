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

module.exports = TriggerListener;

var EventEmitter = require('events').EventEmitter,
	http = require('http'),
	url = require('url'),
	util = require('util');

util.inherits(TriggerListener, EventEmitter);

/**
 * Create new instance of trigger listener service.
 * @param {Object} config Configuration object with 'triggers' section.
 * @constructor
 */
function TriggerListener(config) {

	TriggerListener.super_.call(this);

	this._config = config;
	this._httpServer = http.createServer(this._handleRequest.bind(this));
}

/**
 * Current config object with 'triggers' section.
 * @type {Object}
 * @private
 */
TriggerListener.prototype._config = null;

/**
 * Current instance of HTTP server.
 * @type {http.Server}
 * @private
 */
TriggerListener.prototype._httpServer = null;

/**
 * Start this service.
 */
TriggerListener.prototype.start = function () {
	this._httpServer.listen(this._config.triggers.port);
};

/**
 * Handle incoming trigger request.
 * @param {http.message} request Incoming HTTP message.
 * @param {http.response} response HTTP response.
 * @private
 */
TriggerListener.prototype._handleRequest = function (request, response) {

	var query = url.parse(request.url, true).query;

	if(query && query.key){
		this.emit('trigger', query.key);
		response.writeHead(200);
	}else{
		response.writeHead(403);
	}

	response.end();
};