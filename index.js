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
const format = require('string-template');

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

		// Check custom table fields on options
		if (!options.fields) {
			this.options.fields = {};

			// Use default names
			this.fields = {
				level: 'level',
				meta: 'meta',
				message: 'message',
				timestamp: 'timestamp'
			}

		} else {
			// Use custom table field names
			this.fields = {
				level: this.options.fields.level,
				meta: this.options.fields.meta,
				message: this.options.fields.message,
				timestamp: this.options.fields.timestamp
			}
		}

		const connectionConfig = {
			server: options.server,
			user: options.user,
			password: options.password,
			database: options.database
		};

		this.console = options.console || false;

		this.pool = new mssql.ConnectionPool(connectionConfig);
		this.pool.connect((err) => {
			if (err) {
				if (this.console)	console.error('Couldn\'t connect Log SQL Server. Please check the settings.', err);
			} else {
				if (this.console) 	console.log(`Winston log SQL Server connection established.`);
			}
		});
	}

	/**
	 * function log (info, callback)
	 * {level, msg, [meta]} = info
	 * @level {string} Winston standard Level at which to log the message.
	 * @msg {string} Message to log
	 * @meta {Object} **Optional** Additional metadata to attach
	 * @callback {function} Continuation to respond to when complete.
	 * Core logging method exposed to Winston. Metadata is optional.
	 */

	log(info, callback) {
		const { level, message, ...winstonMeta } = info;

		process.nextTick(() => {
			if (!callback) {
				callback = () => { };
			}

			var req = new mssql.Request(this.pool);

			const log = {};
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

			var qry = 'INSERT INTO {table} ({columns}) VALUES ({values});';
			qry = format(qry, {
				table: params.table,
				columns: params.columns,
				values: params.values
			});

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

				callback(null, true);
			});
		});
	}
};
