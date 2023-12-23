const mysql = require('mysql');
// var path = require("path");
// var env = process.env.NODE_ENV || "production";
//var config = require(path.join(__dirname, "..", "config", "config.json"))[env];

function createCustPool(MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DB) {

    let poolVariables = {
        supportBigNumbers: true,
        bigNumberStrings: true,
        connectionLimit: 50,
        connectTimeout: 60 * 60 * 1000,
        acquireTimeout: 60 * 60 * 1000,
        waitForConnections: true,
        port: MYSQL_PORT,
        host: MYSQL_HOST,
        user: MYSQL_USER,
        password: MYSQL_PASSWORD,
        database: MYSQL_DB
    }

    let pool = mysql.createPool(poolVariables);

    // pool.getConnection(function (err, connection) {
    //     let callback = null
    //     let results = null
    //     if (err) {
    //         console.log(err);
    //         if (callback) return callback(err, results);
    //         return;
    //     }
    //     let query = connection.query('SELECT 1 + 1 AS solution', function (err, results) {
    //         if (err) {
    //             console.log(err);
                
    //         }            
    //     });
    // });

    return pool;

}

function executeQuerySelectDynamic(pool, sql, params = [], callback = null) {

    pool.getConnection(function (err, connection) {
        if (err) {
            console.log(err);
            let results = null
            if (callback) return callback(err, results);
            return;
        }
        let query = connection.query(sql, params, function (err, results) {
            //connection.release();
            if (err) {
                console.log(err);
                if (callback) return callback(err, results);
                return;
            }

            return callback(err, results);
        });
        console.log(query.sql);
        connection.release();
    });
};

function executeQueryInsertDynamic(pool, sql, params = [], callback = null) {
    pool.getConnection(function (err, connection) {
        if (err) {
            console.log(err);
            let results = null
            if (callback) return callback(err, results);
            return;
        }
        let query = connection.query(sql, [params], function (err, results) {
            connection.release();
            if (err) {
                console.log(err);
                if (callback) return callback(err, results);
                return;
            }
            console.log(query.sql);
            return callback(err, results);
        });
    });
};

function executeQueryUpdateDynamic(pool,sql, params, callback = null) {

    pool.getConnection(function (err, connection) {
        if (err) {
            console.log(err);
            let results = null
            if (callback) return callback(err, results);
            return;
        }
        let query = connection.query(sql, params, function (err, results) {
            connection.release();
            if (err) {
                console.log(err);
                if (callback) return callback(err, results);
                return;
            }
            console.log(query.sql);
            return callback(err, results);
        });
    });
};

exports.executeQuerySelectDynamic = executeQuerySelectDynamic;
exports.executeQueryInsertDynamic = executeQueryInsertDynamic;
exports.executeQueryUpdateDynamic = executeQueryUpdateDynamic;
exports.createCustPool = createCustPool;
