const { body, check, validationResult, Result } = require("express-validator");
const { executeQuerySelect, executeQueryInsert, executeQueryUpdate } = require('../shared/shared-db');
const { activityLog } = require('../shared/activity_log');
const Joi = require('joi');
const azurestorage = require('azure-storage')
var MulterAzureStorage = require('multer-azure-storage');

const { validatePointsSystem } = require('../models/pointSystem');
const user = require('../models/user');
const otpRequest = require('../models/otpRequest');
const { triggerSMS,sendSMS } = require('../shared/triggerSMS');

const { pointsRegisterPurchase, validatePointsRedeemStep1, validatePointsRedeemStep2, validatePointsPurchaseCancelRequest, validatePointsBalanceRequest } = require('../models/pointSystem');

const azureStorageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const azurecontainer = new MulterAzureStorage({
    azureStorageConnectionString: azureStorageConnectionString,
    containerName: 'offersappmedia',
    containerSecurity: 'blob'
})

const
    azureStorage = require('azure-storage')
    , blobService = azureStorage.createBlobService()
    , containerName = 'offersappmedia'
    ;

//Merchant Functions

exports.getConfiguration = (req, res) => {

    executeQuerySelect('SELECT redeem_omr_value,redeem_point_value from points_system where user_id = 1', [], function (err, result) {

        if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

        if (result != []) {

            return res.send({
                status: true,
                data: result[0],
                message: "success"
            });

        } else {
            return res.send({
                status: true,
                data: [],
                message: "success"
            });
        }
    });
};

exports.configure = (req, res) => {

    const { error } = validatePointsSystem(req.body);
    if (error) return res.status(400).send({ status: false, data: error, message: "failed" })

    executeQuerySelect('SELECT id FROM points_system where user_id = 1', [], function (err, result) {

        if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

        if (result.length > 0) {

            let data = {
                redeem_point_value: req.body.redeem_point_value,
                redeem_omr_value: req.body.redeem_omr_value,
            };

            executeQueryUpdate('UPDATE `points_system` SET ? where `id`= 1',
                [data],
                function (err, result) {
                    if (err) return res.status(500).send({ status: false, data: err, message: "failed" });

                    return res.send({
                        status: true,
                        message: "success"
                    });

                });

        }
        else {

            executeQueryInsert('INSERT INTO `points_system`(`redeem_point_value`,`redeem_omr_value`,`user_id`) VALUES ? ',
                [[req.body.redeem_point_value, req.body.redeem_omr_value, 1]],
                function (err, result) {
                    if (err) return res.status(500).send({ status: false, data: err, message: "failed" });

                    //activityLog(`Created Point System Configuration ${result.insertId}`, "ADD", req.user.user_id);

                    return res.status(200).send({
                        status: true,
                        message: "success"
                    });
                });
        }
        //   }
    });


}

//Merchant Functions

//User Functions

exports.getPointsBalance = (req, res) => {

    const { error } = validatePointsBalanceRequest(req.body);
    if (error) return res.status(400).send({ status: false, data: error.details[0].message, message: "failed" })

    let phone = req.body.phone;

    user.User.findCustomer(phone, async function (err, response) {
        if (err) return res.status(400).send({ status: false, data: err, message: "failed" })

        if (response && response.length > 0) {

            let point_balance = await getPointBalance(response[0].user_id)

            return res.send({
                status: true,
                data: { "point_balance": parseFloat(point_balance).toFixed(2) },
                message: "success"
            });

            // otpRequest.actions.verifyRequest([phone, ref_id], function (err, response) {
            //     if (err) return res.status(400).send({ status: false, data: err, message: "failed" })

            //     if (response.length > 0) // On Correct OTP Request
            //     {


            //     } else {
            //         return res.status(200).send({
            //             status: false,
            //             data: "Invalid OTP Request",
            //             message: "failed"
            //         });
            //     }
            // })

        } else {
            return res.status(400).send({
                status: false,
                data: "Customer not found",
                message: "failed"
            });

        }


    })
};

