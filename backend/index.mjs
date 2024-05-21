import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import jwt from "jsonwebtoken";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import PDFDocument from "pdfkit";

import fs from "fs";

import { constants } from "buffer";

import nodemailer from "nodemailer";
const app = express();
const port = 4000;
app.use(express.json());
app.use(cors());// Allow Cross-Origin Resource Sharing (CORS)
dotenv.config()
//rental system
app.post("/rental", async (req, res) => {
  try {
    const { rentalPeriod, productId } = req.body;

    const startDate = new Date(rentalPeriod.startDate).toISOString().split('T')[0];
    const endDate = new Date(rentalPeriod.endDate).toISOString().split('T')[0];

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        $set: {
          'rentalPeriod.startDate': startDate,
          'rentalPeriod.endDate': endDate,
        },
      },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json({ rentalPeriod: updatedProduct.rentalPeriod, productId });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: error.message }); // Log the detailed error message
  }
});



const online = async () => {
  try {
    // Find the recently added user by sorting the documents based on the date field in descending order
    const recentlyAddedUser = await Users.findOne().sort({ date: -1 });

    if (!recentlyAddedUser) {
      console.error("No users found");
      return null; // Return null if no user found
    }

    // Return the email of the recently added user
    return recentlyAddedUser.email;
  } catch (error) {
    console.error("Error occurred while fetching recently added user:", error);
    throw error; // Throw the error to be caught by the caller
  }
};

app.post("/checkout", async (req, res) => {
  try {
    // Get the email of the recently added user
    const userEmail = await online();

    console.log(userEmail)

    if (!userEmail) {
      return res.status(404).json({ error: "No users found" });
    }

    const obj = req.body;
    const products = obj.products;

    // Fetch rentalPeriod data for each product
    for (let i = 0; i < products.length; i++) {
      const id = products[i]._id;
      const product = await Product.findOne({ _id: id });
      if (product) {
        products[i].rentalPeriod = product.rentalPeriod; // Replace rentalPeriod with fetched data
      }
    }

    console.log(obj.products[0]);

    // Send response to the client
    res.status(200).json({
      response: {
        Status: "Item order successfully",
        Info: "Order receipt sent to your email",
        obj
      }
    });

    console.log("Data sent successfully");

    // Call the function to send email with the user's email
    sendMail(obj, userEmail);
  } catch (error) {
    console.error("Error occurred during checkout:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


async function sendMail(orderDetails) {
  try {
    // Calculate total amount payable in dollars
    const totalAmountRupees = orderDetails.products.reduce((total, item) => total + parseFloat(item.new_price), 0);



    // Create a PDF document
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream("receipt.pdf"));

    // Set up PDF styling
    doc.font("Helvetica-Bold");
    doc.fontSize(24);
    doc.text("Ordered Items Receipt", { align: "center" });
    doc.moveDown();

    // Write checkout details
    doc.fillColor("#333").text("Checkout Details:");
    doc.fillColor("#333").text(`Name: ${orderDetails.name}`);
    doc.fillColor("#333").text(`Email: ${orderDetails.email}`);
    doc.fillColor("#333").text(`Address: ${orderDetails.address}`);
    doc.fillColor("#333").text(`City: ${orderDetails.city}`);
    doc.fillColor("#333").text(`State: ${orderDetails.state}`);
    doc.fillColor("#333").text(`Zip: ${orderDetails.zip}`);

    doc.moveDown();

    // Write content for each product
    doc.fillColor("#333").text("Ordered Products:");
    orderDetails.products.forEach((product, index) => {
      const imageUrl = product.image.substring(7);
      doc.fillColor("#333").text(`Item ${index + 1}:`);
      doc.fillColor("#333").text(`Name: ${product.name}`);
      doc.fillColor("#333").text(`ID: ${product.id}`);
      if (product.rental) { // Check if the product is a rental
        doc.fillColor("#333").text(`Rental period: ${product.rentalPeriod.startDate} - ${product.rentalPeriod.endDate}`);
      }

      doc.fillColor("#333").text(`Price: ${totalAmountRupees}`);
      doc.fillColor("#333").text(`Image: ${imageUrl}`);
      doc.moveDown();
    });

    // Display total amount payable in rupees
    doc.fillColor("#333").text(`Total Amount Payable: ₹${totalAmountRupees.toFixed(2)}`, { align: "right" });

    // End the PDF document
    doc.end();

    // Create a Nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "harshmultiuser@gmail.com",
        pass: "hrhuqcjhgpnvbxlc",
      },
    });

    // Construct the email content
    const mailOptions = {
      from: 'harshmultiuser@gmail.com',
      to: `${orderDetails.email}`,
      subject: 'Products Information from Shophub',
      html: `
            <div style="font-family: Arial, sans-serif; font-size: 16px; color: #333; line-height: 1.6;">
                <p>Dear Customer,</p>
                <p>We are delighted to inform you about the following purchases:</p>
                <p>Please find the attached PDF receipt for your ordered items.</p>
                <p>Total Amount Payable: ₹${totalAmountRupees.toFixed(2)}</p>
                <p>Thank you for choosing Shophub!</p>
                <p><strong>Your items will be dispatched within 0-7 business days.</strong></p>
            </div>
        `,
      attachments: [
        {
          filename: "receipt.pdf",
          path: "receipt.pdf",
        },
      ],
    };

    // Send email with PDF attachment
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.response);
  } catch (error) {
    console.error("Error occurred while sending email:", error);
  }
}
//databave connection

const URI =
  "mongodb+srv://swapnilsks123ss:rkQYXQ5xszk8OE64@cluster0.4egkvfz.mongodb.net/Ecommerce";
console.log("MongoDB connection URI:", URI);
mongoose.connect(URI, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", function () {
  console.log("Connected to MongoDB Atlas");
});

