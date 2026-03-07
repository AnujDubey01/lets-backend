const asyncHandler = (requestHandler) => {
     (req, res, next) => {
  Promise.resolve(requestHandler(req, res, next))
  .catch(next);
     }
};


export default asyncHandler;

/*

const asyncHandler = (requestHandler) => async (req, res, next) 
    => {
            try {
                await requestHandler(req, res, next);
            } catch (error) {
             res.status(500).json({
                success: false,
                message: "Internal Server Error",
                error: error.message
             })
               
            }

export default asyncHandler;
*/