
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

// User model
const User = require('../models/UserModel'); // Assuming this is correctly defined
const UserVerification = require('../models/UserVerification')

// EMAIL VERIFICATION
const nodemailer = require('nodemailer')

// Unique String
const {v4: uuidv4} = require("uuid")

require("dotenv").config();

// Path for the static verified page
const path = require('path');
const { error } = require('console');




// NodeMailer
let transporter =  nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.AUTH_EMAIL,   // Load email from environment variable
        pass: process.env.AUTH_PASS     // Corrected 'pass' for the password
    }
});



// testing
transporter.verify((error, success)=>{
    if(error){
        console.log(error)

    }else{
        console.log("Ready")
    }
})




// Sign-up route
router.post('/signup', async (req, res) => {
    let { name, email, password, dateOfBirth } = req.body;
    console.log( { name, email, password, dateOfBirth } = req.body)

    // Trim the inputs
    name = name ? name.trim() : "";
    email = email ? email.trim() : "";
    password = password ? password.trim() : "";
    dateOfBirth = dateOfBirth ? dateOfBirth.trim() : "";

    // Input validation
    if (!name || !email || !password || !dateOfBirth) {
        return res.json({
            status: "Failed",
            message: "Empty input fields"
        });
    } else if (!/^[a-zA-Z\s'-]+$/.test(name)) {
        return res.json({
            status: "Failed",
            message: "Invalid name entered"
        });
    } else if (!/^[\w.%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/i.test(email)) {
        return res.json({
            status: "Failed",
            message: "Please input a proper email"
        });
    
    } else if (isNaN(new Date(dateOfBirth).getTime())) {
        return res.json({
            status: "Failed",
            message: "Please input a valid date"
        });
    } else if (password.length < 8) {
        return res.json({
            status: "Failed",
            message: "Password must be at least 8 characters"
        });
    } else {
        try {
            // Check if the user already exists
            const existingUser = await User.find({ email });
            if (existingUser.length > 0) {
                return res.json({
                    status: "Failed",
                    message: "User credentials already exist"
                });
            }

            // Hash the password and create a new user
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            const newUser = new User({
                name,
                email,
                password: hashedPassword,
                dateOfBirth,
                verified: false
            });

            const result = await newUser.save()
            .then((result)=>{
                // Handle the account verification
                sendVerificationEmail(result,res);
            })
            // return res.json({
            //     status: "Success",
            //     message: "User successfully registered",
            //     data: result
            // });

        } catch (err) {
            console.error(err);
            return res.json({
                status: "Failed",
                message: "An error occurred during registration"
            });
        }
    }
});




const sendVerificationEmail = ({_id, email}, res)=>{
    // url to be used in the email
    const currentUrl = "http://localhost:5000/";

    const uniqueString = uuidv4() + _id;


    const mailOptions = {
        from: process.env.AUTH_EMAIL,
        to: email,
        subject: "Verify Your Email",
        html: `<p>Verify you Email Address to Complete the Signup and Login into your Account.</p> <p>This Link Expires in 6 Hours</p> <p>Press <a href=${currentUrl + "user/verify/" + _id + "/" + uniqueString}> Here</a> to proceed.</p>`,
    }
    // hash the uniqueString
    const saltRounds = 10
    bcrypt
    .hash(uniqueString, saltRounds)
    .then((hashedUniqueString) =>{
        // set values for the verification

        const newVerification = new UserVerification({
            userId: _id,
            uniqueString: hashedUniqueString,
            createdAt: Date.now(),
            expiresAt: Date.now() + 21600000,
        });


        newVerification
        .save()
        .then(()=>{
            transporter.sendMail(mailOptions)
            .then(()=>{
                // email has been sent and verification record has been saved
                return res.json({
                    status: "Pending",
                    message: "Email Verification Sent"
                })
            })
            .catch((error)=>{
                console.log(error)
                return res.json({
                    status: "Failed",
                    message: "Email Verification failed"
                });
            })
        })
        .catch((error)=>{
            console.log(error)
            return res.json({
                status: "Failed",
                message: "Verification Data Could not be saved"
            });
        })
    })
    .catch(()=>{
        return res.json({
            status: "Failed",
            message: "An error has occurred while hashing the email data"
        });
    })
}


// verify
router.get("/verify/:userId/:uniqueString",(req, res)=>{
    let {userId, uniqueString} = req.params;

    UserVerification.find({userId})
    .then((res) =>{
        if(res.length > 0){
            // User Verification exists so we proceed
            const {expiresAt} = res[0];
            const hashedUniqueString = res[0].uniqueString;


            // Checking if the uniqueSting has already expired
            if(expiresAt < Date.now()){
                // the Record is expired
                UserVerification.deleteOne({userId})
                .then(result =>{
                    User.deleteOne({_id: userId})
                    .then(()=>{
                        let message= "Link has expired. Please Sign up Again";
                        res.redirect(`/user/verified/error=true&message=${message}`);
                    })
                    .catch(error=>{
                        let message= "An Error has occurred while clearing the unique string of the user";
                        res.redirect(`/user/verified/error=true&message=${message}`);
                    })
                }

                )
                .catch((error)=>{
                    console.log(error)
                    let message= "An Error has occurred while clearing the expired user verification record.";
                    res.redirect(`/user/verified/error=true&message=${message}`);
                })


            }else{
                // Valid record exists
                
                // comparing the bashed and the received unique string
                bcrypt.compare(uniqueString, hashedUniqueString)
                .then(result =>{
                    if(result){
                        // Strings Matched
                        User.updateOne({_id: userId}, {verified : true})
                        .then(()=>{
                            UserVerification.deleteOne({userId})
                            .then(()=>{
                                res.sendFile(path.join(__dirname, "./../views/verified.html"))
                            })
                            .catch(error =>{
                                console.log(error)
                                let message= "An Error has occurred while finalizing successful verification ";
                                res.redirect(`/user/verified/error=true&message=${message}`);
                            })
                        })
                        .catch(error => {
                            console.log(error)
                            let message= "An Error has occurred while updating user record.";
                            res.redirect(`/user/verified/error=true&message=${message}`);
                        })
                    }else{
                        // Existing record but incorrect verification record
                        let message= "Invalid verification details passed. Please Check your inbox.";
                        res.redirect(`/user/verified/error=true&message=${message}`);
                    }
                })
                .catch(error =>{
                    let message= "An Error has occurred while comparing the unique Strings";
                    res.redirect(`/user/verified/error=true&message=${message}`);
                })
            }
        }else{
            // User Verification does not exist
            let message= "Account record does not exist or has been verified already. PLease Sign up or login";
            res.redirect(`/user/verified/error=true&message=${message}`);
        }
    })
    .catch((error)=>{
        console.log(error);
        let message= "An Error has occurred while checking for existing user verification.";
        res.redirect(`/user/verified/error=true&message=${message}`);
    })

})


router.get("/verified",(req,res)=>{
    res.sendFile(path.join(__dirname, "./../views/verified.html"))
})




// Sign-in route (placeholder)
router.post("/login", async (req, res) => {
    let { email, password } = req.body;
    email = email ? email.trim() : "";
    password = password ? password.trim() : "";

    if (email === "" || password === "") {
        return res.json({
            status: "Failed",
            message: "The input credentials shall not be empty, please try again"
        });
    } 

    try {
        const user = await User.find({ email });
        
        if (!user.length) {
            return res.json({
                status: "Failed",
                message: "User not found, please try again"
            });
        }
        // checking for the verification status of the user
        if(!user[0].verified){
            return res.json({
                status: "Failed",
                message: "Email Has Not Been Verified Yet. Please Check your inbox."
            });
        }else{
            
        const hashedPassword = user[0].password;

        // Compare password
        bcrypt.compare(password, hashedPassword).then((match) => {
            if (match) {
                const data = { /* Define data here, e.g., user information */ };
                return res.json({
                    status: "Success",
                    message: "User Login Success",
                    data: user
                });
            } else {
                return res.json({
                    status: "Failed",
                    message: "Invalid password, please try again"
                });
            }
        }).catch(err => {
            return res.json({
                status: "Failed",
                message: "Error occurred during password comparison"
            });
        });
        
        }
    } catch (error) {
        return res.json({
            status: "Failed",
            message: "Something went wrong while checking for existing user"
        });
    }
});


module.exports = router;