//Api Creation

app.get("/", (req, res) => {

  res.send("Hello World!");
});

// Set up storage engine
const storage = multer.diskStorage({
  destination: './upload/images', // Folder to store the uploaded files
  filename: function (req, file, cb) {
    // Generate a unique file name using file's original name with the extension
    cb(
      null,
      `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

// Initialize upload with the storage engine
const upload = multer({ storage: storage });

// Serve static files from the 'upload/images' directory
app.use('/images', express.static('./upload/images'));

// Create upload endpoint for images
app.post('/upload', upload.single('product'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: 0, message: 'No file uploaded' });
  }
  res.json({
    success: 1,
    image_url: `http://localhost:${port}/images/${req.file.filename}`,
  });
});

//Schema for creating products

const Product = mongoose.model("Product", {
  id: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  new_price: {
    type: Number,
    required: true,
  },
  old_price: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  available: {
    type: Boolean,
    default: true,
  },
  isRental: {
    type: Boolean,
    default: false, // Default to false for non-rental products
  },
  rentalPeriod: {
    startDate: {
      type: String,
      default: null,
    },
    endDate: {
      type: String,
      default: null,
    },
  },
});


// Add Product

app.post("/addProduct", async (req, res) => {
  try {
    // Fetch all products to determine the next ID
    let products = await Product.find({});
    let id;
    if (products.length > 0) {
      let last_product = products[products.length - 1];
      id = last_product.id + 1;
    } else {
      id = 1;
    }

    // Extract product details from the request body
    const { name, image, category, new_price, old_price, isRental, rentalPeriod } = req.body;

    // Create a new product object
    const product = new Product({
      id: id,
      name: name,
      image: image,
      category: category,
      new_price: new_price,
      old_price: old_price,
      available: true,
      isRental: isRental,

    });

    console.log(product);

    // Save the product to the database
    await product.save();
    console.log("saved");

    // Respond with success
    res.json({
      success: true,
      name: name,
    });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


//Schema for creating user model
const Users = mongoose.model("User", {
  name: {
    type: String,
  },
  email: {
    type: String,
    unique: true,
  },
  password: {
    type: String,
  },
  cartData: {
    type: Object,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

//creating api to delete product

app.post("/removeProduct", async (req, res) => {
  await Product.findOneAndDelete({ id: req.body.id });
  console.log("removed");
  res.json({
    succsess: true,
    name: req.body.name,
  });
});
app.get("/allProds", async (req, res) => {
  const data = await Product.find();
  console.log("All products fetched");
  res.send(data);
});
//Creating Endpoint for registering the user
app.post('/signup', async (req, res) => {
  let check = await Users.findOne({ email: req.body.email })
  if (check) {
    return res.status(400).json({ success: false, errors: "existing user" })
  }
  let cart = {}
  for (let i = 0; i < 300; i++) {
    cart[i] = 0;

  }
  const user = new Users({
    name: req.body.username,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  })
  await user.save();
  const data = {
    user: {
      id: user.id,
    }
  }
  const token = jwt.sign(data, 'secret_ecom');
  res.status(200).json({ success: true, token })
  console.log("User added successfully")
})
app.post('/login', async (req, res) => {
  let user = await Users.findOne({ email: req.body.email });
  if (user) {
    const passCompare = req.body.password === user.password;
    if (passCompare) {
      const data = {
        user: {
          id: user.id,
        }
      }
      const token = jwt.sign(data, 'secret_ecom')
      res.json({ success: true, token: 'Bearer ' + token })
    }
    else {
      res.json({ success: false, errors: "Wrong Password" });
    }
  }
  else {
    res.status(400).json({ success: false, errors: "Wrong Email id" });
  }
})
app.get('/newcollections', async (req, res) => {
  let products = await Product.find({})
  let newcollection = products.slice(1).slice(-8);
  console.log("NewCollection Fetched")
  res.send(newcollection);

})

app.get("/popularinwomen", async (req, res) => {
  let products = await Product.find({ category: "women" });
  let popular_in_women = products.slice(0, 4);
  console.log("Popular in women fetched");
  res.send(popular_in_women);
});
const fetchUser = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) {
    return res.status(401).json({ msg: "No Token Provided" });
  } else {
    try {
      const verifiedToken = jwt.verify(token, "secret_ecom");
      // Assuming the payload structure contains user.id
      req.user = verifiedToken;
      // res.status(200).json({ verified });
      next();
    } catch (err) {
      res.status(401).json({ msg: "Token is not Valid" });
    }
  }
};

app.post('/addtocart', fetchUser, async (req, res) => {
  try {
    console.log("Added", req.body.itemId);
    let userData = await Users.findOne({ _id: req.user.id });
    console.log(userData);

    if (!userData) {
      return res.status(404).json({ error: "User not found" });
    }

    if (userData.cartData[req.body.itemId] > 0) {
      userData.cartData[req.body.itemId] += 1;
    } else {
      userData.cartData[req.body.itemId] = 1;
    }

    await Users.findByIdAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
    res.status(200).json({ message: "Added", userData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


app.post("/getcart", fetchUser, async (req, res) => {
  console.log("Getcart");
  let userData = await Users.findOne({ _id: req.user.id });
  res.json(userData.cartData);
});

app.post("/removefromcart", fetchUser, async (req, res) => {
  console.log("removed", req.body.itemId);
  let userData = await Users.findOne({ _id: req.user.id });
  if (userData.cartData[req.body.itemId] > 0)
    userData.cartData[req.body.itemId] -= 1;
  await Users.findByIdAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.status(200)("Added");
});
app.listen(port, (error) => {
  if (!error) {
    console.log(`Server is running on ${port}`)
  } else {
    console.log(`Error : ${error}`);
  }
});
