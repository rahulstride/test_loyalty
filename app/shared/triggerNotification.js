
var request_module = require('request')
// var sgMail = require("@sendgrid/mail");
// sgMail.setApiKey(process.env.SG_SECRET);
//var from = "rahul@acmeconnect.com";
// APP INIT : Logging

var rm_username = process.env.RM_USERNAME
var rm_password = process.env.RM_PASSWORD

var SMS_GATEWAY_USERNAME = process.env.SMS_GATEWAY_USERNAME
var SMS_GATEWAY_PASSWORD = process.env.SMS_GATEWAY_PASSWORD

var route_host = "http://sms.rmlconnect.net/bulksms/bulksms?username=" + rm_username + "&password=" + rm_password + "&type=0&dlr=1"

// function triggerEmail(dest, subject, message, bodyHtml) {
//     if (bodyHtml === void 0) { bodyHtml = ""; }
//     if (bodyHtml.length > 0) {
//         var msg = {
//             to: dest,
//             from: from,
//             subject: subject,
//             text: message,
//             html: bodyHtml
//         };
//         sgMail.send(msg).then(function () { }, function (error) {
//             if (error.response) {
//                 console.log("error", "ERROR : " + error.response.body + " : " + dest);
//             }
//         });
//     }
//     else {
//         var msg = {
//             to: dest,
//             from: from,
//             subject: subject,
//             text: message
//         };
//         sgMail.send(msg).then(function () { }, function (error) {
//             if (error.response) {
//                 console.log(error)
//                 console.log("error", "ERROR : " + error.response.body + " : " + dest);
//             }
//         });
//     }
// }
// function triggerMessage(phone, message) {

//     return request_module({
//         uri: host,
//         method: "POST",
//         form: {
//             username: username,
//             password: password,
//             api_key: apiKey,
//             FROM: fromSms,
//             to: phone,
//             text: message
//         }
//     }, function (error, response, content) {
//         if (error) {
//             console.log("error", "SMS ERROR : " + error + " : " + phone);
//         }
//         else {
//             console.log("info", "| Response : " + content + " : " + phone);
//             return content;
//         }
//     });
// }
//exports.triggerEmail = triggerEmail;


//RML SMS API
// function triggerMessage(phone, message) {

//     var route_host =
//         'http://sms.rmlconnect.net/bulksms/bulksms?username=' +
//         rm_username +
//         '&password=' +
//         rm_password +
//         '&type=0&dlr=1'

//     let sms_params = '&destination=' + phone + '&source=eeasy&message=' + message
//     route_host += sms_params

//     return request_module({
//         uri: route_host,
//         method: "GET",
//     }, function (error, response, content) {
//         if (error) {
//             console.log("error", "SMS ERROR : " + error + " : " + phone);
//         }
//         else {
//             console.log("info", "| Response : " + content + " : " + phone);
//             return content;
//         }
//     });
// }
//RML SMS API

//RML SMS API

//BATEL SMS API

function triggerMessage(phone, message) {

    var route_host =
        'https://www.batelcosms.com.bh/bms/Soap/Messenger.asmx/HTTP_SendSms?customerID=4568&userName='+SMS_GATEWAY_USERNAME+'&userPassword='+SMS_GATEWAY_PASSWORD+'&originator=CrediMax&smsText='+message+'&recipientPhone=' + phone + '&messageType=Latin&defDate=20220106093120&blink=false&flash=false&Private=false' 

    return request_module({
        uri: route_host,
        method: "GET",
    }, function (error, response, content) {
        if (error) {
            console.log("error", "SMS ERROR : " + error + " : " + phone);
        }
        else {
            console.log("info", "| Response : " + content + " : " + phone);
            return content;
        }
    });
}
//BATEL SMS API

exports.triggerMessage = triggerMessage;