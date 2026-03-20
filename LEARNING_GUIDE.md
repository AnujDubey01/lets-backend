# 📚 VideoBuddy Backend - Learning & Revision Guide

---

## 📁 Project Structure

```
project01/
├── src/
│   ├── controllers/       # Business logic (what happens when a route is hit)
│   ├── models/            # MongoDB schema definitions
│   ├── routes/            # URL endpoint definitions
│   ├── middleware/        # Functions that run BETWEEN request and controller
│   ├── utils/             # Reusable helper functions
│   ├── db/                # Database connection logic
│   ├── app.js             # Express app setup (middlewares, routes)
│   ├── constants.js       # App-wide constants (DB_NAME etc)
│   └── index.js           # Entry point - connects DB and starts server
├── public/temp/           # Temporary file storage (multer uploads here first)
├── .env                   # Environment variables (NEVER commit this)
├── .gitignore             # Files to ignore in git
└── package.json           # Project dependencies and scripts
```

---

## 🔑 Key Concepts & Keywords

### 1. Express Middlewares (app.js)

```js
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }))
```
- **cors** - Allows frontend (different port/domain) to talk to backend
- `credentials: true` - Allows cookies to be sent cross-origin

```js
app.use(express.json({ limit: "16kb" }))
```
- Parses incoming JSON request body
- `limit` - Prevents large payloads (security)

```js
app.use(express.urlencoded({ extended: true, limit: "16kb" }))
```
- Parses form data (HTML forms)
- `extended: true` - Allows nested objects in form data

```js
app.use(express.static("public"))
```
- Serves static files (images, css) from "public" folder

```js
app.use(cookieParser())
```
- Reads cookies from incoming requests (needed for auth)

---

### 2. asyncHandler (utils/asyncHandler.js)

```js
const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).catch(next);
    }
};
```

**Why use it?**
- Wraps every controller in a try/catch automatically
- Without it, you'd need try/catch in EVERY controller function
- `catch(next)` passes errors to Express error handler

**Usage:**
```js
const registerUser = asyncHandler(async (req, res) => {
    // no need for try/catch here!
    const user = await User.create({...})
    res.status(201).json({...})
})
```

---

### 3. ApiError (utils/ApiError.js)

```js
class ApiError extends Error {
    constructor(statusCode, message, errors = [], stack = "") {
        super(message);
        this.statusCode = statusCode;
        this.success = false;
        this.data = null;
    }
}
```

**Why use it?**
- Standardizes all error responses across the app
- Instead of `res.status(400).json({...})` everywhere, just throw an error

**Usage:**
```js
throw new ApiError(400, "All fields are required !!")
throw new ApiError(404, "User not found !!")
throw new ApiError(409, "User already exists !!")
throw new ApiError(500, "Internal server error !!")
```

