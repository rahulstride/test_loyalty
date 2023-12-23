// const { createLogger, format, transports } = require("winston");
// const { combine, timestamp, label, printf } = format;
// const fetch = require('node-fetch');
// const sgMail = require("@sendgrid/mail");
// sgMail.setApiKey(process.env.SENDGRID_API_KEY);


// // # Create a campaign\
// // # ------------------
// // # Include the Sendinblue library\
// var SibApiV3Sdk = require("sib-api-v3-sdk");
// var defaultClient = SibApiV3Sdk.ApiClient.instance;
// //# Instantiate the client\
// var apiKey = defaultClient.authentications["api-key"];
// apiKey.apiKey = process.env.SENDINBLUE_API_KEY;
// let EMAIL_API_KEY = process.env.SENDINBLUE_API_KEY

// // var apiInstance = new SibApiV3Sdk.EmailCampaignsApi();
// // var emailCampaigns = new SibApiV3Sdk.CreateEmailCampaign();
// // //# Define the campaign settings\
// // emailCampaigns.name = "Campaign sent via the API";
// // emailCampaigns.subject = "My subject";
// // emailCampaigns.sender = {"name": "From name", "email":"nameersartajkhan@gmail.com"};
// // emailCampaigns.type = "classic";
// // //# Content that will be sent\
// // htmlContent: "Congratulations! You successfully sent this example campaign via the Sendinblue API.",
// // //# Select the recipients\
// // //recipients: {listIds: [2, 7]},
// // //# Schedule the sending in one hour\
// // //scheduledAt: "2018-01-01 00:00:01"//}
// // //# Make the call to the client\
// // apiInstance.createEmailCampaign(emailCampaigns).then(function(data) {
// // console.log("API called successfully. Returned data: " + data);
// // }, function(error) {
// // console.error(error);
// // });


// const from = "digital@marshal.ae";

// // APP INIT : Logging

// const myFormat = printf(({ level, message, label, timestamp }) => {
//     return `${timestamp} [${label}] ${level}: ${message}`;
// });

// const logger = createLogger({
//     format: combine(label({ label: "Email Service" }), timestamp(), myFormat),
//     transports: [
//         //
//         // - Write all logs with level `error` and below to `error.log`
//         // - Write all logs with level `info` and below to `combined.log`
//         //
//         new transports.File({ filename: "email_error.log", level: "error" }),
//         new transports.File({ filename: "email.log" }),
//     ],
// });

// function triggerEmail(email_type, dest, subject, bodyData) {

//     let text = ""
//     let bodyHtml
   
//     if (email_type == "FORGOT_PASSWORD") {
//         let text = `<p style="font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; Margin-bottom: 15px;">Your Password Reset Link : ${bodyData.baseUrl}</p>`
//         bodyHtml = getEmailHTML(text);
//     }

//     dest = "rahul@acmeconnect.com";

//     const msg = {
//         to: dest,
//         from: from,
//         subject: subject,
//         text: "message",
//         html: bodyHtml,
//     };
//     sgMail.send(msg).then(
//         (res) => { logger.log("info", `${res} : ${dest}`); },
//         (error) => {
//             if (error.response) {
//                 logger.log("error", `ERROR : ${error.response.body} : ${dest}`);
//                 console.log(error);
//             }
//         }
//     );
// }

// function getEmailHTML(text) {

//     var html = '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tbody><tr><td width="100%"><div style="max-width:600px;Margin:0 auto"><table align="center" cellpadding="0" cellspacing="0" style="border-spacing:0;font-family:gt-eesti,ArialMT,Helvetica,Arial,sans-serif;Margin:0 auto;padding:24px;width:100%;max-width:500px" ><tbody><tr><td><table style="margin-bottom:40px;width:100%" width="100%"><tbody><tr><td> <a href="//" style="font-family:Helvetica,Arial,sans-serif;color://0086bf" target="_blank" > <img src="https://filsstorage.blob.core.windows.net/filsmedia/fils-logo" style="display:block" alt="Fils Care Logo" width="81" height="61" /> </a></td></tr></tbody></table></td></tr><tr><td style="text-align:justify;word-break:break-word"><table style="margin-bottom:20px;width:100%" width="100%"><tbody><tr><td><table style="width:100%;margin-bottom:20px" width="100%" cellpadding="0" cellspacing="0" ><tbody><tr><td> <span style="font-family:Helvetica,Arial,sans-serif;color://234567">Dear User,</span><p style="font-size:18px;line-height:30px;color://054752;word-break:normal" >  </?></td></tr></tbody></table></td></tr><tr><td><center><table style="background-color://fff;margin-bottom:20px;width: 100%;table-layout:fixed" align="center" width="" cellspacing="0" cellpadding="0" >' + text + '</table></center></td></tr></tbody></table></td></tr>';

//     var footer = '<tr><td></td></tr>  <tr><td>    <table width="100%" style="margin-bottom:20px;width:100%"><tbody><tr><td width="100%"><div style="width:100%;height:1px;background-color://ddd" color="//DDD" width="100%" ></div></td></tr></tbody></table></td></tr><tr><td style="text-align:center"> <img src="https://filsstorage.blob.core.windows.net/filsmedia/fils-logo" alt="FILS CARE LOGO" style="display:block;width:29px;height:auto;margin-left:auto;margin-right:auto;margin-bottom:10px" height="auto" /></td></tr><tr><td style="text-align:center;font-size:13px"> <a href="https://filscare.com/" style="color://00aff5" target="_blank" > FilsCare </a> <span style="color://00aff5">|</span> <a href="https://filscare.com/faq" style="color://00aff5" target="_blank" > FAQ </a></td></tr><tr><td style="text-align:center"><table style="max-width:100%;width:100%;text-align:center;font-family:ArialMT,Arial,sans-serif" cellspacing="0" cellpadding="0" ><tbody><tr><td style="text-align:center"><p style="font-size:10px;color://708c91;text-align:center;padding:0;margin-top:10px;margin-bottom:2px" > This email was sent to you by Filscare 2021</p></td></tr></tbody></table></td></tr></tbody></table></div></td></tr></tbody></table>'

//     html += footer

//     return html;

// }

// exports.triggerEmail = triggerEmail;