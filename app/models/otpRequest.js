
const crypto = require('crypto')
const { executeQuerySelect,executeQueryUpdate} = require('../shared/shared-db');

function generateOTP() {
  const digits = '0123456789'
  const otpLength = 6
  let otp = ''
  let index = 0
  for (let i = 1; i <= otpLength; i++) {
    index = Math.floor(Math.random() * digits.length)
    otp = otp + digits[index]
  }
  return 123456;
  //return otp
}

function generateRef() {
  return crypto.randomBytes(20).toString('hex');
}

function verifyOTP(ref_id, otp, user_id) {

  return new Promise((resolve, reject) => {
    //and created_by = ?
    executeQuerySelect('SELECT id,time_to_sec(TIMEDIFF(NOW(), created_at)) as seconds FROM otp_requests where ref_id = ? and otp = ? and status = 0 and user_id = ?', [ref_id, otp, user_id], function (err, result) {

      if (err) resolve(false);

      if (result.length > 0) {

        //Mark OTP as Verified
        executeQueryUpdate('UPDATE `otp_requests` SET status = 1 where `ref_id`=? ',[ref_id],function (err, result) {
          if (err) return res.status(500).send({ status: false, data: err, message: "failed" });
          })

        resolve(result[0])
      }
      else {
        resolve(false)
      }
    });
  })
}

exports.generateOTP = generateOTP;
exports.generateRef = generateRef;
exports.verifyOTP = verifyOTP;


