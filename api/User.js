const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/UserModel');
const UserVerification = require('../models/UserVerification');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();
const path = require('path');

// NodeMailer setup
let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.AUTH_EMAIL,
        pass: process.env.AUTH_PASS
    }
});

transporter.verify((error, success) => {
    if (error) {
        console.log(error);
    } else {
        console.log("Ready");
    }
});

// Sign-up route
router.post('/signup', async (req, res) => {
    let { name, email, password, dateOfBirth } = req.body;

    name = name ? name.trim() : "";
    email = email ? email.trim() : "";
    password = password ? password.trim() : "";
    dateOfBirth = dateOfBirth ? dateOfBirth.trim() : "";

    if (!name || !email || !password || !dateOfBirth) {
        return res.status(400).json({
            status: "Failed",
            message: "Empty input fields"
        });
    } else if (!/^[a-zA-Z\s'-]+$/.test(name)) {
        return res.status(400).json({
            status: "Failed",
            message: "Invalid name entered"
        });
    } else if (!/^[\w.%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/i.test(email)) {
        return res.status(400).json({
            status: "Failed",
            message: "Please input a proper email"
        });
    } else if (isNaN(new Date(dateOfBirth).getTime())) {
        return res.status(400).json({
            status: "Failed",
            message: "Please input a valid date"
        });
    } else if (password.length < 8) {
        return res.status(400).json({
            status: "Failed",
            message: "Password must be at least 8 characters"
        });
    } else {
        try {
            const existingUser = await User.find({ email });
            if (existingUser.length > 0) {
                return res.status(400).json({
                    status: "Failed",
                    message: "User credentials already exist"
                });
            }

            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            const newUser = new User({
                name,
                email,
                password: hashedPassword,
                dateOfBirth,
                verified: false
            });

            await newUser.save();
            sendVerificationEmail(newUser, res);

        } catch (err) {
            console.error(err);
            return res.status(500).json({
                status: "Failed",
                message: "An error occurred during registration"
            });
        }
    }
});

const sendVerificationEmail = ({ _id, email }, res) => {
    const currentUrl = "https://wattsmysplit-backend.onrender.com/";
    const uniqueString = uuidv4() + _id;

    const mailOptions = {
        from: process.env.AUTH_EMAIL,
        to: email,
        subject: "Verify Your Email",
        html: `<p>Verify your email address to complete the signup and log in to your account.</p>
               <p>This link expires in 6 hours.</p>
               <p>Press <a href="${currentUrl + "user/verify/" + _id + "/" + uniqueString}">here</a> to proceed.</p>`,
    }

    bcrypt.hash(uniqueString, 10)
        .then((hashedUniqueString) => {
            const newVerification = new UserVerification({
                userId: _id,
                uniqueString: hashedUniqueString,
                createdAt: Date.now(),
                expiresAt: Date.now() + 21600000, // 6 hours
            });

            return newVerification.save();
        })
        .then(() => transporter.sendMail(mailOptions))
        .then(() => {
            res.status(200).json({
                status: "Pending",
                message: "Email verification sent"
            });
        })
        .catch((error) => {
            console.log(error);
            res.status(500).json({
                status: "Failed",
                message: "Email verification failed"
            });
        });
}

router.get("/verify/:userId/:uniqueString", (req, res) => {
    let { userId, uniqueString } = req.params;

    UserVerification.find({ userId })
        .then((verification) => {
            if (verification.length > 0) {
                const { expiresAt } = verification[0];
                const hashedUniqueString = verification[0].uniqueString;

                if (expiresAt < Date.now()) {
                    UserVerification.deleteOne({ userId })
                        .then(() => User.deleteOne({ _id: userId }))
                        .then(() => {
                            res.redirect(`/user/verified?error=true&message=Link has expired. Please sign up again.`);
                        });
                } else {
                    bcrypt.compare(uniqueString, hashedUniqueString)
                        .then((match) => {
                            if (match) {
                                return User.updateOne({ _id: userId }, { verified: true });
                            } else {
                                res.redirect(`/user/verified?error=true&message=Invalid verification details. Please check your inbox.`);
                            }
                        })
                        .then(() => UserVerification.deleteOne({ userId }))
                        .then(() => {
                            res.sendFile(path.resolve(__dirname, "../views/verified.html"));
                        })
                        .catch((err) => {
                            console.log(err);
                            res.redirect(`/user/verified?error=true&message=Error occurred while verifying the account.`);
                        });
                }
            } else {
                res.redirect(`/user/verified?error=true&message=Account record does not exist or has already been verified.`);
            }
        })
        .catch((err) => {
            console.log(err);
            res.redirect(`/user/verified?error=true&message=Error occurred while verifying the account.`);
        });
});

router.get("/verified", (req, res) => {
    res.sendFile(path.join(__dirname, "./../views/verified.html"));
});

// Sign-in route
router.post("/login", async (req, res) => {
    let { email, password } = req.body;
    email = email ? email.trim() : "";
    password = password ? password.trim() : "";

    if (email === "" || password === "") {
        return res.status(400).json({
            status: "Failed",
            message: "The input credentials shall not be empty, please try again"
        });
    }

    try {
        const user = await User.find({ email });
        if (!user.length) {
            return res.status(401).json({
                status: "Failed",
                message: "User not found, please try again"
            });
        }

        if (!user[0].verified) {
            return res.status(401).json({
                status: "Failed",
                message: "Email has not been verified yet. Please check your inbox."
            });
        }

        const hashedPassword = user[0].password;
        bcrypt.compare(password, hashedPassword)
            .then((match) => {
                if (match) {
                    res.status(200).json({
                        status: "Success",
                        message: "User login success",
                        data: user
                    });
                } else {
                    res.status(401).json({
                        status: "Failed",
                        message: "Invalid password, please try again"
                    });
                }
            })
            .catch((err) => {
                res.status(500).json({
                    status: "Failed",
                    message: "Error occurred during password comparison"
                });
            });

    } catch (error) {
        res.status(500).json({
            status: "Failed",
            message: "Something went wrong while checking for existing user"
        });
    }
});

module.exports = router;
