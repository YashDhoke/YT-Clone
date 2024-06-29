// require('dotenv').config({path :'./env'}); 

import dotenv from 'dotenv' ; 
import connectDB from "./db/index.js";
import express from 'express' ; 

const app = express() ; 


dotenv.config({
    path : './env' 
})

connectDB()
.then(() => {

    app.on("error", (error) => {
        console.log("ERR: ", error);
        throw error ; 
    })

    app.listen(process.env.PORT || 8000 , () => {
        console.log(`Process is running on port : ${process.env.PORT}`)
    }) 
})
.catch((err) => {
    console.log("MONGODB connection failed" , err) ; 
})
