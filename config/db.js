require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI)
.then(() => {
    console.log("Database connection successful");
})
.catch((err) => {
    console.error("Database connection error: ", err);
    process.exit(1); // Exit process if connection fails
});
