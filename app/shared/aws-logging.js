// var winston = require('winston'),
//     CloudWatchTransport = require('winston-aws-cloudwatch');

// var NODE_ENV = process.env.NODE_ENV || 'development';

// // const logger = winston.createLogger({
// //     transports: [
// //         new (winston.transports.Console)({
// //             timestamp: true,
// //             colorize: true,
// //         })
// //     ]
// // });

// // var config = {
// //     logGroupName: 'my-log-group',
// //     logStreamName: process.env.CLOUDWATCH_STREAM,
// //     createLogGroup: false,
// //     createLogStream: true,
// //     awsConfig: {
// //         accessKeyId: process.env.CLOUDWATCH_ACCESS_KEY_ID,
// //         secretAccessKey: process.env.CLOUDWATCH_SECRET_ACCESS_KEY
// //         //region: process.env.CLOUDWATCH_REGION
// //     },
// //     formatLog: function (item) {
// //         return item.level + ': ' + item.message + ' ' + JSON.stringify(item.meta)
// //     }
// // }

// // if (NODE_ENV != 'development') logger.add(CloudWatchTransport, config);

// // logger.level = process.env.LOG_LEVEL || "silly";

// // logger.stream = {
// //     write: function (message, encoding) {
// //         logger.info(message);
// //     }
// // };

// let awsConfig = {
//     accessKeyId: "AKIAXIQ37JNHDPKBRRWP",
//     secretAccessKey: "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",
//     region: 'us-east-2'
//     //region: process.env.CLOUDWATCH_REGION
// }

// const loggerVariables = {
//     transports: [
//         new (winston.transports.Console)({
//             timestamp: true,
//             colorize: true,
//         })
//     ],

// }

// var config = {
//     logGroupName: 'modularApp',
//     //logStreamName: process.env.CLOUDWATCH_STREAM,
//     logStreamName: 'stream1',
//     createLogGroup: true,
//     createLogStream: true,
//     submissionInterval: 2000,
//     submissionRetryCount: 1,
//     batchSize: 20,
//     awsConfig: awsConfig,
//     formatLog: item =>
//         `${item.level}: ${item.message} ${JSON.stringify(item.meta)}`
//   }

// if (NODE_ENV != 'development') logger.add(CloudWatchTransport, config);

// const logger = winston.createLogger(loggerVariables)

// logger.level = process.env.LOG_LEVEL || "silly";

// console.log(process.env.LOG_LEVEL)

// logger.stream = {
//     write: function (message, encoding) {
//         logger.info(message);
//         console.log(message);
//     }
// };

// module.exports = logger;
//.................

// const winston = require('winston')
// const CloudWatchTransport = require('winston-aws-cloudwatch')

// let dateValue = new Date();

// function log() {
//     console.log("Log to AWS")
// }

// const logger = winston.createLogger({
//     transports: [
//         new CloudWatchTransport({
//             logGroupName: 'modularApp',
//             logStreamName: dateValue.getDate() + '/' + (dateValue.getMonth() + 1) + '/' + dateValue.getFullYear() + '-' + dateValue.getHours() + '-' + dateValue.getMinutes()+'-' + dateValue.getSeconds(),
//             createLogGroup: true,
//             createLogStream: true,
//             submissionInterval: 20,
//             submissionRetryCount: 10,
//             batchSize: 20,
//             awsConfig: {
//                 accessKeyId: process.env.CLOUDWATCH_ACCESS_KEY_ID,
//                 secretAccessKey: process.env.CLOUDWATCH_SECRET_ACCESS_KEY,
//                 region: process.env.CLOUDWATCH_REGION
//             },
//             formatLog: item =>
//                 `${item.level}: ${item.message} ${JSON.stringify(item.meta)}`
//         })
//     ]
// })
// logger.on('error', function (err) { console.log(err) });

// //module.exports = logger;
// exports.log = log;