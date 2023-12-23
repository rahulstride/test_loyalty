const { body, check, validationResult, Result } = require("express-validator");
const { executeQuerySelect, executeQueryInsert, executeQueryUpdate } = require('../shared/shared-db');
const { activityLog } = require('../shared/activity_log');
const Joi = require('joi');
const bcrypt = require('bcrypt');
const fetch = require('node-fetch');
var logger = require('../shared/aws-logging');
const otpRequest = require('../models/otpRequest');
const { triggerSMS } = require('../shared/triggerSMS');
const { encrypt, decrypt } = require('../shared/crypto');
var nodeExcel = require('excel-export');
const user = require('../models/user');
const jwt_decode = require('jwt-decode');

const multer = require('multer');
const path = require('path');
var MulterAzureStorage = require('multer-azure-storage')
const azureStorageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const azurecontainer = new MulterAzureStorage({
    azureStorageConnectionString: azureStorageConnectionString,
    containerName: process.env.CONTAINER_NAME,
    containerSecurity: 'blob'
})
const Fstream = require('stream');
const Jimp = require('jimp');
const
    azureStorage = require('azure-storage')
    , blobService = azureStorage.createBlobService()
    , containerName = process.env.CONTAINER_NAME
    ;

exports.changePassword = (req, res) => {

    const { error } = Joi.object({
        current_password: Joi.string().required().label("Current Password"),
        new_password: Joi.string().min(8).max(15).regex(/^(?=(.*[a-zA-Z]){1,})(?=(.*[!@#$%^&*()_+|~=\`<{[\]}:\-;’>?,./\"]){1,})(?=(.*[0-9]){1,}).{10,}$/).label("Password"),
        confirm_password: Joi.string().min(8).max(15).regex(/^(?=(.*[a-zA-Z]){1,})(?=(.*[!@#$%^&*()_+|~=\`<{[\]}:\-;’>?,./\"]){1,})(?=(.*[0-9]){1,}).{10,}$/).label("Confirm Password"),
    }).validate(req.body);

    if (error) return res.status(400).send({ status: false, data: error.details[0].message, message: "failed" })

    let current_password = req.body.current_password;
    let new_password = req.body.new_password;
    let confirm_password = req.body.confirm_password;
    const saltround = 10;

    if (new_password != confirm_password)
        return res.status(400).send({
            status: false,
            data: "Password do not match",
            message: "failed"
        });

    executeQuerySelect('SELECT password FROM `user` where deleted = 0 and user_id = ?', [req.user.user_id], async function (err, result) {
        if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });
        if (result.length > 0) {

            bcrypt.compare(current_password, result[0].password, async function (err, matchResult) {

                if (!matchResult) return res.status(400).send({
                    status: false,
                    data: "Invalid Password",
                    message: "failed"
                });

                if ([2, 3].includes(req.user.role)) {

                    let passwordExist = await checkLastPasswords(new_password, req.user.user_id)

                    if (passwordExist) {
                        return res.status(400).send({
                            response: false,
                            data: 'Password cannot be from the last 13 passwords',
                            failed: 'failed'
                        })
                    }
                }

                bcrypt.hash(new_password, saltround, function (err, passwordResult) {

                    let data = { password: passwordResult };
                    executeQueryUpdate('UPDATE `user` SET ? where `user_id`=? ',
                        [data, req.user.user_id],
                        function (err, result) {
                            if (err) return res.status(500).send({ status: false, data: err, message: "failed" });

                            user.User.savePasswordHistory(passwordResult, req.user.user_id, function (er, resp) { })

                            // logger.log('info', `[changePassword] `, { tags: 'password', request: req.body, user_id: req.user.user_id, email: req.user.email, role: req.user.role, method: req.method });

                            activityLog(`info`, `changePassword`, `${req.user.email} changed password`, req.method, JSON.stringify(req.body), JSON.stringify(req.query), req.user.role, req.user.user_id);
                            return res.send({
                                status: true,
                                message: "success"
                            });
                        });
                });
            })
        } else {
            return res.send({
                status: false,
                data: "invalid input",
                message: "failed"
            });
        }
    })
}

exports.requestOTP = (req, res) => {

    const { error } = Joi.object({
        password: Joi.string().required().label("Current Password")
    }).validate(req.body);

    if (error) return res.status(400).send({ status: false, data: error.details[0].message, message: "failed" })

    executeQuerySelect('SELECT password FROM `user` where deleted = 0 and user_id = ?', [req.user.user_id], async function (err, result) {
        if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });
        if (result.length > 0) {

            bcrypt.compare(req.body.password, result[0].password, async function (err, matchResult) {

                if (matchResult) {
                    let phone = req.user.phone
                    let otp = otpRequest.generateOTP()
                    let ref_id = otpRequest.generateRef()
                    var message = "OTP to Perform Modular Event :" + otp;

                    triggerSMS(phone, message);

                    executeQueryInsert('INSERT INTO `otp_requests`( `user_id`,`ref_id`,`phone`,`otp`) VALUES ? ',
                        [[req.user.user_id, ref_id, phone, otp]],
                        function (err, result) {
                            if (err) return res.status(500).send({ status: false, data: err, message: "failed" });

                            return res.status(200).send({
                                status: true,
                                "ref_id": ref_id,
                                message: "success"
                            });
                        })
                }
                else {
                    return res.status(400).send({
                        status: false,
                        data: "Invalid Password",
                        message: "failed"
                    });
                }
            })
        } else {
            return res.status(400).send({
                status: false,
                data: "Invalid Input",
                message: "failed"
            });
        }


    })
}

exports.getStatsAdmin = (req, res) => {

    let data = {};

    executeQuerySelect('SELECT (SELECT count(locations.id) FROM locations where locations.deleted = 0) as locations_count,(SELECT count(user_id) FROM user where role = 2 and user.deleted = 0) as operator_count,(SELECT count(user_id) FROM user where role = 3 and user.deleted = 0) as vallet_user_count,(SELECT count(user_id) FROM user where role = 4 and user.deleted = 0) as validation_partner_count', [], function (err, result) {

        if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

        data.locations_count = result[0]['locations_count'];
        data.operator_count = result[0]['operator_count'];
        data.vallet_user_count = result[0]['vallet_user_count'];
        data.validation_partner_count = result[0]['validation_partner_count'];

        executeQuerySelect('SELECT (SELECT count(*) from parkings) as total_parkings_count,(SELECT COALESCE(SUM(charges),0) from parkings where status = 2) as total_collection,(SELECT count(*) from parkings where DATE(`created_at`) = CURDATE()) as todays_parking_count ,(SELECT COALESCE(SUM(charges),0) from parkings where status = 2 and DATE(`created_at`) = CURDATE() ) as todays_collection,(SELECT count(*) from parkings where validated = 1) as total_validated,(SELECT count(*) from parkings where validated = 1 and DATE(`created_at`) = CURDATE()) as todays_validated_count,(SELECT count(*) from parkings where status = 1) as total_checkin_count,(SELECT count(*) from parkings where status = 2) as total_checkout_count', [], function (err, transactionsResult) {

            if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

            data.total_parkings_count = transactionsResult[0]['total_parkings_count'];
            data.todays_parking_count = transactionsResult[0]['todays_parking_count'];
            data.total_collection = transactionsResult[0]['total_collection'];            
            data.todays_collection = transactionsResult[0]['todays_collection'];
            data.total_validated = transactionsResult[0]['total_validated'];
            data.todays_validated_count = transactionsResult[0]['todays_validated_count'];
            data.total_checkin_count = transactionsResult[0]['total_checkin_count'];
            data.total_checkout_count = transactionsResult[0]['total_checkout_count'];

            if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

            executeQuerySelect("SELECT DATE_FORMAT((DATE(NOW()) - INTERVAL `day` DAY), '%d-%m-%Y') AS `DayDate`, COALESCE(SUM(charges),0) AS `charges` FROM ( SELECT 0 AS `day`    UNION SELECT 1 UNION SELECT 2    UNION SELECT 3    UNION SELECT 4    UNION SELECT 5    UNION SELECT 6) AS `week` LEFT JOIN `parkings` ON DATE(`created_at`) = (DATE(NOW()) - INTERVAL `day` DAY) and parkings.status = 2 GROUP BY `DayDate` ORDER BY STR_TO_DATE(`DayDate`,'%d-%m-%Y') ASC", [], function (err, parkingCollectionResult) {

                if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

                data.parkingCollectionData = parkingCollectionResult;                

                executeQuerySelect("SELECT DATE_FORMAT((DATE(NOW()) - INTERVAL `day` DAY), '%d-%m-%Y') AS `DayDate`, count(parkings.id) AS `parking_count` FROM ( SELECT 0 AS `day`    UNION SELECT 1 UNION SELECT 2    UNION SELECT 3    UNION SELECT 4    UNION SELECT 5    UNION SELECT 6) AS `week` LEFT JOIN `parkings` ON DATE(`created_at`) = (DATE(NOW()) - INTERVAL `day` DAY) and parkings.status = 2 GROUP BY `DayDate` ORDER BY STR_TO_DATE(`DayDate`,'%d-%m-%Y') ASC", [], function (err, parkingCountResult) {

                    if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

                    data.parkingsCountData = parkingCountResult;

                    return res.status(200).send({ status: true, data: data, message: "success" });                 

                });
            });;
        });
    });
};

//Operators

exports.addoperators = (req, res) => {

    const upload = multer({
        storage: azurecontainer,
        fileFilter: function (_req, file, cb) {
            checkFileType(file, cb);
        }
    }).fields([{ name: 'logo_path', maxCount: 1 }]);

    function checkFileType(file, cb) {
        // Allowed ext
        const filetypes = /jpeg|jpg|png|PNG/;
        // Check ext
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        // Check mime
        const mimetype = filetypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            return res.status(422).json({
                response: false,
                message: 'Invalid file type'
            })
        }
    }

    upload(req, res, async function (imageErr) {

        const { error } = Joi.object({
            name: Joi.string().required().label("Operator Name"),
            email: Joi.string().email().required().label("Operator Email"),
            password: Joi.string().min(8).max(50).regex(/^(?=(.*[a-zA-Z]){1,})(?=(.*[!@#$%^&*()_+|~=\`<{[\]}:\-;’>?,./\"]){1,})(?=(.*[0-9]){1,}).{10,}$/).required().label("Password").messages({
                "string.min": "Must have at least 8 characters",
                "object.regex": "Must be alphanumberic with 1 Special Character",
                "string.pattern.base": "Must be minimum 8 character,alphanumberic with 1 Special Character"
            }),
            logo_path: Joi.any().label("Logo")
        }).validate(req.body);

        if (error) return res.status(400).send({ status: false, data: error.details[0].message, message: "failed" })

        //const password = "test12345!";

        // var password = generator.generate({
        //     length: 10,
        //     numbers: true
        // });
        let password = req.body.password;
        let logo_path = ""

        const saltround = 10;
        data = {};

        bcrypt.hash(password, saltround, function (err, result) {

            req.body.password = result;
            data = req.body;
            data.name = req.body.name;

            let email = data.email;

            user.User.findOne(email, function (err, response) {
                if (err) res.status(400).send({ status: false, data: err, message: "failed" })

                if (response.length == 0) // if email doesnt exists
                {
                    user.User.operatorSignup(data, function (err, response) {

                        if (response.affectedRows > 0) {

                            if (req.files.logo_path && req.files.logo_path[0].url) {

                                //Resize Logo

                                let myBlob = req.files.logo_path[0].url
                                logo_path = req.files.logo_path[0].url

                                // const widthInPixels = Number(800);

                                // Jimp.read(myBlob).then((thumbnail) => {

                                //     thumbnail.resize(widthInPixels, Jimp.AUTO);

                                //     thumbnail.getBuffer(Jimp.MIME_JPEG, (err, buffer) => {

                                //         const readStream = Fstream.PassThrough();
                                //         readStream.end(buffer);

                                //         blobService.createBlockBlobFromStream(containerName, req.file.blobName, readStream, buffer.length, (err) => {
                                //             console.log('File Resized');
                                //         });
                                //     });

                                // }).catch(console.log());

                                //Resize Logo                       
                            }

                            executeQueryInsert('INSERT INTO `operator_profile`( `user_id`,`name`,`logo_path`) VALUES ? ',
                                [
                                    [
                                        response.insertId,
                                        req.body.name,
                                        logo_path
                                    ]
                                ],
                                function (err, result) {
                                    if (err) return res.status(500).send({ status: false, data: err, message: "failed" });

                                });

                            activityLog(`info`, `addOperator`, `'${req.user.email}' added Operator ${req.body.email}`, req.method, JSON.stringify(req.body), JSON.stringify(req.query), req.user.role, req.user.user_id);

                            return res.status(200).send({
                                status: true,
                                message: "success"
                            });

                        } else {

                            activityLog(`error`, `addOperator`, `Unable to add Operator`, req.method, JSON.stringify(req.body), JSON.stringify(req.query), req.user.role, req.user.user_id);
                            return res.status(400).send({
                                status: false,
                                data: "Unable to create Operator",
                                message: "failed"
                            });
                        }
                    })
                } else {
                    res.status(200).send({ status: false, message: "Email exists" })
                }
            })
        })
    })
};

exports.updateoperators = async (req, res) => {

    const upload = multer({
        storage: azurecontainer,
        fileFilter: function (_req, file, cb) {
            checkFileType(file, cb);
        }
    }).fields([{ name: 'logo_path', maxCount: 1 }]);

    function checkFileType(file, cb) {
        // Allowed ext
        const filetypes = /jpeg|jpg|png|PNG/;
        // Check ext
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        // Check mime
        const mimetype = filetypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            return res.status(422).json({
                response: false,
                message: 'Invalid file type'
            })
        }
    }

    upload(req, res, async function (imageErr) {

        const { error } = Joi.object({
            name: Joi.string().required().label("Operator Name"),
            email: Joi.string().email().required().label("Operator Email"),
            password: Joi.string().min(8).max(50).regex(/^(?=(.*[a-zA-Z]){1,})(?=(.*[!@#$%^&*()_+|~=\`<{[\]}:\-;’>?,./\"]){1,})(?=(.*[0-9]){1,}).{10,}$/).label("Password").messages({
                "string.min": "Must have at least 8 characters",
                "object.regex": "Must be alphanumberic with 1 Special Character",
                "string.pattern.base": "Must be minimum 8 character,alphanumberic with 1 Special Character"
            }),
            logo_path: Joi.any().label("Logo"),
            user_id: Joi.number().required().label("User ID"),
        }).validate(req.body);
        if (error) return res.status(400).send({ status: false, data: error.details[0].message, message: "failed" })

        let data = {
            name: req.body.name,
        };

        let password = req.body.password;

        if (password) {
            const saltround = 10;
            bcrypt.hash(password, saltround, function (err, result) {
                data['password'] = result;
                updateUser()
            })
        } else {
            updateUser()
        }

        function updateUser() {

            executeQueryUpdate('UPDATE `user` SET ? where `user_id`= ?',

                [data, req.body.user_id], function (err, result) {

                    if (err) return res.status(500).send({ status: false, data: err, message: "failed" });

                    if (result.affectedRows > 0) {

                        let profileData =
                        {
                            name: req.body.name
                        }

                        if (req.files.logo_path && req.files.logo_path[0].url) {

                            //Resize Logo

                            let myBlob = req.files.logo_path[0].url

                            // const widthInPixels = Number(800);

                            // Jimp.read(myBlob).then((thumbnail) => {

                            //     thumbnail.resize(widthInPixels, Jimp.AUTO);

                            //     thumbnail.getBuffer(Jimp.MIME_JPEG, (err, buffer) => {

                            //         const readStream = Fstream.PassThrough();
                            //         readStream.end(buffer);

                            //         blobService.createBlockBlobFromStream(containerName, req.file.blobName, readStream, buffer.length, (err) => {
                            //             console.log('File Resized');
                            //         });
                            //     });

                            // }).catch(console.log());

                            //Resize Logo      
                            profileData.logo_path = req.files.logo_path[0].url
                        }

                        executeQueryUpdate('UPDATE `operator_profile` SET ? where `user_id`= ?',

                            [profileData, req.body.user_id], function (err, result) {

                                activityLog(`info`, `updateOperator`, `'${req.user.email}' updated user details for ${req.body.email}`, req.method, JSON.stringify(req.body), JSON.stringify(req.query), req.user.role, req.user.user_id);
                                return res.status(200).send({ status: true, message: "success" });
                            })
                    }
                    else {
                        return res.status(400).send({
                            status: false,
                            message: "invalid input"
                        });
                    }
                })
        }
    })
};

exports.getoperators = (req, res) => {

    let limit = req.query.perPage

    if (!req.query.perPage) limit = 50
    else limit = req.query.perPage

    let page = req.query.page

    if (!req.query.page) page = 1
    else page = req.query.page

    const offset = (page - 1) * limit

    let condition = ""
    let sortBy
    let sortByCond = ""
    let sortByColumnName

    if (req.query.keyword)
        condition +=
            " and ( operator_profile.name like '%" + req.query.keyword + "%'"

    if (req.query.keyword)
        condition +=
            " OR email like '%" + req.query.keyword + "%')"

    if (req.query.user_status)
        condition +=
            " and user_status = " + req.query.user_status

    if ((req.query.sortBy == "user_id")) {
        sortByColumnName = req.query.sortBy
    } else if (req.query.sortBy == "name") {
        sortByColumnName = "operator_profile.name"
    } else if (req.query.sortBy == "email") {
        sortByColumnName = "email"
    }

    if (req.user.role != 1)
        condition +=
            " and user_status = 1"

    condition += " group by user.user_id"

    if (sortByColumnName) {
        sortBy = " ORDER BY " + sortByColumnName;

        if ((req.query.order == "asc") || (req.query.order == "ASC")) {
            sortByCond += sortBy + " ASC";
        }
        else if ((req.query.order == "desc") || (req.query.order == "DESC")) {
            sortByCond += sortBy + " DESC";
        }

        condition += sortByCond
    } else {
        sortByCond = " ORDER BY operator_profile.user_id desc";
        condition += sortByCond
    }

    executeQuerySelect('SELECT user.user_id,email,user_status,operator_profile.name from user JOIN operator_profile on operator_profile.user_id = user.user_id where role = 2 and user.deleted = 0 ' + condition + '  LIMIT ' +
        limit +
        ' OFFSET ' +
        offset, function (err, result) {
            if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });
            if (result != []) {

                executeQuerySelect('SELECT user.user_id from user JOIN operator_profile on operator_profile.user_id = user.user_id where role = 2 and user.deleted = 0 ' + condition, function (err, resultCount) {
                    if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });
                    if (result != []) {
                        res.send({
                            status: true,
                            elementCount: resultCount.length,
                            data: result,
                            message: "success"
                        });
                    }
                })
            }
        });
};

exports.getoperatorsDetails = (req, res) => {

    executeQuerySelect('SELECT user.user_id,email,user_status,operator_profile.name from user JOIN operator_profile on operator_profile.user_id = user.user_id where role = 2 and user.deleted = 0 and operator_profile.user_id = ?', [req.query.user_id], function (err, result) {

        if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });
        if (result.length > 0) {
            return res.status(200).send({
                status: true,
                data: result[0],
                message: "success"
            });
        } else {
            return res.status(200).send({
                status: false,
                data: [],
                message: "failed"
            });
        }
    });

};