**Common HTTP Status Codes:**
- `200` - OK
- `201` - Created
- `400` - Bad Request (user's fault)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (logged in but no permission)
- `404` - Not Found
`409` - Conflict (already exists)
- `500` - Internal Server Error (server's fault)

---

### 4. ApiResponse (utils/ApiResponse.js)

```js
class ApiResponse {
    constructor(statusCode, message, data) {
        this.statusCode = statusCode;
        this.message = message;
        this.data = data;
        this.success = statusCode < 400;
    }
}
```

**Why use it?**
- Standardizes all success responses
- Every response has same structure: `{ statusCode, message, data, success }`

**Usage:**
```js
res.status(201).json(new ApiResponse(201, "User registered successfully", createdUser))
```

---

### 5. Multer (middleware/multer.middleware.js)

```js
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/temp')   // save files here temporarily
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname)
    }
})

export const upload = multer({ storage })
```

**Why use it?**
- Handles file uploads (images, videos, etc.)
- `diskStorage` - saves files to disk (vs memoryStorage which saves to RAM)
- Files are saved to `public/temp` FIRST, then uploaded to Cloudinary, then deleted

**Flow:**
```
User sends file → Multer saves to public/temp → Controller uploads to Cloudinary → Delete local file
```

**Usage in routes:**
```js
router.route("/register").post(
    upload.fields([
        { name: "avatar", maxCount: 1 },
        { name: "coverImage", maxCount: 1 }
    ]),
    registerUser
)
```

**Access uploaded files in controller:**
```js
const avatarLocalPath = req.files?.avatar?.[0]?.path;
const coverImageLocalPath = req.files?.coverImage?.[0]?.path;
```

---

### 6. Cloudinary (utils/cloudnary.js)

```js
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

const uploadToCloudinary = async (filePath) => {
    try {
        if(!filePath) return null
        const response = await cloudinary.uploader.upload(filePath, { resource_type: "auto" })
        fs.unlinkSync(filePath); // delete local file after upload
        return response;
    } catch (error) {
        if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return null;
    }
}
```

**Why use it?**
- Stores images/videos on cloud (not on your server)
- Returns a URL you can save in MongoDB
- `resource_type: "auto"` - auto detects image/video/raw

**Important:** Always delete local file after uploading to cloudinary (`fs.unlinkSync`)

---

### 7. Mongoose Model (models/user.model.js)

```js
const userSchema = new Schema({
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    ...
}, { timestamps: true })
```

**Schema field options:**
- `required` - field must be present
- `unique` - no two documents can have same value
- `lowercase` - auto converts to lowercase before saving
- `trim` - removes whitespace from start/end
- `index: true` - creates DB index for faster search
- `timestamps: true` - auto adds `createdAt` and `updatedAt`

**Pre-save hook:**
```js
userSchema.pre("save", async function () {
    if(!this.isModified("password")) return; // only hash if password changed
    this.password = await bcrypt.hash(this.password, 12)
})
```
- Runs BEFORE saving to DB
- `this` refers to the document being saved
- `isModified()` - checks if a field was changed (prevents re-hashing on every save)

**Custom methods:**
```js
userSchema.methods.isPasswordCorrect = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
}
```
- Add custom methods to every document of this model
- `this` refers to the document instance

---

### 8. JWT (JSON Web Tokens)

```js
// Generate token
jwt.sign(payload, secret, { expiresIn: "1d" })

// Verify token
jwt.verify(token, secret)
```

**Two tokens used:**
- `accessToken` - Short lived (1 day), used for API requests
- `refreshToken` - Long lived (7 days), used to get new access token

**Cookie options:**
```js
const options = {
    httpOnly: true,  // JS cannot access cookie (prevents XSS attacks)
    secure: true     // Only sent over HTTPS
}
res.cookie("accessToken", accessToken, options)
```

---

### 9. MongoDB Operators

```js
// $or - match any condition
User.findOne({ $or: [{ email }, { username }] })

// $set - update specific fields
User.findByIdAndUpdate(id, { $set: { refreshToken: undefined } }, { new: true })
```

- `$or` - finds document matching ANY of the conditions
- `$set` - updates only specified fields (not the whole document)
- `{ new: true }` - returns updated document instead of old one

---

### 10. .select() - Exclude sensitive fields

```js
User.findById(user._id).select("-password -refreshToken")
```
- `-fieldname` means EXCLUDE this field from response
- Never send password or refreshToken to frontend

---

## 🔄 Request Flow (How a request travels)

```
Postman/Frontend
      ↓
  index.js (server starts)
      ↓
   app.js (middlewares applied)
      ↓
  user.routes.js (route matched)
      ↓
multer.middleware.js (file uploaded to public/temp)
      ↓
user.controller.js (business logic runs)
      ↓
  user.model.js (data saved to MongoDB)
      ↓
cloudnary.js (file uploaded to cloudinary)
      ↓
  Response sent back
```

---

## 🌿 .env Variables Explained

```
PORT=8000                          # Port server runs on
MONGODB_URI=mongodb+srv://...      # MongoDB connection string
CORS_ORIGIN=*                      # Who can access your API (* = everyone)
ACCESS_TOKEN_SECRET=...            # Secret key to sign access tokens
ACCESS_TOKEN_EXPIRES_IN=1d         # Access token expiry
REFRESH_TOKEN_SECRET=...           # Secret key to sign refresh tokens
REFRESH_TOKEN_EXPIRES_IN=7d        # Refresh token expiry
CLOUDINARY_CLOUD_NAME=...          # Cloudinary account name
CLOUDINARY_API_KEY=...             # Cloudinary API key
CLOUDINARY_API_SECRET=...          # Cloudinary API secret
```

**Tips:**
- Never commit .env to git
- Always add .env to .gitignore
- Use different .env for development and production

---

## 💡 Tips & Best Practices

1. **Always use asyncHandler** - wraps controllers to handle async errors automatically

2. **Use ApiError for all errors** - keeps error responses consistent

3. **Use ApiResponse for all success** - keeps success responses consistent

4. **Delete local files after cloudinary upload** - prevents disk space issues

5. **Never send password in response** - always use `.select("-password")`

6. **Use `isModified()` in pre-save hooks** - prevents unnecessary operations on every save

7. **Use `{ new: true }` in findByIdAndUpdate** - returns updated document

8. **Keep routes clean** - only define routes in routes file, logic goes in controllers

9. **Use constants.js** - for values used in multiple places (like DB_NAME)

10. **httpOnly cookies** - always set httpOnly: true for auth cookies to prevent XSS

---

## 🐛 Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot POST /api/v1/users/register` | Route not defined or asyncHandler not returning function | Check routes file and asyncHandler |
| `argument handler must be a function` | asyncHandler missing `return` statement | Add `return` before `(req, res, next) =>` |
| `Cannot find module` | Wrong file path or typo in filename | Check import path and filename spelling |
| `ERR_MODULE_NOT_FOUND` | Package not installed | Run `npm install <package>` |
| `Invalid cloud_name` | Wrong cloudinary credentials in .env | Get correct credentials from cloudinary dashboard |
| `next is not a function` | Using `next` in async pre-save hook | Remove `next` parameter from async hooks |
| `injecting env (0)` | .env file not found at specified path | Fix path in dotenv.config() or npm script |

---

## 📦 Packages Used & Their Purpose

| Package | Purpose |
|---------|---------|
| `express` | Web framework - handles HTTP requests |
| `mongoose` | MongoDB ODM - interact with MongoDB using JS |
| `dotenv` | Load environment variables from .env file |
| `cors` | Allow cross-origin requests (frontend to backend) |
| `cookie-parser` | Parse cookies from incoming requests |
| `bcrypt` | Hash passwords before saving to DB |
| `jsonwebtoken` | Generate and verify JWT tokens |
| `multer` | Handle file uploads |
| `cloudinary` | Upload and store files on cloud |
| `nodemon` | Auto-restart server on file changes (dev only) |
