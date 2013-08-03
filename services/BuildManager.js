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

module.exports = BuildManager;

var mongodb = require('mongodb'),
	PragmaLogger = require('pragma-logger'),
	PragmaScheduler = require('pragma-scheduler'),
	EventEmitter = require('events').EventEmitter,
	util = require('util');

util.inherits(BuildManager, EventEmitter);

/**
 * Create new instance of build manager.
 * @param {PragmaConfig} config Configuration object with 'builds' section.
 * @constructor
 */
function BuildManager(config) {

	BuildManager.super_.call(this);
	this._config = config;
	this._logger = new PragmaLogger(config);
	this._connectScheduler = new PragmaScheduler(0, this._config.builds.reconnectInterval,
	                                             this._tryConnectToDatabase.bind(this));

	this._connectScheduler.start();
}

/**
 * Configuration object with 'builds' section.
 * @type {PragmaConfig}
 * @private
 */
BuildManager.prototype._config = null;

/**
 * Current logger instance.
 * @type {PragmaLogger}
 * @private
 */
BuildManager.prototype._logger = null;

/**
 * Connect attempts scheduler.
 * @type {PragmaScheduler}
 * @private
 */
BuildManager.prototype._connectScheduler = null;

/**
 * Builds collection in mongo.
 * @type {MongoCollection}
 * @private
 */
BuildManager.prototype._buildsCollection = null;

/**
 * Projects collection in mongo.
 * @type {MongoCollection}
 * @private
 */
BuildManager.prototype._projectsCollection = null;

/**
 * Try connect to database.
 * @private
 */
BuildManager.prototype._tryConnectToDatabase = function () {

	this._logger.info('Trying connect to database...');
	mongodb.MongoClient.connect(
		this._config.builds.mongoUrl,
		this._config.builds.mongoConfig,
		function (error, database) {

			if (error) {
				this._logger.error(error)
				return;
			}

			this._buildsCollection = database.collection(this._config.builds.buildsCollection);
			this._projectsCollection = database.collection(this._config.builds.projectsCollection);
			this._connectScheduler.stop();
			this._logger.info('Connected to database');
			this.emit('storageReady');

		}.bind(this));
};

/**
 * Set specified state to specified build.
 * @param {ObjectId} id Mongo document ID.
 * @param {String} state New state of build.
 * @param {Function<Error, Object>} callback Result callback.
 */
BuildManager.prototype.setBuildState = function (id, state, callback) {

	this.doWhenStorageReady(function () {
		this._buildsCollection.findAndModify(
			{_id: id},
			[
				['_id', 'asc']
			],
			{
				$set: {
					state: state
				}
			},
			{
				new: true,
				upsert: false
			},
			function (error, object) {
				if (error) {
					this._logger.error(error);
				}
				callback && callback(error, object);
			}.bind(this))
		;
	}.bind(this));
};

/**
 * Create build from project by specified trigger key.
 * @param {string} key Trigger key
 * @param {Function<Error, Object>} callback Results callback.
 */
BuildManager.prototype.createBuildByTriggerKey = function (key, callback) {

	this.doWhenStorageReady(function () {
		this._findProjectByKey(key, function (error, project) {
			if (!project) {
				this._logger.warn(util.format('Project with trigger "%s" not found', key));
				return;
			}

			delete project._id;
			project.time = new Date().getTime();
			project.state = 'pending';
			project.number = project.lastBuild;
			delete project.lastBuild;

			this._buildsCollection.insert(project, {safe: true},
			                              function (error, inserted) {
				                              if (error) {
					                              this._logger.error(error);
				                              }

				                              if (inserted.length == 0) {
					                              return;
				                              }

				                              callback && callback(error, inserted[0]);
			                              }.bind(this));

		}.bind(this));
	}.bind(this));
};

/**
 * Find project by trigger key.
 * @param {String} key Trigger key.
 * @param {Function<Error,Object>} callback Result callback.
 * @private
 */
BuildManager.prototype._findProjectByKey = function (key, callback) {
	this._projectsCollection.ensureIndex('trigger', function () {
		this._projectsCollection.findAndModify(
			{trigger: key},
			[
				['_id', 'asc']
			],
			{
				$inc: {
					lastBuild: 1
				}
			},
			{
				new: true,
				upsert: false
			},
			function (error, object) {
				if (error) {
					this._logger.error(error);
				}

				callback && callback(error, object);
			}.bind(this));
	}.bind(this));
};

/**
 * Get next pending build.
 * @param {Function<Error, Object>} callback Result callback.
 */
BuildManager.prototype.getPendingBuild = function (callback) {

	this.doWhenStorageReady(function () {
		this._buildsCollection.ensureIndex('number', function () {

			var cursor = this._buildsCollection.find(
				{state: 'pending'},
				{
					limit: 1,
					sort: [
						['number', 'asc']
					]
				}
			);

			cursor.nextObject(function (error, object) {
				if (error) {
					this._logger.error(error)
				}

				callback && callback(error, object);
			}.bind(this));
		}.bind(this));
	}.bind(this));
};

/**
 * Do action when storage will be ready or immediately if already in ready state.
 * @param {Function} action Action to call.
 */
BuildManager.prototype.doWhenStorageReady = function (action) {
	if (this._buildsCollection == null || this._projectsCollection == null) {
		this.once('storageReady', action);
		return;
	}

	action();
};