exports.pointsRegisterPurchase = async (req, res) => {

    console.log('products_data',req.body.products_data);

    const { error } = pointsRegisterPurchase(req.body);
    if (error) return res.status(400).send({ status: false, data: error.details[0].message, message: "failed" })

    //console.log('products_data',req.body.products_data);

    let phone = req.body.phone;

    const transaction_id =
        'TRN_' + new Date().getTime() + '_' +
        Math.random()
            .toString(36)
            .substring(2, 10)

    user.User.findorCreateCustomer(phone, async function (err, response) {
        if (err) return res.status(400).send({ status: false, data: err, message: "failed" })

        let user_id = response[0].user_id

        let products_data = req.body.products_data

        if (!isValidJsonWithProductArray(products_data)) {
            return res.status(400).send({
                status: false,
                data: "Invalid Json",
                message: "failed"
            });
        }

        products_data = JSON.parse(products_data)

        for (const element of products_data) {
            // Fetch the updated point balance
            let point_balance = await getPointBalance(user_id);

            let productData = await getProductData(element.product_id);
            
            if (productData) {

                let number_of_points = parseFloat(productData['number_of_points']) * parseInt(element.quantity);
                let updated_points_balance = parseFloat(point_balance) + parseFloat(number_of_points);

                console.log('point_balance', parseFloat(point_balance));
                console.log('number_of_points', parseFloat(number_of_points));
                console.log('updated_points_balance', parseFloat(updated_points_balance));

                // Use the updated balance in the transaction
                await inserttoTransactions(phone,user_id, element.product_id, transaction_id, element.quantity, number_of_points, 1, updated_points_balance, productData['number_of_points'], 1);
            }
        }


        // await asyncForEach(products_data,async (element) => {

        //     let point_balance = await getPointBalance(user_id)

        //     executeQuerySelect('SELECT * FROM products where id = ? and deleted = 0', [element.product_id],async function(err, result) {

        //         if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

        //         let number_of_points = parseFloat(result[0]['number_of_points']) * parseInt(element.quantity);                           
        //         let updated_points_balance = parseFloat(point_balance) + parseFloat(number_of_points)
        //         console.log('point_balance',parseFloat(point_balance));
        //         console.log('number_of_points',parseFloat(number_of_points));
        //         console.log('updated_points_balance',parseFloat(updated_points_balance));

        //         await inserttoTransactions(user_id, element.product_id, transaction_id, element.quantity, number_of_points, 1, updated_points_balance,result[0]['number_of_points'], 1);

        //     })
        // })

        return res.send({
            status: true,
            data: { "transaction_id": transaction_id },
            message: "success"
        });
    })
}

// exports.pointsPurchaseStep1 = async (req, res) => {

//     const { error } = validatePointsRedeemStep1(req.body);
//     if (error) return res.status(400).send({ status: false, data: error.details[0].message, message: "failed" })

//     let phone = req.body.phone;

//     const transaction_id =
//         'TRN_' + new Date().getTime() + '_' +
//         Math.random()
//             .toString(36)
//             .substring(2, 10)

//     user.User.findCustomer(phone, function (err, response) {
//         if (err) return res.status(400).send({ status: false, data: err, message: "failed" })

//         if (response.length >0) {

//             let user_id = response[0].user_id
//             let point_balance = response[0].point_balance

//             let points_to_redeem = req.body.points_to_redeem
//             if (!points_to_redeem) return res.status(400).send({ status: false, data: "Points to Redeem required", message: "failed" })

//             if (parseFloat(points_to_redeem) <= parseFloat(point_balance)) {

//                 let otp = "123456";//generateOTP();
//                 const ref_id = crypto.randomBytes(20).toString('hex')

//                 let data = {
//                     "user_id": user_id,
//                     "ref_id": ref_id,
//                     "phone": phone,
//                     "otp": otp
//                 };

//                 otpRequest.actions.createOTPRequest(data, function (err, response) {
//                     if (err) return res.status(400).send({ status: false, data: err, message: "failed" })

//                     var message = "OTP for Points System Verifification :" + otp;
//                     triggerMessage(phone, message);

//                     return res.send({
//                         status: true,
//                         data: {
//                             "ref_id": ref_id,
//                             "otp": otp,
//                         },
//                         message: "success"
//                     });
//                 })

//             } else {
//                 return res.send({
//                     status: false,
//                     data: "Point Balance not sufficient",
//                     message: "failed"
//                 });
//             }

//         } else {
//             return res.status(200).send({
//                 status: false,
//                 data: "Customer not found",
//                 message: "failed"
//             });
//         }


//     })

// }

