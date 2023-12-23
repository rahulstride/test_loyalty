const fetch = require('node-fetch');
const { executeQuerySelect} = require('../shared/shared-db');
const { createLogger, format, transports } = require("winston");
const { combine, timestamp, label, printf } = format;
const STRIDE_SMS_TOKEN = process.env.STRIDE_SMS_TOKEN

const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

const logger = createLogger({
  format: combine(label({ label: "SMS Service" }), timestamp(), myFormat),
  transports: [
    //
    // - Write all logs with level `error` and below to `error.log`
    // - Write all logs with level `info` and below to `combined.log`
    //
    new transports.File({ filename: "sms_error.log", level: "error" }),
    new transports.File({ filename: "sms.log" }),
  ],
});

function triggerSMS(phone, message) {

  console.log(`| Response : ${message} : ${phone}`);
  // logger.log("info", `| Response : ${message} : ${phone}`);

  var url = "https://bankfab.marshal-me.com/smsapi/sms/send"

  let payload = {
    "phone": phone,
    "text": message
  }
  fetch(url, {
    method: 'post',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + STRIDE_SMS_TOKEN
    },
  })
    .then(res => res.json())
    .then(json => {
      console.log(`Response : ${json.data} : ${phone}`);
    }).catch(error => {
      console.log(`triggerSMS Error : ${error}`);
    });
}

function sendSMS(phone, sms_data) {

  executeQuerySelect('SELECT sms_text from sms_configuration where `sms_type` = ? and system_name = ? and status = 0 and deleted = 0', [sms_data.sms_type, sms_data.system_name], function (err, result) {

      if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

      if (result.length > 0) {
          let sms_text = result[0].sms_text;
          sms_text = sms_text.replace("{{transaction_id}}", sms_data.transaction_id);
          sms_text = sms_text.replace("{{updated_points_balance}}", sms_data.updated_points_balance);
          
          sms_text = sms_text.replace("{{pointsEarned}}", sms_data.pointsEarned);
          sms_text = sms_text.replace("{{points_to_redeem}}", sms_data.points_to_redeem);

          sms_text = sms_text.replace("{{cashback_value}}", sms_data.cashback_value);
          sms_text = sms_text.replace("{{cashback_to_redeem}}", sms_data.cashback_to_redeem);
          sms_text = sms_text.replace("{{updated_cashback_balance}}", sms_data.updated_cashback_balance);

          sms_text = sms_text.replace("{{discount}}", sms_data.discount);
          sms_text = sms_text.replace("{{total}}", sms_data.total);

          console.log(sms_text)
          triggerSMS(phone, sms_text);
       
      }
  })
}

exports.triggerSMS = triggerSMS;
exports.sendSMS = sendSMS;