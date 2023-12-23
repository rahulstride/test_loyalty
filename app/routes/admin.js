const express = require('express');
const router = express.Router();

const adminController = require('../controllers/admin');
const products = require('../controllers/products');
const pointSystemController = require('../controllers/pointSystem');

const multer = require('multer');
var upload = multer()

module.exports = () => {
    //Routes by rahul
    router.post('/changePassword', upload.none(), adminController.changePassword);
  
    router.get('/getStats', isAuthorizedAdmin, adminController.getStatsAdmin);

    router.post('/products', upload.none(),products.addproducts);
    router.get('/products', isAuthorizedAdmin, products.listproducts);
    router.put('/products', upload.none(), isAuthorizedAdmin, products.editproducts);
    router.put('/statusproducts', upload.none(), isAuthorizedAdmin, products.statusproducts);
    router.delete('/deleteproducts', isAuthorizedAdmin, products.deleteproducts);

    router.post('/pointSystem', upload.none(), pointSystemController.configure);
    router.get('/pointSystem', upload.none(), pointSystemController.getConfiguration);

    router.get('/products/list', isAuthorizedAdmin, products.listactiveproducts);
    router.get('/products/transactions', pointSystemController.getProductTransactions);
    router.post('/products/purchase', upload.none(), pointSystemController.pointsRegisterPurchase);
    router.post('/pointsRedeem/step1', upload.none(), pointSystemController.pointsRedeemStep1);
    router.post('/pointsRedeem/step2', upload.none(), pointSystemController.pointsRedeemStep2);
    router.post('/pointsBalance', upload.none(), pointSystemController.getPointsBalance);
    router.post('/pointsPurchase/cancel', upload.none(), pointSystemController.cancelPointsPurchase);

    // router.post('/operators', isAuthorizedAdmin, adminController.addoperators);
    // router.get('/operators', isAuthorizedAdmin, adminController.getoperators);
    // router.put('/operators', isAuthorizedAdmin, adminController.updateoperators);
    // router.put('/operators/status', upload.none(), isAuthorizedAdmin, adminController.updateUserStatus);
    // router.delete('/operators', isAuthorizedAdmin, adminController.deleteUser);
    // router.get('/operators/details', isAuthorizedAdmin, adminController.getoperatorsDetails);   

    return router;
};

function isAuthorizedAdmin(req, res, next) {
    console.log("here");
    return next();
    // if (req.isAuthenticated()) {

    //     if (req.user.role == "1") { //1 for admin
    //         return next();
    //     } else {
    //         res.status(403).send("No access")
    //     }
    // }
}