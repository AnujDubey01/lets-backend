import { v2 as cloudinary } from 'cloudinary'
import fs from 'fs'

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

 const uploadToCloudinary = async (filePath) => {
    try {
        if(!filePath)return null
            // upload file to cloudinary
       
       const response = await  cloudinary.uploader.upload
       (filePath, { 
            resource_type: "auto"
        })
        // file has been uploaded to cloudinary, now we can delete the file from local storage
        console.log('Cloudinary upload response:', response.url);
        return response;    

    } catch (error) {
       fs.unlinkSync(filePath) // delete the file from local storage
       console.error('Cloudinary upload error:', error);
       return null;
    }
}

export default uploadToCloudinary;