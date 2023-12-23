
const { executeQuerySelect, executeQueryInsert, executeQueryUpdate } = require('../shared/shared-db');
const { validateproducts } = require('../models/products');
const { body, check, validationResult, Result } = require("express-validator");
const user = require('../models/user');
const Joi = require('joi');
const bcrypt = require('bcrypt');

// Add Function - addproducts

exports.addproducts = (req, res) => {

    const { error } = validateproducts(req.body);
    if (error) return res.status(400).send({ status: false, data: error, message: "failed" })

    executeQueryInsert('INSERT INTO products (product_name,quantity,unit,number_of_points,created_by,updated_by) VALUES ? ',
        [[req.body.product_name,req.body.quantity,req.body.unit,req.body.number_of_points, 1, 1]],
        function (err, result) {
            if (err) return res.status(500).send({ status: false, data: err, message: "failed" });
            return res.status(200).send({
                status: true,
                message: "success"
            });
        });
}
// Edit Function - editproducts

exports.editproducts = (req, res) => {
    const { error } = validateproducts(req.body);
    if (error) return res.status(400).send({ status: false, data: error, message: "failed" })
    executeQueryUpdate('UPDATE products SET ? where id=? and created_by = ?', [{ product_name: req.body.product_name,quantity: req.body.quantity,unit: req.body.unit,number_of_points: req.body.number_of_points, updated_by: 1 }, req.body.id, 1],
        function (err, result) {
            if (err) return res.status(500).send({ status: false, data: err, message: "failed" });
            if (result.affectedRows > 0) {
                return res.status(200).send({ status: true, message: "success" });
            } else {
                return res.status(400).send({ status: false, data: "Invalid Input", message: "failed" });
            }
        });
}
// Status Change Function - statusproducts

exports.statusproducts = (req, res) => {
    executeQueryUpdate('UPDATE products SET status=? where id=? and created_by = ?', [req.query.value, req.query.id, 1],
        function (err, result) {
            if (err) return res.status(500).send({ status: false, data: err, message: "failed" });
            return res.status(200).send({
                status: true,
                message: "success"
            });
        });
}
// Delete Function - deleteproducts

exports.deleteproducts = (req, res) => {
    executeQueryUpdate('UPDATE products SET deleted=1 where id=? and created_by = ?', [req.query.id, 1],
        function (err, result) {
            if (err) return res.status(500).send({ status: false, data: err, message: "failed" });
            return res.status(200).send({
                status: true,
                message: "success"
            });
        });
}
// Listing Function - listproducts

exports.listproducts = (req, res) => {

    let params = []
    let query1 = "select products.* from products where deleted=0 and created_by = ?"
    let query2 = "select count(*) as count from products where deleted=0 and created_by = ?"
    let query = ""

    params.push(1);

    // if (req.user.role == 3)
    //     
    // else if (req.user.role == 4) {
    //     params.push(req.user.created_by); // Location User ID
    //     query += " AND status = 1"
    // }

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
        query += " AND concat(product_name)  LIKE '%" + req.query.keyword + "%'"
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

exports.listactiveproducts = (req, res) => {

    let params = []
    let query1 = "select products.id,product_name,number_of_points from products where deleted=0 and status = 1"
    let query2 = "select count(*) as count from products where deleted=0 and status = 1"
    let query = ""

    params.push(1);

    // if (req.user.role == 3)
    //     
    // else if (req.user.role == 4) {
    //     params.push(req.user.created_by); // Location User ID
    //     query += " AND status = 1"
    // }

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
        query += " AND concat(product_name)  LIKE '%" + req.query.keyword + "%'"
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

// Details Function - detailsproducts

exports.detailsproducts = (req, res) => {

    executeQuerySelect("select * from products where id=? and created_by = ? ", [req.query.id, 1], function (err, result) {
        if (err) return res.status(500).send({ status: false, data: err, message: "Some Error Occured" });
        if (result.length > 0)
            return res.status(200).send({ status: true, data: result, message: "success" });
        else
            return res.status(200).send({ status: false, data: [], message: "No details found" });
    });
}