exports.pointsRedeemStep1 = async (req, res) => {

    const { error } = validatePointsRedeemStep1(req.body);
    if (error) return res.status(400).send({ status: false, data: error.details[0].message, message: "failed" })

    let phone = req.body.phone;
    let otp = otpRequest.generateOTP()
    let ref_id = otpRequest.generateRef()

    const transaction_id =
        'TRN_' + new Date().getTime() + '_' +
        Math.random()
            .toString(36)
            .substring(2, 10)

    user.User.findCustomer(phone, async function (err, response) {
        if (err) return res.status(400).send({ status: false, data: err, message: "failed" })

        if (response.length > 0) {

            let user_id = response[0].user_id
            let point_balance = await getPointBalance(user_id)

            let points_to_redeem = req.body.points_to_redeem
            if (!points_to_redeem) return res.status(400).send({ status: false, data: "Points to Redeem required", message: "failed" })

            if (parseFloat(points_to_redeem) <= parseFloat(point_balance)) {

                executeQuerySelect('SELECT redeem_omr_value,redeem_point_value from points_system where user_id = 1', [], function (err, result) {

                    if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });
    
                    if (result.length > 0) {
    
                        let total = req.body.total;
                        let redeem_omr_value = result[0]['redeem_omr_value'];
                        let redeem_point_value = result[0]['redeem_point_value'];
                                                
                        //let discountEarned = (points_to_redeem / redeem_point_value) * redeem_omr_value
                        let discountEarned = (points_to_redeem / redeem_point_value) * redeem_omr_value
                        let reedemPointsperAED = redeem_point_value/redeem_omr_value
        
                        //let discountEarned = pointPerAed * total
                        let updated_points_balance = point_balance - points_to_redeem
                        let discounted_total = parseFloat(total) - (discountEarned)
                        if (discounted_total < 0)
                            return res.status(200).send({ status: false, data: `Unable to Reedem.Max Allowed Points to Reedem are: ${total*reedemPointsperAED}`, message: "failed" })            
        
                        executeQueryInsert('INSERT INTO `point_system_transactions`(`total`,`discounted_total`,`user_id`,`transaction_id`,`points`,`type`,`redeem_point_value`,`redeem_omr_value`,`updated_points_balance`,`otp`,`ref_id`,`status`) VALUES ? ',
                            [[req.body.total,discounted_total,user_id, transaction_id, points_to_redeem, 2, redeem_point_value, redeem_omr_value, updated_points_balance, otp, ref_id, 0]],
                            async function (err, result) {
                                if (err) return res.status(500).send({ status: false, data: err, message: "failed" });
        
                                let message = "OTP for Points System Verifification :" + otp;
                                triggerSMS(phone, message);
        
                                return res.send({
                                    status: true,
                                    data: {
                                        "transaction_id": transaction_id,
                                        "ref_id": ref_id,
                                        "otp": otp
                                    },
                                    message: "success"
                                });        
                            })
                    }
                })
            } else {
                return res.send({
                    status: false,
                    data: "Point Balance not sufficient",
                    message: "failed"
                });
            }



        } else {
            return res.status(400).send({
                status: false,
                data: "Customer not found",
                message: "failed"
            });
        }

    })

}

exports.pointsRedeemStep2 = async (req, res) => {

    const { error } = validatePointsRedeemStep2(req.body);
    if (error) return res.status(400).send({ status: false, data: error.details[0].message, message: "failed" })

    let otp = req.body.otp;
    let ref_id = req.body.ref_id;   

    executeQuerySelect('SELECT point_system_transactions.*,customer.phone as customer_phone FROM point_system_transactions join customer on customer.user_id = point_system_transactions.user_id where point_system_transactions.ref_id = ? and point_system_transactions.otp = ? and otp_verified = 0', [ref_id, otp], function (err, result) {

        if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" })

        if (result.length > 0) {

            let transaction_id = result[0].transaction_id
            let phone = result[0]['customer_phone']
            let user_id = result[0]['user_id']
            let points_to_redeem = result[0]['points']
            let updated_points_balance = result[0]['updated_points_balance']

            executeQueryUpdate('Update point_system_transactions SET status = 1,otp_verified = 1 where ref_id = ?', [ref_id], function (err, result) {
                if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

                if (result.affectedRows > 0) {

                    let sms_data = {
                        "sms_type": "redeem",
                        "system_name": "points_system",
                        "points_to_redeem": points_to_redeem,
                        "transaction_id": transaction_id,
                        "updated_points_balance": updated_points_balance
                    }

                    sendSMS(phone, sms_data)

                    return res.send({
                        status: true,
                        data: { "transaction_id": transaction_id },
                        message: "success"
                    });                  
                }
                else {
                    return res.status(400).send({
                        status: false,
                        data: "Invalid OTP Request",
                        message: "failed"
                    });
                }
            });

        } else {
            return res.status(400).send({
                status: false,
                data: "Invalid OTP Request",
                message: "failed"
            });
        }
    })
}

