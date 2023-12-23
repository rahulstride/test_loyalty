const express = require('express');
const passport = require('passport');
const bcrypt = require('bcrypt');
const user = require('../models/user');
const otpRequest = require('../models/otpRequest');
const jwt = require('jsonwebtoken')
const router = express.Router();
const path = require('path');
const multer = require('multer');
var upload = multer()
const Joi = require('joi')
var crypto = require('crypto')
const { executeQueryInsert, executeQuerySelect, executeQueryUpdate } = require('../shared/shared-db');
const Jimp = require('jimp');
const Fstream = require('stream');
var MulterAzureStorage = require('multer-azure-storage');
const { triggerSMS } = require('../shared/triggerSMS');
var logger = require('../shared/aws-logging');
const { triggerEmail } = require('../shared/triggerEmail');
const rateLimit = require('express-rate-limit');
const { activityLog } = require('../shared/activity_log');

const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 Min Widow
    max: 5, // start blocking after 5 reqs
    statusCode: 400,
    message: {
        status: false,
        data: "Maximum Login attempts reached.Please try again in 5 mins",
        message: 'failed'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

// Apply the rate limiting middleware to all requests
//app.use(limiter)
//When the user sends a post request to this route, passport authenticates the user based on the
//middleware created previously

router.post('/login',function (req, res, next) {

    console.log('loginBody',req.body);

    passport.authenticate('local', { session: false }, function (err, result, info) {

        if (err) return next(err);

        if (!result) {
            // logger.log('info', `[LOGIN_FAILED] `, { tags: 'login', request: req.body });
            //activityLog(`info`, `login`, `Invalid Login ${req.body.email}`, req.method, JSON.stringify(req.body), JSON.stringify(req.query), "", "req.user.user_id");
            return res.send({ status: false, data: info.message, message: info.message })
        }

        const payload = {
            email: result.email,
            name: result.name,
            user_id: result.user_id,
            role: result.role,
            serial_number: req.body.serial_number
        }

        const userInfo = {
            email: result.email,
            name: result.name
        }

        const token = jwt.sign(payload, process.env['JWT_SECRET']);

        return res.send({ status: true, data: token, userInfo: userInfo, message: 'success' })  


    })(req, res, next)
})

router.post("/verifyOTP", upload.none(), function (req, res, next) {
    const schema = Joi.object({
        otp: Joi.number().required(),
        ref_id: Joi.string().required()
    });
    const { error } = schema.validate(req.body);
    if (error) return res.status(400).send({ status: false, data: error.details[0].message, message: "failed" })

    executeQuerySelect('select *,time_to_sec(TIMEDIFF(NOW(), updated_at)) as seconds,(DATEDIFF(NOW(), password_expiry)) as days_remaining from user where `ref_id`=? and otp_verified = 0', [req.body.ref_id],
        function (err, result) {
            if (result.length != 0) {
                if (result[0].seconds < 600) {  //OTP Validity of 5 minute

                    if (result[0].otp == req.body.otp) {

                        data = { otp_verified: 1 };

                        executeQueryUpdate('UPDATE `user` SET ? where `ref_id` = ?',
                            [data, req.body.ref_id],
                            function (err, result1) {
                                if (err) return res.status(500).send({ status: false, data: err, message: "failed" });

                                const payload = {
                                    email: result[0].email,
                                    user_id: result[0].user_id,
                                    role: result[0].role
                                }

                                const userInfo = {
                                    email: result[0].email,
                                    name: result[0].name,
                                }
                                const token = jwt.sign(payload, process.env['JWT_SECRET']);

                                executeQuerySelect('SELECT group_concat(user_group_users.user_group_id) as user_group_ids FROM user join user_profile on user_profile.user_id = user.user_id left join user_group_users on user_group_users.user_id = user.user_id left join user_groups on user_groups.id = user_group_users.user_group_id where user.deleted = 0 and user.user_id = ?', [result[0].user_id],
                                    function (err, result) {
                                        if (result.length != 0) {
                                            userInfo.user_group_id = result[0]['user_group_ids']
                                        }

                                        logger.log('info', `[VERIFY_LOGIN_SUCCESS]`, { tags: 'login', email: req.body.email });
                                        activityLog(`info`, `verifyOTP`, `${result[0].email} otp verified`, req.method, JSON.stringify(req.body), JSON.stringify(req.query), result[0].role, result[0].user_id);

                                        return res.send({ status: true, data: token, userInfo: userInfo, message: 'success' })
                                    })

                                // const token = jwt.sign(payload, process.env.JWT_SECRET);
                                // return res.send({ status: true, data: token, role: result[0].role, user_status: result[0].status, profile_status: result[0].profile_status, message: 'success' })
                            });
                    } else {
                        res.statusMessage = "Invalid OTP"
                        return res.status(400).send({
                            status: false,
                            data: "Invalid Input",
                            message: "failed"
                        });
                    }

                    // if ((result[0].days_remaining >= 0) && (result[0].days_remaining <= 60)) {

                    // }
                    // else {
                    //     return res.status(200).send({
                    //         status: false,
                    //         data: "PasswordExpired",
                    //         message: "failed"
                    //     });
                    // }
                }
                else {
                    res.statusMessage = "OTP Expired"
                    return res.status(400).send({
                        status: false,
                        data: "OTP Expired",
                        message: "failed"
                    });
                }
            } else {
                res.statusMessage = "Invalid Input"
                return res.status(400).send({
                    status: false,
                    data: "Invalid Input",
                    message: "failed"
                });
            }


        });
});

router.post("/forgotPassword", upload.none(), function (req, res) {

    const { error } = Joi.object({
        email: Joi.string().email().required()
    }).validate(req.body);

    if (error) return res.status(400).send({ status: false, data: error.details[0].message, message: "failed" })

    const email = req.body.email

    user.User.findOne(email, function (err, response) {

        if (err) res.status(400).send({ status: false, data: err, message: "failed" })

        if (response.length == 0) // if email doesnt exists
        {
            activityLog(`error`, `forgotPassword`, `Email not found for ${req.body.email}`, req.method, JSON.stringify(req.body), JSON.stringify(req.query), response[0].role, response[0].user_id);
            return res.status(200).send({ status: false, data: "Invalid Email", message: "failed" })

        } else {

            const saltround = 10;
            let user_id = response[0].user_id

            crypto.randomBytes(20, function (err, buf) {

                var ref_id = buf.toString('hex');

                let bodyData = {}
                let baseUrl = process.env.HOST;
                // if (role == 1)
                //     baseUrl = process.env.HOST;
                // else
                //     return res.status(200).send({ status: false, data: "Invalid Input", message: "Email not found" })

                bodyData.ref_id = ref_id
                bodyData.user_id = user_id
                bodyData.baseUrl = `${baseUrl}/account/forgot-password/${ref_id}`

                triggerEmail("FORGOT_PASSWORD", email, `Forgot Password ?`, bodyData);

                executeQueryInsert('INSERT INTO `password_reset`(`ref_id`,`user_id`,`expiry`) VALUES ? ',
                    [
                        [
                            ref_id,
                            user_id,
                            Date.now() + 3600000
                        ]
                    ],
                    function (err, result) {
                        if (err) return res.status(500).send({ status: false, data: err, message: "failed" });

                        logger.log('info', `[forgot-password]`, { tags: 'forgot-password', request: req.body, method: req.method });
                        activityLog(`info`, `forgotPassword`, `${req.body.email} requested forgot password`, req.method, JSON.stringify(req.body), JSON.stringify(req.query), response[0].role, response[0].user_id);

                        return res.status(200).send({
                            status: true,
                            data: `${baseUrl}/account/forgot-password/${ref_id}`,
                            message: "success"
                        });
                    });
            });
            // bcrypter.hash(token, saltround, function (err, hashedToken) {
            // })          
        }
    })
})

router.post("/resetPassword", upload.none(), function (req, res) {

    const { error } = Joi.object({
        ref_id: Joi.string().required(),
        password: Joi.string().min(10).max(15).regex(/^(?=(.*[a-zA-Z]){1,})(?=(.*[!@#$%^&*()_+|~=\`<{[\]}:\-;’>?,./\"]){1,})(?=(.*[0-9]){1,}).{10,}$/).message("Invalid Password"),
        confirm_password: Joi.string().required()
    }).validate(req.body);

    if (error) return res.status(400).send({ status: false, data: error.details[0].message, message: "failed" })

    let password = req.body.password;
    let confirm_password = req.body.confirm_password;
    const saltround = 10;

    if (password != confirm_password)
        return res.send({
            status: false,
            data: "Password do not match",
            message: "failed"
        });

    executeQuerySelect('SELECT * FROM password_reset where ref_id = ? and status = 0', [req.body.ref_id], async function (err, result) {
        if (err) res.status(500).send({ status: false, data: err, message: "Some Error Occured" });
        if (result.length > 0) {

            let user_id = result[0]['user_id'];

            let passwordExist = await checkLastPasswords(password, user_id)

            if (passwordExist) {
                return res.status(400).send({
                    response: false,
                    data: 'Password cannot be from the last 13 passwords',
                    failed: 'failed'
                })
            }

            bcrypt.hash(password, saltround, function (err, passwordResult) {

                var today = new Date();
                today.setDate(today.getDate() + 60);

                let data = { password: passwordResult, reset_password: 0, password_expiry: today };

                executeQueryUpdate('UPDATE `user` SET ? where `user_id`=? ',
                    [data, user_id],
                    function (err, result) {
                        if (err) return res.status(500).send({ status: false, data: err, message: "failed" });

                        let data = { status: 0 };// Mark as done
                        executeQueryUpdate('UPDATE `password_reset` SET ? where `ref_id`=? ',
                            [data, req.body.ref_id],
                            function (err, result) {
                                if (err) return res.status(500).send({ status: false, data: err, message: "failed" });

                                user.User.savePasswordHistory(passwordResult, user_id, function (er, resp) { })

                                activityLog(`info`, `resetPassword`, `${req.body.email} reset password successfully`, req.method, JSON.stringify(req.body), JSON.stringify(req.query), "", user_id);

                                return res.send({
                                    status: true,
                                    message: "success"
                                });
                            });
                    });
            });

        } else {
            return res.send({
                status: false,
                data: "invalid input",
                message: "failed"
            });
        }
    })
})

function generateOTP() {
    const digits = '0123456789'

    const otpLength = 6

    let otp = ''
    let index = 0

    for (let i = 1; i <= otpLength; i++) {
        index = Math.floor(Math.random() * digits.length)

        otp = otp + digits[index]
    }

    return otp
}

function checkLastPasswords(password, user_id) {

    return new Promise((resolve, reject) => {

        executeQuerySelect('SELECT password_hash FROM `user_passwords` WHERE `user_id` = ? order by id desc limit 0,13', [user_id], async function (err, result) {

            if (err) resolve(false);
            let passwordExists = false

            if (result.length > 0) {

                const checkAll = async () => {
                    await asyncForEach(result, async (element) => {

                        const match = await bcrypt.compare(
                            password,
                            element['password_hash']
                        )
                        if (match) {
                            passwordExists = true
                        }
                    })
                }
                checkAll().then(() => {
                    console.log(passwordExists);
                    if (passwordExists) resolve(true)
                    else resolve(false)
                })
            }
            else {
                resolve(false)
            }
        });
    })
}

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

module.exports = router;