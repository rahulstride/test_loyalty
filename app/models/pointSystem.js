const Joi = require('joi');

function validatePointsSystem(pointSystem) {
  const schema = Joi.object({
    // pointSystem_name: Joi.string().required().label('Point System Name'),
    // base_point_value: Joi.number().positive().required().label('Base Point Value'),
    // base_aed_value: Joi.number().positive().required().label('Base AED Value'),
    redeem_point_value: Joi.number().positive().required().label('Redeem Point Value'),
    redeem_omr_value: Joi.number().positive().required().label('Redeem AED Value'),
  });

  return schema.validate(pointSystem);
}

function pointsRegisterPurchase(pointsRegisterPurchase) {
  const schema = Joi.object({
    products_data: Joi.string().required().label('Product Data'),
    phone: Joi.number().required().label('Phone'),
    total: Joi.number().positive().optional().allow('').label('Total')
  });

  return schema.validate(pointsRegisterPurchase);
}

function validatePointsRedeemStep1(pointsPurchase) {
  const schema = Joi.object({
    total: Joi.number().positive().required().label('Total'),
    points_to_redeem: Joi.number().positive().positive().label('Points to Redeem'),
    phone: Joi.number().required().label('Phone')
  });

  return schema.validate(pointsPurchase);
}

function validatePointsRedeemStep2(pointsPurchase) {
  const schema = Joi.object({
    otp: Joi.number().required().label('OTP'),
    ref_id: Joi.string().required().label('Reference ID'),
  });

  return schema.validate(pointsPurchase);
}

function validatePointsBalanceRequest(pointsPurchase) {
  const schema = Joi.object({
    phone: Joi.number().required().label('Phone'),
    //ref_id: Joi.string().required().label('Reference ID')
  });

  return schema.validate(pointsPurchase);
}

function validatePointsPurchaseCancelRequest(cancelRequest) {
  const schema = Joi.object({
    transaction_id: Joi.string().required().label('Transaction ID'),
    phone: Joi.number().required().label('Phone')
  });

  return schema.validate(cancelRequest);
}

exports.validatePointsSystem = validatePointsSystem;
exports.pointsRegisterPurchase = pointsRegisterPurchase;
exports.validatePointsRedeemStep1 = validatePointsRedeemStep1;
exports.validatePointsRedeemStep2 = validatePointsRedeemStep2;
exports.validatePointsBalanceRequest = validatePointsBalanceRequest;
exports.validatePointsPurchaseCancelRequest = validatePointsPurchaseCancelRequest;