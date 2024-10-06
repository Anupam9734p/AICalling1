
module.exports = (req, res, next) => {
    // Initialize flash messages on res.locals
    res.locals.success = null;
    res.locals.error = null;
  
    // Custom flash function for setting messages
    res.flash = (type, message) => {
      if (type === 'success') {
        res.locals.success = message;
      } else if (type === 'error') {
        res.locals.error = message;
      }
    };
    
    next();
  };
  