exports.getProductTransactions = (req, res) => {

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
            " AND  (DATE(point_system_transactions.created_at) BETWEEN '" + req.query.from_date + "' AND '" + req.query.to_date + "')";

    if (req.query.keyword)
        condition +=
            " and ( transaction_id like '%" + req.query.keyword + "%'"

    if (req.query.keyword)
        condition +=
            " OR  point_system_transactions.transaction_id = '" + req.query.keyword + "'"

    if (req.query.keyword)
        condition +=
            " OR  point_system_transactions.points = '" + req.query.keyword + "'"

    if (req.query.keyword)
        condition +=
            " OR products.product_name like '%" + req.query.keyword + "%')"

    if (req.query.status)
        condition +=
            " and point_system_transactions.status = '" + req.query.status + "'"

    if (req.query.merchant_id)
        condition +=
            " and point_system_transactions.merchant_id = '" + req.query.merchant_id + "'"

    // if (req.query.user_id)
    //     condition +=
    //         " and point_system_transactions.user_id = '" + req.query.user_id + "'"

    if (req.query.customer_phone)
        condition +=
            " and customer.phone LIKE '%" + req.query.customer_phone + "%'"

    if ((req.query.sortBy == "transaction_id")) {
        sortByColumnName = "transaction_id"
    } else if (req.query.sortBy == "id") {
        sortByColumnName = "point_system_transactions.id"
    } else if (req.query.sortBy == "total") {
        sortByColumnName = "total"
    }
    else if (req.query.sortBy == "created_at") {
        sortByColumnName = "point_system_transactions.created_at"
    }
    else {
        sortByColumnName = "point_system_transactions.id"
    }

    sortBy = " ORDER BY " + sortByColumnName;

    if ((req.query.order == "asc") || (req.query.order == "ASC")) {
        sortByCond += sortBy + " ASC";
    }
    else if ((req.query.order == "desc") || (req.query.order == "DESC")) {
        sortByCond += sortBy + " DESC";
    } else {
        sortByCond += sortBy + " DESC";
    }

    //condition += " group by point_system_transactions.id"
    condition += sortByCond

    executeQuerySelect('SELECT point_system_transactions.id,product_name,point_system_transactions.quantity,transaction_id,products.product_name,points,total,discounted_total,updated_points_balance,type,customer.phone as customer_phone,point_system_transactions.created_at FROM point_system_transactions left join products on products.id = point_system_transactions.product_id join customer on customer.user_id = point_system_transactions.user_id where point_system_transactions.deleted = 0 ' + condition + ' LIMIT ' +
        limit +
        ' OFFSET ' +
        offset, [], function (err, result) {

            if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });
            if (result != []) {

                executeQuerySelect('SELECT count(*) as count FROM point_system_transactions left join products on products.id = point_system_transactions.product_id join customer on customer.user_id = point_system_transactions.user_id where point_system_transactions.deleted = 0' + condition, [], function (err, resultCount) {
                    if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });
                    if (result != []) {
                        res.send({
                            status: true,
                            elementCount:
                                resultCount[0]['count'],
                            data: result,
                            message: "success"
                        });
                    }
                })
            }
        });
};

