const express = require('express');
const app = express();
const env = require('dotenv').config();
const path = require("path");
var bodyParser = require('body-parser');
const error = require('./app/middleware/error');

const winston = require('winston'), createLogger = winston.createLogger, format = winston.format, transports = winston.transports;
var combine = format.combine, timestamp = format.timestamp, label = format.label, printf = format.printf;
require('./app/shared/passport');
const passport = require('passport');
const cors = require('cors');
const cookieParser = require("cookie-parser");
const sessions = require('express-session');
const http = require("http");

var myFormat = printf(function (_a) {
  var level = _a.level, message = _a.message, label = _a.label, timestamp = _a.timestamp;
  return timestamp + " [" + label + "] " + level + ": " + message;
});
const logger = winston.createLogger({
  level: 'info',
  format: combine(label({ label: "api" }), timestamp(), myFormat),
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

app.use(cors());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions

// creating 24 hours from milliseconds
//const oneDay = 1000 * 60 * 60 * 24;

//session middleware
// app.use(sessions({
//     secret: "thisismysecrctekeyfhrgfgrfrty84fwir767",
//     saveUninitialized:true,
//     cookie: { maxAge: oneDay },
//     resave: false
// }));

require('./app/shared/logging');
app.set('view engine', 'ejs')
//app.use(error);

app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  res.status(err.statusCode).json({
    status: err.status,
    message: err.message
  });

});

//Route Mappings

const authRouter = require('./app/routes/authenticate');
const adminRouter = require('./app/routes/admin')(passport);

app.use('/app',adminRouter);
app.use('/auth', authRouter);

// passport.serializeUser(function (user, done) {
//   if (user.role == "user") {
//     done(null, user.id);
//   } else {
//     done(null, user.user_id);
//   }
// });

// passport.deserializeUser(function (id, done) {
//   return executeQuery("select * from user where user_id = ?", [id], function (err, rows) {
//     return done(err, rows[0]);
//   });
// });

process.on('uncaughtException', (ex) => {
  logger.error(ex)
  console.log(ex)
});
process.on('unhandledRejection', (ex) => {
  logger.error(ex)
  console.log(ex)
});

// const requestListener = function (req, res, next) {
//   //res.end("Your IP Addresss is: " + req.socket.localAddress);
//   console.log("Your IP Addresss is: " + req.socket.localAddress);
//   return true
// };

//const server = http.createServer(requestListener);

const port = process.env.PORT || 3020;
app.listen(port, () => winston.info(`Listening on port ${port}...`));
// server.listen(port, () => {
//   console.log(`Server is running on port ${port}`);
// });
