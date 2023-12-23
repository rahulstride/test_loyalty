const { executeQueryInsert } = require('../shared/shared-db');

function activityLog(level, function_name, activity, method, request_body, request_query, role, user_id) {

    //console.log(level, function_name, activity, method, request_body, request_query, role, user_id)

    executeQueryInsert('INSERT INTO `activity_logs`( `level`,`function_name`,`activity`, `method`,`request_body`,`request_query`,`role`,`user_id`) VALUES ? ',
        [
            [
                level,
                function_name,
                activity,
                method,
                request_body,
                request_query,
                role,
                user_id
            ]
        ],
        function (err, result) {
            //if (err) return res.status(500).send({ status: false, data: err, message: "failed" });     

        });
}

exports.activityLog = activityLog;