exports.updateUserStatus = async (req, res) => {

    await check("user_id")
        .not().isEmpty()
        .isInt()
        .run(req);

    await check("value")
        .not().isEmpty()
        .withMessage("Value Required")
        .isIn(["0", "1"]).withMessage("Invalid Value")
        .run(req);

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).json({
            response: false,
            msg: "Invalid Parameter",
            errors: errors.array(),
        });
    }

    executeQueryUpdate('Update user set user_status = ? where user_id = ?', [req.query.value, req.query.user_id], function (err, result) {
        if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

        if (result.affectedRows > 0) {

            let action = (req.query.value == 0) ? "enabled" : "disabled";

            activityLog(`info`, `updateMerchantStatus`, `'${req.user.email}' ${action} user having user_id: ${req.query.user_id}`, req.method, JSON.stringify(req.body), JSON.stringify(req.query), req.user.role, req.user.user_id);
            res.status(200).send({ status: true, message: "success" });
        }
        else {
            res.status(200).send({
                status: false,
                message: "invalid input"
            });

        }

    });
    // });
}

exports.deleteUser = async (req, res) => {

    await check("user_id")
        .not().isEmpty()
        .isInt()
        .run(req);

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            response: false,
            msg: "Invalid Parameter",
            errors: errors.array(),
        });
    }
    let condition = ""

    if (req.user.role == 2)
        condition += " and user.created_by = " + req.user.user_id

    executeQueryUpdate('Update user set deleted = 1 where user_id=? and role IN (2,3,4,5) and deleted = 0 ' + condition, [req.query.user_id], function (err, result) {
        if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

        if (result.affectedRows > 0) {
            activityLog(`info`, `deleteUser`, `'${req.user.email}' Deleted User having user_id: ${req.query.user_id}`, req.method, JSON.stringify(req.body), JSON.stringify(req.query), req.user.role, req.user.user_id);
            res.status(200).send({ status: true, message: "success" });
        }
        else {
            res.status(400).send({
                status: false,
                message: "invalid input"
            });
        }
    });
    // });
}

