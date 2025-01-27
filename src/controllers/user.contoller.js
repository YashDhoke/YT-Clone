import { asyncHandler } from "../utils/asyncHandler.js";
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from 'jsonwebtoken' ; 

const generateAccessAndRefreshTokens = async(userId) => {
    try{
        const user = await User.findById(userId) ; 
        const accessToken = user.generateAccessToken() 
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken ; 
        await user.save({validateBeforeSave : false}) ;

        return {refreshToken , accessToken} ; 

    }catch(error){
        throw new ApiError(500 , "Something went wrong while generating refresh and access tokens")
    }
}

const registerUser = asyncHandler( async (req, res) => {

    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res


    const {fullName, email, username, password } = req.body
    // console.log("email: ", email);

    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    

    let coverImageLocalPath ; 
    
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length> 0) {
        coverImageLocalPath = req.files.coverImage[0].path ;
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email, 
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

} )

const loginUser = asyncHandler(async (req , res) => {
     // take data from the frontend . (req body)
     // username or email access 
     // find the user in the database 
     // check if the credentials are correct .
     // generate access token and refresh token , 
     // send cookies
     //successfully logged in 

     const {username , email , password} = req.body 

     if(!username && !email){
        throw new ApiError(400 , "Username or Email is required")
     }

    const user =  await User.findOne({
        $or : [{username} , {email}]
     })

     if(!user){
        throw new ApiError(404,"User does not exists!")
     }

    const isPasswordValid =  await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401 , "Invalid User credentials")
    }

    const {accessToken , refreshToken} = await generateAccessAndRefreshTokens(user._id) ; 

    const loggedInUser = await User.findById(user._id).
    select("-password -refreshToken")

    const options = {
        httponly: true,
        secure: true
    }
    
    return res
    .status (200)
    .cookie ("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json 
       (new ApiResponse (
        200,
       {
            user: loggedInUser, accessToken,
            refreshToken
       },
       "User logged in Successfully!"
           )
      )
})

const logOutUser = asyncHandler (async (req , res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
            refreshToken: undefined
        }
        },
        {
            new: true
        }
    )       
      const options = {
              httponly : true , 
              secure : true 
      }

        return res
        .status (200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json (new ApiResponse(200, {} , "User logged Out" ))
})

const refreshAccessToken = asyncHandler(async (req , res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401 , "Unauthorized request")
    }

    try{
        const decodedToken = jwt.verify(
            incomingRefreshToken , 
            process.env.REFRESH_TOKEN_SECRET
           )
           
           const user = User.findById(decodedToken?._id)
   
          if(!user){
             throw new ApiError(401 , "Invalid Refresh Token") ; 
          }
   
          if (incomingRefreshToken !== user?.refreshToken) {
           throw new ApiError(401, "Refresh token is expired or used")
       }
   
       const options = {
           httponly: true,
           secure: true
       }
   
       await generateAccessAndRefreshTokens(user._id) ; 
   
       return res
       .status (200)
       .cookie("accessToken", accessToken, options)
       .cookie("refreshToken", newRefreshToken, options)
       .json(
           new ApiResponse(
               200 , 
               {accessToken , refreshToken : newRefreshToken}, 
               "Access token refreshed"
           )
       )
    }catch(error) {
        throw new ApiError(401 , error?.message || "Invalid Refresh Token")
    }
})



export {
    registerUser, 
    loginUser , 
    logOutUser , 
    refreshAccessToken
}