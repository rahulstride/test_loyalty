const mysql = require('mysql2');
var path = require("path");
var env = process.env.NODE_ENV || "production";
var config = require(path.join(__dirname, "..", "config", "config.json"))[env];

const pool = mysql.createPool({
  supportBigNumbers: true,
  bigNumberStrings: true,
  connectionLimit: 50,
  connectTimeout: 60 * 60 * 1000,  
  waitForConnections: true,
  port: process.env.MYSQL_PORT,
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB,
  charset: "utf8mb4"
});

function executeQuerySelect(sql, params = [], callback = null) {

  pool.getConnection(function (err, connection) {
    if (err) {
      console.log(err);
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

function executeQueryInsert(sql, params = [], callback = null) {
  pool.getConnection(function (err, connection) {
    if (err) {
      console.log(err);
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

function executeQueryUpdate(sql, params, callback = null) {
  pool.getConnection(function (err, connection) {
    if (err) {
      console.log(err);
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
exports.executeQuerySelect = executeQuerySelect;
exports.executeQueryInsert = executeQueryInsert;
exports.executeQueryUpdate = executeQueryUpdate;