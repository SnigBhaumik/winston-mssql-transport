/**
 * This library is a slick mssql transport module for winston.
 * https://github.com/winstonjs/winston
 * 
 * Warning: User must create a log table in mssql first,
 * the default table fields are 'level', 'meta', 'message', 'timestamp'. But you can use your custom table fields by setting: options.fields.
 * Example: options.fields = { level: 'mylevel', meta: 'metadata', message: 'source', timestamp: 'addDate'}
 * Two demo tables:
 *
 CREATE TABLE `dbo`.`winston_logs` (
 `id` BIGINT NOT NULL AUTO_INCREMENT,
 `level` NVARCHAR(16) NOT NULL,
 `message` NVARCHAR(MAX) NOT NULL,
 `meta` NVARCHAR(MAX) NOT NULL,
 `timestamp` DATETIME NOT NULL DEFAULT (getdate()),
 PRIMARY KEY (`id`));
*
 */

const Transport = require('winston-transport');
const mssql = require('mssql');
const moment = require('moment');

moment.suppressDeprecationWarnings = true;

const DEFAULTS = {
	encrypt: false,
	pool: {
		max: 10,
		min: 0,
		idleTimeoutMillis: 30000
	}
};

/**
 * @constructor
 * @param {Object} options      Options for the MSSQL & log plugin
 * @param {String} options.server Database server
 * @param {String} options.user Database username
 * @param {String} options.password Database password
 * @param {String} options.database Database name
 * @param {String} options.table  Database table for the logs
 * @param {Object} **Optional** options.fields Log object, set custom fields for the log table
 */