//Operators

exports.getactivtyLogs = (req, res) => {

    let limit = req.query.perPage

    if (!req.query.perPage) limit = 50
    else limit = req.query.perPage

    let page = req.query.page

    if (!req.query.page) page = 1
    else page = req.query.page

    const offset = (page - 1) * limit

    let condition = ""
    let sortBy
    let sortByCond = ""
    let sortByColumnName

    if (req.query.from_date && req.query.to_date)
        condition +=
            " AND  (DATE(activity_logs.created_at) BETWEEN '" + req.query.from_date + "' AND '" + req.query.to_date + "')";

    if (req.query.keyword)
        condition +=
            " and ( user.name like '%" + req.query.keyword + "%'"

    if (req.query.keyword)
        condition +=
            " OR function_name like '%" + req.query.keyword + "%'"

    if (req.query.keyword)
        condition +=
            " OR activity like '%" + req.query.keyword + "%' )"

    if (req.query.level)
        condition +=
            " and activity_logs.level = '" + req.query.level + "'"

    if (req.query.role)
        condition +=
            " and activity_logs.role IN (" + req.query.role + ")"

    if (req.user.role != 1)
        condition +=
            " and activity_logs.user_id = " + req.user.user_id

    if ((req.query.sortBy == "user_id")) {
        sortByColumnName = req.query.sortBy
    } else if (req.query.sortBy == "name") {
        sortByColumnName = "name"
    } else if (req.query.sortBy == "email") {
        sortByColumnName = "email"
    }

    if (sortByColumnName) {
        sortBy = " ORDER BY " + sortByColumnName;

        if ((req.query.order == "asc") || (req.query.order == "ASC")) {
            sortByCond += sortBy + " ASC";
        }
        else if ((req.query.order == "desc") || (req.query.order == "DESC")) {
            sortByCond += sortBy + " DESC";
        }

        condition += sortByCond
    } else {
        condition += " ORDER BY activity_logs.id desc"
    }

    executeQuerySelect('SELECT id,function_name,activity,level,method,activity_logs.role,activity_logs.created_at,user.name as created_by FROM activity_logs join user on user.user_id  = activity_logs.user_id where activity_logs.deleted= 0  ' + condition + ' LIMIT ' +
        limit +
        ' OFFSET ' +
        offset, function (err, result) {
            if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });
            if (result != []) {

                executeQuerySelect('SELECT id,function_name,activity,level,method,activity_logs.role,activity_logs.created_at FROM activity_logs join user on user.user_id  = activity_logs.user_id where activity_logs.deleted= 0 ' + condition, function (err, resultCount) {
                    if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });
                    if (result != []) {
                        res.send({
                            status: true,
                            elementCount:
                                resultCount.length,
                            data: result,
                            message: "success"
                        });
                    }
                })
            }
        });
};

