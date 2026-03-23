import asyncHandler from '../utils/asyncHandler.js'; 
import ApiError  from '../utils/ApiError.js';
import User from '../models/user.model.js';
import uploadToCloudinary  from '../utils/cloudnary.js';
import ApiResponse from '../utils/ApiResponse.js';
import * as jwt from 'jsonwebtoken';

const generateTokensAndSendResponse = async (user) => {
    try {
        const refreshToken = user.generateRefreshToken();
        const accessToken = user.generateAccessToken();
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });  // save on user instance, not User model

        return {
            accessToken,
            refreshToken
        }
   } catch (error) {
    console.error('Token generation error:', error);  // add this
    throw new ApiError(500, "Failed to generate tokens !!");
}
}

const registerUser = asyncHandler(async (req, res) => { 

    // get user details from frontend
    const { username, email, fullname, password } = req.body;
    console.log("User details received from frontend: ", email);

    // validation - not empty
    if(
        [username, email, fullname, password].some((field) => 
         field?.trim() === "")
    ){
        throw new ApiError(400,"All fields are required !!");
    }

    // check if user already exists: username, email
    const existedUser = await
                      User.findOne({
                    $or: [
                        { username },
                        { email }
                    ]
                })

    if(existedUser){
        throw new ApiError(409, "User already exists with the provided username or email !!");
    }
        console.log(req.files);
    // check for images, check for avatar
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar image is required !!");
    }

    // upload them to cloudinary, avatar
    const avatar = await uploadToCloudinary(avatarLocalPath);
    const coverImage = await uploadToCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400, "Failed to upload avatar image to cloudinary !!");
    }

    // create user object - create entry in db
   const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || null,
        email,
        password,
        username: username.toLowerCase()
    });

    // remove password and refresh token field from response
    const createdUser= await User.findById(user._id).select("-password -refreshToken");

    // check for user creation
    if(!createdUser){
        throw new ApiError(500, "Failed to create user !!");
    }

    // return res
    res.status(201).json(
       new ApiResponse(201, "User registered successfully !!", createdUser) 
    );


})

const loginUser = asyncHandler(async (req, res) => {

    // get email and password from frontend
    const { email, username ,password } = req.body;

    // username or email can be used for login, so we will check for both
    if(!email && !username){
        throw new ApiError(400, "Email or username is required !!");
    }   

    //find the user in db using email or username
    const user = await User.findOne({
        $or: [{email}, {username}]
    })

    if(!user){
        throw new ApiError(404, "User not found with the provided email or username !!");
    }

    // password check 
    const isPasswordCorrect = await user.isPasswordCorrect(password);

    if(!isPasswordCorrect){
        throw new ApiError(401, "Incorrect password !!");
    }

    // generate access token and refresh token
    const {accessToken , refreshToken} = await generateTokensAndSendResponse(user);

    const userWithoutSensitiveInfo = await User.findById(user._id).select("-password -refreshToken");

    //send cookies and response

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, "User logged in successfully !!", {
            accessToken,
            user: userWithoutSensitiveInfo,
            refreshToken,
            
        })
    )
})

const logoutUser = asyncHandler(async(req,res) => {
    await  User.findByIdAndUpdate(req.user._id, 
        { 
            $set: {
                refreshToken: undefined
            }
         }, 
        { new: true }
    )
     const options = {
        httpOnly: true,
        secure: true
    }
    return res
    .status(200)
   // ✅ Correct - clear cookies properly
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200, {} , "User logged out successfully !!")
    )
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized !! No refresh token provided !!");
    }

    try {
        const decoded = jwt.verify(
            incomingRefreshToken, 
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decoded?._id);

        if(!user){
            throw new ApiError(401, "Invalid refresh token !!");
        }

        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used !!");
        }

        const {accessToken, newRefreshToken} = await generateTokensAndSendResponse(user);

        const options = {
            httpOnly: true,
            secure: true
        }
        
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200, "Access token refreshed successfully !!", {
                    accessToken,
                    refreshToken : newRefreshToken
                }
            )
        )

    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token !!");
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {   
    const {oldPassword, newPassword} = req.body;

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await User.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid old password !!");
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(
        new ApiResponse(200, "Password changed successfully !!")
    )
})


const getCurrentUser = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(
        new ApiResponse(
            200, "Current user fetched successfully !!", req.user
        )
    )
})  

const updateAccountDetails = asyncHandler(async (req, res) => {
    const {fullname, email} = req.body

    if(!fullname || !email){
        throw new ApiError(400, "All fields are required !!");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                email: email
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, "Account details updated successfully !!", user)
    )
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing !!");
    }

    const avatar = await uploadToCloudinary(avatarLocalPath);

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading avatar to cloudinary !!");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, "Avatar updated successfully !!", user)
    )
})

const updateUserCover = asyncHandler(async (req, res) => {
    const CoverLocalPath = req.file?.path;

    if(!CoverLocalPath){
        throw new ApiError(400, "cover file is missing !!");
    }

    const coverImage = await uploadToCloudinary(CoverLocalPath);

    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading cover to cloudinary !!");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, "cover updated successfully !!", user)
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCover
}