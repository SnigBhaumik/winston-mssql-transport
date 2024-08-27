# winston-mssql-transport

A slick, simple and practical MS SQL Server transport for Winston Logger.


# Objective

Winston (https://www.npmjs.com/package/winston) is one of the most popular library around there. It offers some commonly used destinations (transports) such as File, HTTP etc.

And, of course, many of us want the logs to be transported in a database like MySQL, MS-SQL, Oracle and so on.

While there are some packages available for Winston MySQL transport (for example, https://github.com/charles-zh/winston-mysql), no reliable and supported package found for MS SQL Server. One such package `winston-sql-transport` (https://www.npmjs.com/package/winston-sql-transport) unfortunately is deprecated.

Thus the need of a simple and supported plug-in for Winston MS SQL Server transport.


# Supports

 * Winston 3.x
 * MS SQL 2018 onwards


# Installation

    // CommonJS

    npm i winston --save
    npm i winston-mssql-transport --save


# Usage

    const winston = require('winston');
    const format = require('winston').format;
    const wstnMsSql = require('winston-mssql-transport');

    const options = {
        user: 'my-db-user-name',
        password: 'my-db-password',
        server: 'my-db-server',
        database: 'my-db-name',	
        table: 'my-table-name',
    };

    const sqlTransport = new wstnMsSql(options);
    const sqlLogger = winston.createLogger({
	    transports: [ sqlTransport ],
	    format: format.combine(
		    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
		    format.errors({ stack: true }),
		    format.json()
	    ),
	    level: 'silly'
    });

    sqlLogger.debug('my message', { data: 'my-meta-data' });


# Advanced Options
You can configure the SQL Server connection pool settings.

    const options = {
        ...
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        }
    };

In case you want logging status in console.

    const options = {
        ...
        console: true   // default false
    }


# Querying Logs

_Coming soon._


# License

[MIT License](http://en.wikipedia.org/wiki/MIT_License).

