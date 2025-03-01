const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/UserModel');
const UserVerification = require('../models/UserVerification');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();
const path = require('path')

router.post('/uid_read', async (req, res) => {
    const now = new Date(); 

    // Get current time in the Philippines Time Zone (UTC+8)
    const options = {
        timeZone: 'Asia/Manila',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    
    const currentTime = new Intl.DateTimeFormat('en-US', options).format(now);

    let { UID } = req.body;
    try {
        console.log(`UID: ${UID} TIME SCANNED: ${currentTime}`);
        return res.status(200).json({
            status: "Success",
            message: `${UID} + ${currentTime}`
        });
        
    } catch (error) {
        return res.status(400).json({
            status: "Failed",
            message: `Error has occurred in UID UPLOAD`
        });
    }

});



module.exports = router;