// require('dotenv').config({path: "./.env"});

// import mongoose  from "mongoose";
// import { DB_NAME } from "./constants.js";


// in this file we are just loading the variables from .env file and connecting to the database using the connectDB function defined in db/index.js file and then exporting the connection instance for use in other parts of the application
import dotenv from "dotenv";
import app from "./app.js";



import connectDB from "./db/index.js";


dotenv.config({
        path: "../.env"
    });



connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000 , () => {
        console.log(`Server is running on port ${process.env.PORT}`);
    });
})
.catch((error) => {
    console.log("DB connection failed !! ", error);
    process.exit(1);
});


export default app;

/*
import express from "express";

const app = express();
; ( async ()=> {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        console.log("Connected to MongoDB");

        app.on("error", (error) => {
            console.error("Error in Express server:", error);
            throw error;
        });

        app.listen(process.env.PORT, () => {
            console.log(`Server is running on port ${process.env.PORT}`);
        });

    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
});

*/