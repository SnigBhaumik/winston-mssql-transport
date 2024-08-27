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

# Setup

Before using the transport, the target database and table must be created.

Assuming your log table name is `winston_logs`, here is the DDL statement.

    SET ANSI_NULLS ON
    GO

    SET QUOTED_IDENTIFIER ON
    GO

    CREATE TABLE [dbo].[winston_logs](
        [id] [bigint] IDENTITY(1,1) NOT NULL,
        [level] [nvarchar](16) NOT NULL,
        [message] [nvarchar](max) NOT NULL,
        [meta] [nvarchar](max) NOT NULL,
        [timestamp] [datetime] NOT NULL,
    CONSTRAINT [PK_winston_logs] PRIMARY KEY CLUSTERED 
    (
        [id] ASC
    )WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
    ) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
    GO

    ALTER TABLE [dbo].[winston_logs] ADD  CONSTRAINT [DF_winston_logs_timestamp]  DEFAULT (getdate()) FOR [timestamp]
    GO


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

You can query the stored logs as standard winston query format. `options` is optional, default values as mentioned below would be used. This will return SQL server recordset.

    const options = {
        limit: 10,              // optional, default 100
        order: 'ASC',           // optional, default DESC
        from: '2024-04-04',     // optional
        until: '2024-06-04',    // optional
        fields: [ 'message', 'meta' ]   // optional, default both `message` and `meta`
    };

    logger.query(options, (err, recs) => {
        console.error(err);
        console.log(recs);
    });  


# License

[MIT License](http://en.wikipedia.org/wiki/MIT_License).

