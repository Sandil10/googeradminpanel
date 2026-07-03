const responseHandler = (res, success, message, data = null, statusCode = 200) => {
    return res.status(statusCode).json({
        success,
        message,
        data
    });
};

const success = (res, message, data = null, statusCode = 200) => {
    return responseHandler(res, true, message, data, statusCode);
};

const error = (res, message, statusCode = 500) => {
    return responseHandler(res, false, message, null, statusCode);
};

module.exports = {
    responseHandler,
    success,
    error
};