module.exports = class MSSQLTransport extends Transport {
	constructor(options = {}) {
		super(options);

		this.name = 'MSSQL';
		this.options = options || {};

		// Validation of mandatory options
		if (!options.server) 	{ throw new Error('The database server is required'); }
		if (!options.user) 		{ throw new Error('The database username is required'); }
		if (!options.password) 	{ throw new Error('The database password is required'); }
		if (!options.database) 	{ throw new Error('The database name is required'); }
		if (!options.table) 	{ throw new Error('The database table is required'); }

		this.fields = {
			level: 'level',
			meta: 'meta',
			message: 'message',
			timestamp: 'timestamp'
		}

		const connectionConfig = {
			server: options.server,
			user: options.user,
			password: options.password,
			database: options.database,
            parseJSON: true,
            options: {
                encrypt: DEFAULTS.encrypt
            },
            pool: {
                max: options.pool && options.pool.max ? options.pool.max : DEFAULTS.pool.max,
                min: options.pool && options.pool.min ? options.pool.min : DEFAULTS.pool.min,
                idleTimeoutMillis: options.pool && options.pool.idleTimeoutMillis ? options.pool.idleTimeoutMillis : DEFAULTS.pool.idleTimeoutMillis
            }
		};

		this.console = options.console || false;

		this.pool = new mssql.ConnectionPool(connectionConfig);
		try {
			this.pool.connect((err) => {
				if (err) {
					if (this.console)	console.error('Couldn\'t connect Log SQL Server. Please check the settings.', err);
				} else {
					if (this.console) 	console.log(`Winston log SQL Server connection established.`);
				}
			});
		} catch(ex) {
			console.error('Couldn\'t initialize Log SQL Server. Please check the settings.', ex);
		}
	}

	/**
	 * function log (info, callback)
	 * {level, msg, [meta]} = info
	 * @level {string} Winston standard Level at which to log the message.
	 * @msg {string} Message to log.
	 * @meta {Object} **Optional** Additional metadata to attach.
	 * @callback {function} Continuation to respond to when complete.
	 * Core logging method exposed to Winston. Metadata is optional.
	 */
	log(info, callback) {
		const { level, message, ...winstonMeta } = info;

		process.nextTick(() => {
			if (!callback) {
				callback = () => { };
			}

			let req = new mssql.Request(this.pool), qry;
			const log = {};

			try {
				log[this.fields.meta] = JSON.stringify(winstonMeta);
				log[this.fields.level] = level;
				log[this.fields.message] = message;

				var columns = '', values = '';
				for (var prop in log) {
					columns += `${prop},`;
					values += `${(log[prop] == null) ? null : (typeof log[prop] === 'number') ? log[prop] : (typeof log[prop] === 'object') ? `'${JSON.stringify(log[prop]).split("'").join("''")}'` : `'${log[prop].split("'").join("''")}'`},`;
				}
				let params = {
					table: this.options.table,
					columns: columns.slice(0, -1),
					values: values.slice(0, -1)
				};

				qry = `INSERT INTO ${params.table} (${params.columns}) VALUES (${params.values});`;
			} catch(ex) {
				if (this.console)	console.error('Couldn\'t Initialize Log data.', ex);
			}

			try {
				req.query(qry, (err, recordset) => {
					if (err) {
						setImmediate(() => {
							// Do not emit error, otherwise all log posts need to be embedded in try...catch
							//////this.emit('error', err);
						});
						if (this.console)	console.error('unable to post log in SQL Server', err);
						// Do not throw error, otherwise all log posts need to be embedded in try...catch
						return callback(null, null);
					}
					setImmediate(() => {
						this.emit('logged', info);
					});
				});
			} catch(ex) {
				if (this.console)	console.error('Couldn\'t post log data in the store.', ex);
			}
			callback(null, true);
		});
	}

	/**
	 * function query (options, callback)
	 * {from, until, [limit], [start], [order], [fields]} = options
	 * @from {date} From date.
	 * @until {date} To date.
	 * @limit {number} **Optional** Number of log entries to be returned.
	 * @order {string} **Optional** asc or desc.
	 * @fields {Array} **Optional** Which columns to be returned.
	 * @callback {function} Continuation to respond to when complete.
	 * Query method exposed to Winston.
	 */
	query(options, callback) {
		const from = options && options.from ? options.from : null;
		const until = options && options.until ? options.until : null;
		const limit = options && options.limit ? options.limit : null;
		const order = options && options.order && (options.order.toUpperCase() === 'ASC' || options.order.toUpperCase() === 'DESC') ? options.order : 'DESC';
		const fields = options && options.fields ? options.fields : [ 'message', 'meta' ];

		process.nextTick(() => {
			if (!callback) {
				callback = () => { };
			}

			let req = new mssql.Request(this.pool), qry;
			
			let flds = fields.map((o) => { return `[${o}]` });
			let lmt = limit && !isNaN(limit) ? `TOP ${limit}` : '';
			qry = `SELECT ${lmt} [level], [timestamp], ${flds.join(', ')} FROM ${this.options.table} `;

			let conditions = [];
			if (from) {
				if (moment(from).isValid()) {
					conditions.push(`[timestamp] >= '${from}' `);
				}
			}
			if (until) {
				if (moment(until).isValid()) {
					conditions.push(`[timestamp] <= '${until}' `);
				}
			}	
			if (conditions.length) {
				qry += ' WHERE ' + conditions.join(' AND ');
			}
			qry += ` ORDER BY [timestamp] ${order}`;

			if (this.console)	console.debug('to perform log query in SQL Server', qry);
			try {
				req.query(qry, (err, recordset) => {
					if (err) {
						setImmediate(() => {
							// Do not emit error, otherwise all log posts need to be embedded in try...catch
							//////this.emit('error', err);
						});
						if (this.console)	console.error('unable to perform log query in SQL Server', err);
						// Do not throw error, otherwise all log posts need to be embedded in try...catch
						callback(err, null);
					} else {
						callback(null, recordset && recordset.recordset ? recordset.recordset : null);
					}
				});
			} catch(ex) {
				if (this.console)	console.error('Couldn\'t post log data in the store.', ex);
				callback(ex, null);
			}
		});
	}
};
