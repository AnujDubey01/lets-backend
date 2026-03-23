import jwt from "jsonwebtoken";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import User from "../models/user.model.js";


export const verifyJWT = asyncHandler(async (req, res, next) => {
    // 1. Get token from multiple places (clean way)
    const token =
        req.cookies?.accessToken ||
        req.headers.authorization?.replace("Bearer ", "");

    // 2. If no token
    if (!token) {
        throw new ApiError(401, "Unauthorized !! No token provided !!");
    }

    try {
        // 3. Verify token
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        const user = await User.findById(decoded?._id).select("-password -refreshToken");

        // 4. Attach user info to request
        req.user = user;

        next();
    } catch (error) {
        throw new ApiError(401, "Invalid or expired token");
    }
});


