const { executeQuerySelect, executeQueryInsert, executeQueryUpdate } = require('../shared/shared-db');


function createNotification(user_id, notification) {

    // const { error } = validateAmenities(req.body); 
    // if (error) return res.status(400).send({status : false,data: error,message:"failed"})

    executeQueryInsert('INSERT INTO `system_notifications`( `user_id`,`notification`) VALUES ? ',
        [[user_id, notification]],
        function (err, result) {
            if (err)
                return false;

            return true;

        });


};

function updateNotification(notification_id, user_id) {

    executeQueryUpdate('UPDATE `system_notifications` SET status = 1 where `notification_id`=? and user_id = ? ',
        [notification_id, user_id],
        function (err, result) {
            if (err) return false;

            return true;

        });


};

exports.createNotification = createNotification;