import { v2 as cloudinary } from 'cloudinary'
import fs from 'fs'

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

 const uploadToCloudinary = async (filePath) => {
    try {
        if(!filePath) return null
        
        console.log('Attempting to upload file:', filePath);
        console.log('Cloudinary config:', {
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Not set',
            api_secret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Not set'
        });
        
        const response = await cloudinary.uploader.upload(filePath, { 
            resource_type: "auto"
        })
        
        fs.unlinkSync(filePath);
        console.log('Cloudinary upload response:', response.url);
        // fs.unlinkSync(filePath);
        return response;    

    } catch (error) {
       if(fs.existsSync(filePath)) {
           fs.unlinkSync(filePath);
       }
       console.error('Cloudinary upload error:', error);
       return null;
    }
}

export default uploadToCloudinary;