function compareStrings(write_user_group_ids, read_user_group_ids) {
    var write_user_group_ids = write_user_group_ids.split(",");
    var read_user_group_ids = read_user_group_ids.split(",");


    const found = write_user_group_ids.every(r => read_user_group_ids.indexOf(r) >= 0)
    return found
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

exports.updateParameterStatus = async (req, res) => {

    const { error } = Joi.object({
        id: Joi.number().required().label("ID"),
        type: Joi.string().required().valid("user", "database_users", "system_databases", "modular_apis", "navigations", "user_groups", "widgets", "canvas", "pages", "modular_apis").label("Parameter Type"),
        value: Joi.number().valid(0, 1).required().label("Value"),//Status - enabled, 1 : Disabled
        ref_id: Joi.string().required().label("ref_id"),
        otp: Joi.number().required().label("otp"),
    }).validate(req.query);

    if (error) return res.status(400).send({ status: false, data: error, message: "failed" })

    let validOTPRequest = await otpRequest.verifyOTP(req.query.ref_id, req.query.otp, req.user.user_id);

    if (validOTPRequest) {
        if (validOTPRequest.seconds > 600)//Check if otp is between 5 mins
            return res.status(400).send({ status: false, data: "OTP Expired", message: "failed" })
    } else
        return res.status(400).send({ status: false, data: "Invalid OTP", message: "failed" })

    var pk_key = req.query.type == "user" ? 'user_id' : 'id';

    executeQueryUpdate(`Update ${req.query.type} set status = ? where ${pk_key} = ?`, [req.query.value, req.query.id], function (err, result) {
        if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

        if (result.affectedRows > 0) {

            var status = req.query.value == 0 ? 'enabled' : 'disabled';

            activityLog(`info`, `update${req.query.type}status`, `'${req.user.email}' ${status} ${req.query.type} having ID: ${req.query.id}`, req.method, JSON.stringify(req.body), JSON.stringify(req.query), req.user.role, req.user.user_id);

            res.status(200).send({ status: true, message: "success" });
        }
        else {
            res.status(200).send({
                status: false,
                message: "invalid input"
            });
        }
    });
}

exports.deleteParameter = async (req, res) => {

    const { error } = Joi.object({
        id: Joi.number().required().label("ID"),
        type: Joi.string().required().valid("user", "database_users", "system_databases", "modular_apis", "navigations", "user_groups", "widgets", "canvas", "pages", "modular_apis").label("Parameter Type"),
        ref_id: Joi.string().required().label("ref_id"),
        otp: Joi.number().required().label("otp"),
    }).validate(req.query);

    if (error) return res.status(400).send({ status: false, data: error, message: "failed" })

    let validOTPRequest = await otpRequest.verifyOTP(req.query.ref_id, req.query.otp, req.user.user_id);

    if (validOTPRequest) {
        if (validOTPRequest.seconds > 600)//Check if otp is between 5 mins
            return res.status(400).send({ status: false, data: "OTP Expired", message: "failed" })
    } else
        return res.status(400).send({ status: false, data: "Invalid OTP", message: "failed" })

    var pk_key = req.query.type == "user" ? 'user_id' : 'id';

    executeQueryUpdate(`Update ${req.query.type} set deleted = 1 where ${pk_key} = ? and created_by = ?`, [req.query.id, req.user.user_id], function (err, result) {
        if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

        if (result.affectedRows > 0) {

            activityLog(`info`, `deleteParameter`, `'${req.user.email}' deleted ${req.query.type} ID ${req.query.id}`, req.method, JSON.stringify(req.body), JSON.stringify(req.query), req.user.role, req.user.user_id);

            res.status(200).send({ status: true, message: "success" });
        }
        else {
            res.status(200).send({
                status: false,
                message: "invalid input"
            });
        }
    });
}

exports.getTransactions = (req, res) => {

    let limit = req.query.perPage

    if (!req.query.perPage) limit = 50
    else limit = req.query.perPage

    let page = req.query.page

    if (!req.query.page) page = 1
    else page = req.query.page

    const offset = (page - 1) * limit

    let condition = ""

    if (req.query.keyword)
        condition +=
            " AND ( `transactions`.transaction_id  LIKE '%" + req.query.keyword + "%'"

    if (req.query.keyword)
        condition +=
            " OR merchant_profile.name_en LIKE '%" + req.query.keyword + "%'"

    if (req.query.keyword)
        condition +=
            " OR causeName_en LIKE '%" + req.query.keyword + "%')"

    if (req.query.from_date && req.query.to_date)
        condition +=
            " AND  (DATE(transactions.created_at) BETWEEN '" + req.query.from_date + "' AND '" + req.query.to_date + "')";

    if (req.query.status == 0)
        condition +=
            " AND `transactions`.status = 0"

    if (req.query.merchant_id)
        condition +=
            " AND `transactions`.merchant_id = " + req.query.merchant_id

    if (req.query.location_user_id)
        condition +=
            " AND `transactions`.location_user_id = " + req.query.location_user_id

    if (req.query.transaction_type)
        condition +=
            " AND `transactions`.transaction_type = " + req.query.transaction_type

    if (req.query.user_id)
        condition +=
            " AND `transactions`.created_by = " + req.query.user_id

    if (req.query.cause_id)
        condition +=
            " AND `transactions`.cause_id = " + req.query.cause_id

    if (req.query.sortBy && req.query.order) {

        if (req.query.sortBy == "merchant_name_en") req.query.sortBy = "name_en"
        if (req.query.sortBy == "merchant_name_ar") req.query.sortBy = "name_ar"
        if (req.query.sortBy == "merchant_name_hi") req.query.sortBy = "name_hi"
        if (req.query.sortBy == "location_name") req.query.sortBy = "locations.name"
        if (req.query.sortBy == "location_email") req.query.sortBy = "locations.email"
        if (req.query.sortBy == "created_at") req.query.sortBy = "transactions.created_at"

        condition += ` order by ${req.query.sortBy} ${req.query.order}`;
    } else {
        condition += " order by transactions.id desc";
    }

    //group by system_database_db_users.database_id

    executeQuerySelect('SELECT transactions.id,transaction_id,causeName_en,causeName_ar,causeName_hi,amount,transactions.status,transactions.created_at,merchant_profile.name_en as merchant_name_en,merchant_profile.name_ar as merchant_name_ar,merchant_profile.name_hi as merchant_name_hi,locations.name as location_name,locations.email as location_email,merchant_commission,location_commission,platform_fees,transaction_type,employee_commission,latitude,longitude,serial_number as machine_no,user.name as username FROM transactions join merchant_profile on merchant_profile.user_id = transactions.merchant_id join user on user.user_id = transactions.created_by join causes on causes.id = transactions.cause_id left join categories on categories.id = transactions.merchant_category_id left join locations on locations.user_id = transactions.location_user_id join machines on machines.id = transactions.machine_id where transactions.deleted = 0 ' + condition + ' Limit ' +
        limit +
        ' OFFSET ' +
        offset, [req.user.user_id], function (err, result) {

            if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

            executeQuerySelect('SELECT transactions.id FROM transactions join merchant_profile on merchant_profile.user_id = transactions.merchant_id join causes on causes.id = transactions.cause_id left join categories on categories.id = transactions.merchant_category_id left join locations on locations.user_id = transactions.location_user_id join machines on machines.id = transactions.machine_id where transactions.deleted = 0 ' + condition, [req.user.user_id], function (err, resultCount) {

                if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

                if (req.query.export == 1) {
                    let rowsData = []
                    var conf = {}

                    result.forEach(rowData => {

                        const columns = [rowData['transaction_id'], rowData['causeName_en'], rowData['causeName_ar'], rowData['causeName_hi'], rowData['amount'], rowData['merchant_commission'], rowData['location_commission'], rowData['platform_fees'], rowData['employee_commission'], rowData['transaction_type'], rowData['status'], rowData['merchant_name_en'], rowData['merchant_name_ar'], rowData['merchant_name_hi'], rowData['location_name'], rowData['location_email'],
                        rowData['latitude'], rowData['longitude'], rowData['machine_no'], rowData['username'], rowData['created_at']
                        ]

                        rowsData.push(columns)

                    });

                    const filename = 'transactions_' + Date.now()
                    conf.name = 'transactions_' + Date.now()
                    conf.cols = [{
                        caption: 'transaction_id',
                        type: 'string'
                    }, {
                        caption: 'causeName_en',
                        type: 'string'
                    }, {
                        caption: 'causeName_ar',
                        type: 'string'
                    }, {
                        caption: 'causeName_hi',
                        type: 'string'
                    }, {
                        caption: 'amount',
                        type: 'string'
                    }, {
                        caption: 'merchant_commission',
                        type: 'string'
                    }, {
                        caption: 'location_commission',
                        type: 'string'
                    }, {
                        caption: 'platform_fees',
                        type: 'string'
                    }, {
                        caption: 'employee_commission',
                        type: 'string'
                    }, {
                        caption: 'transaction_type',
                        type: 'string'
                    }, {
                        caption: 'status',
                        type: 'number'
                    }, {
                        caption: 'merchant_name_en',
                        type: 'string'
                    }, {
                        caption: 'merchant_name_ar',
                        type: 'string'
                    }, {
                        caption: 'merchant_name_hi',
                        type: 'string'
                    }, {
                        caption: 'location_name',
                        type: 'string'
                    }, {
                        caption: 'location_email',
                        type: 'string'
                    }, {
                        caption: 'latitude',
                        type: 'string'
                    }, {
                        caption: 'longitude',
                        type: 'string'
                    }, {
                        caption: 'machine_no',
                        type: 'string'
                    }, {
                        caption: 'username',
                        type: 'string'
                    }, {
                        caption: 'created_at',
                        type: 'string'
                    }]

                    conf.rows = rowsData

                    exportXLSData(filename, conf, res);

                } else {
                    res.status(200).send({
                        status: true, elementCount:
                            resultCount.length, data: result, message: "success"
                    });
                }


            });
        });
}

exports.getDailyCashTransactions = (req, res) => {

    let limit = req.query.perPage
    let role = req.user.role

    if (!req.query.perPage) limit = 50
    else limit = req.query.perPage

    let page = req.query.page

    if (!req.query.page) page = 1
    else page = req.query.page

    const offset = (page - 1) * limit

    let condition = ""
    let condition2 = ""
    let condition3 = ""

    if (req.query.location_user_id)
        condition += " AND transactions.location_user_id = " + req.query.location_user_id

    if (req.query.user_id)
        condition += " AND transactions.created_by = " + req.query.user_id

    condition += " GROUP BY DATE(transactions.created_at)"

    if (req.query.sortBy && req.query.order) {
        if (req.query.sortBy == "merchant_name_en") req.query.sortBy = "name_en"
        if (req.query.sortBy == "merchant_name_ar") req.query.sortBy = "name_ar"
        if (req.query.sortBy == "merchant_name_hi") req.query.sortBy = "name_hi"
        if (req.query.sortBy == "location_name") req.query.sortBy = "locations.name"
        if (req.query.sortBy == "location_email") req.query.sortBy = "locations.email"
        if (req.query.sortBy == "created_at") req.query.sortBy = "transactions.created_at"
        if (req.query.sortBy == "username") req.query.sortBy = "user.name"

        condition += ` order by ${req.query.sortBy} ${req.query.order}`;
    } else {
        condition += " order by transactions.id desc";
    }
    //group by system_database_db_users.database_id

    executeQuerySelect('SELECT transactions.id,sum(amount) as total_collection,DATE_FORMAT(transactions.created_at,"%Y-%m-%d") as created_at,locations.name as location_name,locations.email as location_email,user.name as username,transactions.created_by,location_user_id,(SELECT sum(amount)FROM deposit_transactions join user on user.user_id = deposit_transactions.created_by where deposit_transactions.deleted = 0 AND user.created_by = ? AND DATE_FORMAT(`deposit_transactions`.date,"%Y-%m-%d") = DATE_FORMAT(transactions.created_at,"%Y-%m-%d")) as total_deposited FROM transactions join merchant_profile on merchant_profile.user_id = transactions.merchant_id join user on user.user_id = transactions.created_by left join locations on locations.user_id = transactions.location_user_id join causes on causes.id = transactions.cause_id join machines on machines.id = transactions.machine_id where transaction_type = 1 ' + condition + ' Limit ' +
        limit +
        ' OFFSET ' +
        offset, [req.query.location_user_id], function (err, result) {

            if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

            executeQuerySelect('SELECT transactions.id FROM transactions join merchant_profile on merchant_profile.user_id = transactions.merchant_id join user on user.user_id = transactions.created_by left join locations on locations.user_id = transactions.location_user_id join causes on causes.id = transactions.cause_id join machines on machines.id = transactions.machine_id where transaction_type = 1 ' + condition, [req.query.location_user_id], function (err, resultCount) {

                if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

                if (req.query.location_user_id) {
                    condition2 += " AND `transactions`.location_user_id = " + req.query.location_user_id
                    condition3 += " AND user.created_by = " + req.query.location_user_id
                }


                if (req.query.user_id) {
                    condition2 += " AND `transactions`.created_by = " + req.query.user_id
                    condition3 += " AND `deposit_transactions`.created_by = " + req.query.user_id
                }

                executeQuerySelect('SELECT (SELECT COALESCE(SUM(amount),0) from transactions join user on user.user_id = transactions.created_by where transaction_type = 1 ' + condition2 + ') - (SELECT COALESCE(SUM(amount),0) as total_amount FROM deposit_transactions join user on user.user_id = deposit_transactions.created_by and deposit_transactions.deleted = 0 ' + condition3 + ') as total_pending_amount', [req.user.user_id, req.user.user_id], function (err, transactionsResult) {

                    if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

                    let total_pending_amount = transactionsResult[0]['total_pending_amount'];

                    return res.status(200).send({
                        status: true, elementCount:
                            resultCount.length, data: result, total_pending_amount: total_pending_amount, message: "success"
                    });

                })

                // if (req.query.export == 1) {
                //     let rowsData = []
                //     var conf = {}

                //     result.forEach(rowData => {

                //         const columns = [rowData['transaction_id'], rowData['causeName_en'], rowData['causeName_ar'], rowData['causeName_hi'], rowData['amount'], rowData['merchant_commission'], rowData['location_commission'], rowData['platform_fees'], rowData['employee_commission'], rowData['transaction_type'], rowData['status'], rowData['merchant_name_en'], rowData['merchant_name_ar'], rowData['merchant_name_hi'], rowData['location_name'], rowData['location_email'],
                //         rowData['latitude'], rowData['longitude'], rowData['machine_no'], rowData['username'], rowData['created_at']
                //         ]

                //         rowsData.push(columns)

                //     });

                //     const filename = 'transactions_' + Date.now()
                //     conf.name = 'transactions_' + Date.now()
                //     conf.cols = [{
                //         caption: 'transaction_id',
                //         type: 'string'
                //     }, {
                //         caption: 'causeName_en',
                //         type: 'string'
                //     }, {
                //         caption: 'causeName_ar',
                //         type: 'string'
                //     }, {
                //         caption: 'causeName_hi',
                //         type: 'string'
                //     }, {
                //         caption: 'amount',
                //         type: 'string'
                //     }, {
                //         caption: 'merchant_commission',
                //         type: 'string'
                //     }, {
                //         caption: 'location_commission',
                //         type: 'string'
                //     }, {
                //         caption: 'platform_fees',
                //         type: 'string'
                //     }, {
                //         caption: 'employee_commission',
                //         type: 'string'
                //     }, {
                //         caption: 'transaction_type',
                //         type: 'string'
                //     }, {
                //         caption: 'status',
                //         type: 'number'
                //     }, {
                //         caption: 'merchant_name_en',
                //         type: 'string'
                //     }, {
                //         caption: 'merchant_name_ar',
                //         type: 'string'
                //     }, {
                //         caption: 'merchant_name_hi',
                //         type: 'string'
                //     }, {
                //         caption: 'location_name',
                //         type: 'string'
                //     }, {
                //         caption: 'location_email',
                //         type: 'string'
                //     }, {
                //         caption: 'latitude',
                //         type: 'string'
                //     }, {
                //         caption: 'longitude',
                //         type: 'string'
                //     }, {
                //         caption: 'machine_no',
                //         type: 'string'
                //     }, {
                //         caption: 'username',
                //         type: 'string'
                //     }, {
                //         caption: 'created_at',
                //         type: 'string'
                //     }]

                //     conf.rows = rowsData

                //     exportXLSData(filename, conf, res);

                // } else {
                //     res.status(200).send({
                //         status: true, elementCount:
                //             resultCount.length, data: result, message: "success"
                //     });
                // }
            });
        });
}

exports.getDeposit_transactions = (req, res) => {

    let limit = req.query.perPage
    let role = req.user.role

    if (!req.query.perPage) limit = 50
    else limit = req.query.perPage

    let page = req.query.page

    if (!req.query.page) page = 1
    else page = req.query.page

    const offset = (page - 1) * limit

    let condition = ""
    let condition2 = ""

    if (req.query.keyword)
        condition +=
            " AND ( `deposit_transactions`.transaction_id  LIKE '%" + req.query.keyword + "%'"

    if (req.query.keyword)
        condition +=
            " OR user.name LIKE '%" + req.query.keyword + "%'"

    if (req.query.keyword)
        condition +=
            " OR reference LIKE '%" + req.query.keyword + "%')"

    if (req.query.from_date && req.query.to_date)
        condition +=
            " AND  (DATE(deposit_transactions.created_at) BETWEEN '" + req.query.from_date + "' AND '" + req.query.to_date + "')";

    if (req.query.user_id)
        condition +=
            " AND `deposit_transactions`.created_by = " + req.query.user_id

    if (req.query.date)
        condition +=
            " AND DATE_FORMAT(`deposit_transactions`.date,'%Y-%m-%d') = '" + req.query.date + "'"

    if (req.query.location_user_id)
        condition +=
            " AND `user`.created_by = " + req.query.location_user_id

    if (req.query.sortBy && req.query.order) {
        if (req.query.sortBy == "username") req.query.sortBy = "user.name"
        if (req.query.sortBy == "transaction_id") req.query.sortBy = "transaction_id"
        if (req.query.sortBy == "created_at") req.query.sortBy = "deposit_transactions.created_at"
        if (req.query.sortBy == "username") req.query.sortBy = "user.name"

        condition += ` order by ${req.query.sortBy} ${req.query.order}`;
    } else {
        condition += " order by deposit_transactions.id desc";
    }
    //group by system_database_db_users.database_id

    executeQuerySelect('SELECT deposit_transactions.*,user.name as username,DATE_FORMAT(`deposit_transactions`.date,"%Y-%m-%d") as date FROM deposit_transactions join user on user.user_id = deposit_transactions.created_by where deposit_transactions.deleted = 0 ' + condition + ' Limit ' +
        limit +
        ' OFFSET ' +
        offset, [], function (err, result) {

            if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

            executeQuerySelect('SELECT count(*) as count FROM deposit_transactions join user on user.user_id = deposit_transactions.created_by where deposit_transactions.deleted = 0 ' + condition, [], function (err, resultCount) {

                if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

                // if (role == 3) { // Location User
                //     condition2 += " AND user.created_by = " + req.user.user_id
                //     if (req.query.user_id)
                //         condition2 += " AND `transactions`.created_by = " + req.query.user_id
                // }
                // if (role == 4) { // Sub User
                //     condition2 += " AND transactions.created_by = " + req.user.user_id
                // }

                if (req.query.export == 1) {
                    let rowsData = []
                    var conf = {}

                    result.forEach(rowData => {

                        const columns = [rowData['transaction_id'], rowData['amount'], rowData['reference'],
                        rowData['attachment_path'], rowData['username'], rowData['created_at']
                        ]

                        rowsData.push(columns)

                    });

                    const filename = 'deposit_transactions_' + Date.now()
                    conf.name = 'deposit_transactions_' + Date.now()
                    conf.cols = [{
                        caption: 'transaction_id',
                        type: 'string'
                    }, {
                        caption: 'amount',
                        type: 'string'
                    }, {
                        caption: 'reference',
                        type: 'string'
                    }, {
                        caption: 'attachment_path',
                        type: 'string'
                    }, {
                        caption: 'username',
                        type: 'string'
                    }, {
                        caption: 'created_at',
                        type: 'string'
                    }]

                    conf.rows = rowsData

                    exportXLSData(filename, conf, res);

                } else {
                    res.status(200).send({
                        status: true, elementCount:
                            resultCount[0]['count'], data: result, message: "success"
                    });
                }


            });
        });
}


exports.listmachines = (req, res) => {

    let params = []
    let query1 = "select machines.id,serial_number from machines where deleted=0 and created_by = ?"
    let query2 = "select count(*) as count from machines where deleted=0 and created_by = ?"
    let query = ""

    params.push(req.query.location_id);

    let limit = req.query.perPage
    if (!req.query.perPage) limit = 50
    else limit = req.query.perPage
    let page = req.query.page
    if (!req.query.page) page = 1
    else page = req.query.page
    const offset = (page - 1) * limit
    if (req.query.status)
        query += " AND status = " + req.query.status
    if (req.query.keyword)
        query += " AND concat(serial_number)  LIKE '%" + req.query.keyword + "%'"
    if (req.query.sortBy && req.query.order) {
        query += " order by " + req.query.sortBy + "  " + req.query.order;
    } else {
        query += " order by id desc";
    }
    let condition = ' Limit ' + limit + ' OFFSET ' + offset
    executeQuerySelect(query1 + query + condition, params, function (err, result) {
        if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });
        executeQuerySelect(query2 + query, params, function (err1, result1) {
            if (err) return res.status(500).send({ status: false, data: err1, message: "Some Error Occured" });
            return res.status(200).send({ status: true, data: result, elementCount: result1 ? result1[0]['count'] : 1, message: "success" });
        })
    });
}

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

function getlocationsByMerchant(user_id) {

    return new Promise((resolve, reject) => {

        executeQuerySelect('SELECT GROUP_CONCAT(location_merchants.user_id) as location_user_ids FROM location_merchants join locations on locations.id = location_merchants.location_id where locations.user_id = ? and location_merchants.deleted = 0', [user_id],
            function (err, result) {

                if (err) resolve(false);

                if (result.length > 0) {
                    resolve(result[0]['location_user_ids'])
                }
                else {
                    resolve(false);
                }
            });
    })
}
