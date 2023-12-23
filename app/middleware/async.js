module.exports = function (handler) {
    return  (req, res, next) => {
      try {
         handler(req, res);
      }
      catch(ex) {
        next(ex);
      }
    };  
  }