exports.cancelPointsPurchase = (req, res) => {

    const { error } = validatePointsPurchaseCancelRequest(req.body);
    if (error) return res.status(400).send({ status: false, data: error.details[0].message, message: "failed" })

    let phone = req.body.phone;
    let transaction_id = req.body.transaction_id;

    user.User.findCustomer(phone, async function (err, response) {
        if (err) return res.status(400).send({ status: false, data: err, message: "failed" })

        if (response.length > 0) {

            let user_id = response[0].user_id
            let point_balance = await getPointBalance(user_id)

            // otpRequest.actions.verifyRequest([phone, ref_id], function (err, response) {
            //     if (err) return res.status(400).send({ status: false, data: err, message: "failed" })

            //     if (response.length > 0) // On Correct OTP Request
            //     {
            //     } else {
            //         return res.status(200).send({
            //             status: false,
            //             data: "Invalid OTP Request",
            //             message: "failed"
            //         });
            //     }
            // })

            executeQuerySelect('SELECT point_system_transactions.*,merchant_profile.name as merchant_name,customer.phone as customer_phone FROM point_system_transactions join merchant_profile on merchant_profile.user_id = point_system_transactions.merchant_id join customer on customer.user_id = point_system_transactions.user_id where point_system_transactions.transaction_id = ? and point_system_transactions.user_id = ? and status = 1 and cancelled = 0', [transaction_id, user_id], function (err, result) {

                if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" })

                if (result.length > 0) {

                    let transaction_id = result[0]['transaction_id']
                    let type = result[0]['type']
                    let total = result[0]['total']
                    let points = result[0]['points']
                    let merchant_id = result[0]['merchant_id']
                    let updated_points_balance
                    let updateOp



                    activityLog(`Cancel Points System Transaction`, "UPDATE", user_id);

                    if (type == 1) {
                        updateOp = "-"
                        updated_points_balance = parseFloat(point_balance) - parseFloat(points)
                    }
                    else if (type == 2) {
                        updateOp = "+"
                        updated_points_balance = parseFloat(point_balance) + parseFloat(points)
                    }

                    executeQueryUpdate('Update point_system_transactions SET cancelled = 1 where transaction_id = ? and  user_id = ?', [transaction_id, user_id], function (err, result) {
                        if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

                        if (result.affectedRows > 0) {

                            executeQueryInsert('INSERT INTO `point_system_transactions`( `user_id`,`merchant_id`,`transaction_id`,`total`,`points`,`type`,`updated_points_balance`,`status`) VALUES ? ',
                                [
                                    [
                                        user_id,
                                        merchant_id,
                                        transaction_id,
                                        total,
                                        points,
                                        3, // Cancel
                                        updated_points_balance,
                                        1
                                    ]
                                ],
                                function (err, result) {
                                    if (err) return res.status(500).send({ status: false, data: err, message: "failed" });

                                    let sms_data = {
                                        "sms_type": "cancel",
                                        "system_name": "points_system",
                                        "transaction_id": transaction_id,
                                        "updated_points_balance": updated_points_balance
                                    }

                                    sendSMS(phone, sms_data)
                                    // var message = `Transaction ID: ${transaction_id} cancelled succesfully.Updated Points Balance: ${updated_points_balance} Points.`;
                                    // triggerMessage(phone, message);

                                    return res.status(200).send({ status: true, data: { "message": message }, message: "success" });

                                })

                        }
                        else {
                            return res.status(200).send({
                                status: false,
                                message: "invalid input"
                            });
                        }
                    });

                    // executeQueryUpdate('UPDATE `customer` SET point_balance = point_balance ' + updateOp + ' ? where `user_id` = ? ',
                    //     [points, user_id],
                    //     function (err, result) {
                    //         if (err) return res.status(500).send({ status: false, data: err, message: "failed" });


                    //     })

                } else {
                    return res.status(400).send({
                        status: false,
                        data: "Invalid Transaction",
                        message: "failed"
                    });

                }
            })
        } else {
            return res.status(400).send({
                status: false,
                data: "Customer not found",
                message: "failed"
            });
        }

    })
}

//User Functions

function getPointBalance(user_id) {

    return new Promise((resolve, reject) => {
        executeQuerySelect('SELECT `updated_points_balance` FROM point_system_transactions where user_id = ? and status = 1 order by id desc limit 0,1', [user_id], function (err, result) {

            if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

            if (result.length > 0) {
                resolve(result[0]['updated_points_balance']);
            }
            else
                resolve(0.00);
        })
    })
}

function getProductData(product_id) {

    return new Promise((resolve, reject) => {
        executeQuerySelect('SELECT * FROM products WHERE id = ? AND deleted = 0', [product_id], function (err, result) {

            if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });

            if (result.length > 0) {
                resolve(result[0]);
            }
            else
                resolve(false);
        })
    })
}

function inserttoTransactions(phone,user_id, product_id, transaction_id, quantity, number_of_points, type, updated_points_balance, product_points_value, status) {

    return new Promise((resolve, reject) => {

        executeQueryInsert('INSERT INTO `point_system_transactions`( `user_id`,`product_id`,`transaction_id`,`quantity`,`points`,`type`,`updated_points_balance`,`product_points_value`,`status`) VALUES ? ',
            [[user_id, product_id, transaction_id, quantity, number_of_points, type, updated_points_balance, product_points_value, status]],
            async function (err, result) {
                if (err) return res.status(500).send({ status: false, data: err, message: "failed" });

                resolve(result.affectedRows);
                let sms_data = {
                    "sms_type": "purchase",
                    "system_name": "points_system",
                    "pointsEarned": number_of_points,
                    "transaction_id": transaction_id,
                    "updated_points_balance": updated_points_balance
                }
                sendSMS(phone, sms_data)

            })
    })
}


function isValidJsonWithProductArray(jsonString) {
    try {
        const parsedJson = JSON.parse(jsonString);

        // Check if it's an array
        if (!Array.isArray(parsedJson)) {
            return false;
        }

        // Check if each object in the array has "product_id" and "quantity" keys
        for (const obj of parsedJson) {
            if (!(obj && typeof obj === 'object' && 'product_id' in obj && 'quantity' in obj)) {
                return false;
            }
        }

        // If all checks pass, it's a valid JSON with the required structure
        return true;
    } catch (error) {
        // If parsing fails, it's not valid JSON
        return false;
    }
}
async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}