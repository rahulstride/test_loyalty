const Joi = require('joi');
function validateproducts(inputs) {
    const schema = Joi.object({
        id: Joi.number(),
        product_name: Joi.string().required(),
        quantity: Joi.number().required(),
        unit: Joi.string().valid("Litre","OMR").required(),
        number_of_points: Joi.number().required()
    });
    return schema.validate(inputs);
}

exports.validateproducts = validateproducts;