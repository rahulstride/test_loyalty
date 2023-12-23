const { executeQuerySelect, executeQueryInsert, executeQueryUpdate } = require('../shared/shared-db');

// User Roles 
//1: admin
//2 : Operator
//3 : Vallet User
//4 : Validation Partner

let User = {
    adminSignup: (input, cb) => {
        return executeQueryInsert('INSERT INTO `user`( `name`,`email`,`phone`,`password`,`role`) VALUES ? ',
            [[input.name, input.email, input.phone, input.password, 1]], cb)
    }, operatorSignup: (input, cb) => {
        return executeQueryInsert('INSERT INTO `user`( `name`,`email`,`password`,`role`) VALUES ? ',
            [[input.name, input.email, input.password, 2]], cb)
    },
    valletUserSignup: (input, cb) => {
        return executeQueryInsert('INSERT INTO `user`( `name`,`email`,`phone`,`password`,`role`,`created_by`) VALUES ? ',
            [[input.name, input.email, input.phone, input.password, 3, input.created_by]], cb)
    },
    validationPartnerSignup: (input, cb) => {
        return executeQueryInsert('INSERT INTO `user`( `name`,`email`,`phone`,`password`,`role`,`created_by`) VALUES ? ',
            [[input.name, input.email, input.phone, input.password, 4, input.created_by]], cb)
    },
    findOne: (input, cb) => {
        return executeQuerySelect('SELECT * from  `user` where email=? and deleted = 0', [input], cb)
    },
    findByEmailOrPhone: (input, cb) => {
        //return executeQuerySelect('SELECT `user`.*,`vendor_profile`.logo_path from `user` join `vendor_profile` on `vendor_profile`.user_id = `user`.user_id and (email=? or `user`.phone = ?) and user_status = 0 and deleted = 0', [input, input], cb)
        return executeQuerySelect('SELECT * from `user` where (email=? or `user`.phone = ?) and deleted = 0', [input[0], input[1]], cb)
    },
    findById: (input, cb) => {
        return executeQuerySelect('SELECT * from  `user` where user_id=? and user_status = 1 and deleted = 0', [input], cb)
    },
    findorCreateCustomer: (input, cb) => {
        executeQuerySelect('SELECT * from  `customer` where phone=? and deleted = 0', [input], function (err, result) {
            if (result.length > 0) {
                return cb(null, result)
            } else {
                executeQueryInsert('INSERT INTO `customer`( `phone`,`user_status`) VALUES ? ',
                    [[input, 1]], function (err, result) {
                        return executeQuerySelect('SELECT * from  `customer` where user_id=? and deleted = 0', [result.insertId], cb)
                    })
            }
        })
    },
    findCustomer: (input, cb) => {
        return executeQuerySelect('SELECT * from  `customer` where phone=? and deleted = 0', [input], function (err, result) {
            return cb(null, result)
        }
        )
    }
}

exports.User = User;
