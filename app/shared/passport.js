const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const user = require('../models/user');
const { Strategy } = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

var options = {}
options.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
options.secretOrKey = process.env['JWT_SECRET'];

passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
}, function (email, password, done) {
    
    user.User.findOne(email, function (err, result) {
        if (err) return done(err);
        if (result.length == 0) {
            return done(null, false, { message: "Invalid Credentials" })
        } else if (result[0].user_status != 1) {
            return done(null, false, { message: "Account Inactive" })
        }

        // if ((result[0].role == 2) || (result[0].role == 3))
        // {
        //     if (result[0].approved == 1) {
        //         return done(null, false, { message: "Account rejected" })
        //     }
        //     else if (result[0].approved == 2) {
        //         return done(null, false, { message: "Account under approval" })
        //     }
        // }

        bcrypt.compare(password, result[0].password, function (err, result1) {
            if (result[0].locked_status == 1) {
                return done(null, false, { message: "Account Locked" })
            } else if (!result1) 
            {
                if ((result[0].role == 2) || (result[0].role == 3) || (result[0].role == 4))
                {
                    //user.User.incerementLoginAttempt(result[0].email, function (er, resp) { })
                }                
                return done(null, false, { message: "Incorrect password" })
            }
            
            return done(null, result[0]);
        })
    })
}))

passport.use(new JwtStrategy(options, function (jwtPayload, done) {

    user.User.findById(jwtPayload.user_id, function (err, result) {
        if (err) return done(err, false);
        if (result.legth == 0) {
            return done(null, false)
        }
        return done(null, result[0])
    });
}));

passport.use('superapp', new JwtStrategy(options, function (jwtPayload, done) {

    user.SuperUser.findById(jwtPayload.id, function (err, result) {
        if (err) return done(err, false);
        if (result.legth == 0) {
            return done(null, false)
        }
        // if(result[0].role!=1){
        //     return done(null,false,{message:"Incorrect password"});
        // }        
        return done(null, result[0])
    });
}));