const express = require("express");
const app = express();
const bcrypt = require("bcryptjs");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
  })
);
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dc9spgo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // Start

    const userCollection = client.db("taCash").collection("Users");
    const transactionsCollection = client.db("taCash").collection("history");

    // Middleware to verify token
    const verifyToken = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: "Forbidden access" });
      }
      const token = authHeader.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Forbidden access" });
        }
        req.userId = decoded.userId;
        next();
      });
    };

    //  users data
    app.get("/Users", async (req, res) => {
      console.log("Fetching user data for user ID:", req.userId);

      try {
        const user = await userCollection.findOne({
          _id: new ObjectId(req.userId),
        });
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json(user);
      } catch (error) {
        console.error("Error fetching user data:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // app.get("/Users", async (req, res) => {
    //   const result = await userCollection.find().toArray();
    //   res.send(result);
    // });

    // get a user info by email from db
    app.get("/user-role/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      res.send(result);
    });

    // get user Data
    app.get("/UsersData", verifyToken, async (req, res) => {
      const { search } = req.query;

      const query = {};
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }

      try {
        const result = await userCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // user role update

    app.patch("/users/update/:email", verifyToken, async (req, res) => {
      const { email } = req.params;
      const { role, status } = req.body;

      try {
        const user = await userCollection.findOne({ email });

        if (!user) {
          return res.status(404).send("User not found");
        }

        const update = { role, status };

        if (status === "approved" && user.status !== "approved") {
          if (role === "agent") {
            update.balance = (user.balance || 0) + 10000; // Credit 10,000 Taka to agents
          } else if (role === "user") {
            update.balance = (user.balance || 0) + 40; // Credit 40 Taka to users
          }
        }

        const result = await userCollection.updateOne(
          { email },
          { $set: update }
        );

        if (result.modifiedCount === 1) {
          res.send("User role and status updated successfully!");
        } else {
          res.status(500).send("Failed to update user role and status");
        }
      } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // send Money

    app.post("/sendMoney", verifyToken, async (req, res) => {
      const { recipientEmail, amount, pin } = req.body;
      // console.log(pin);
      try {
        // Fetch sender's details from database
        const sender = await userCollection.findOne({
          _id: new ObjectId(req.userId),
        });

        // console.log("Sender:", sender); // Log sender object for debugging
        // console.log("Sender pin:", sender.password); // Log sender object for debugging

        if (!sender || !sender.password) {
          return res
            .status(404)
            .json({ message: "Sender not found or pin is missing" });
        }

        const pinMatch = await bcrypt.compare(pin, sender.password);

        if (!pinMatch) {
          return res.status(401).json({ message: "Incorrect PIN" });
        }

        // Check minimum transaction amount
        const transactionAmount = parseInt(amount);
        if (isNaN(transactionAmount) || transactionAmount < 50) {
          return res
            .status(400)
            .json({ message: "Invalid transaction amount" });
        }

        // Calculate transaction fee
        let fee = 0;
        if (transactionAmount > 100) {
          fee = 5;
        }

        // Calculate total amount after deducting fee
        const totalAmount = transactionAmount - fee;

        // Update sender's balance
        const updatedSenderBalance = sender.balance - transactionAmount;
        if (updatedSenderBalance < 0) {
          return res.status(400).json({ message: "Insufficient balance" });
        }
        await userCollection.updateOne(
          { _id: sender._id },
          { $set: { balance: updatedSenderBalance } }
        );

        // Credit amount to recipient's balance
        const recipient = await userCollection.findOne({
          email: recipientEmail,
        });
        if (!recipient) {
          return res.status(404).json({ message: "Recipient not found" });
        }
        const updatedRecipientBalance = recipient.balance + totalAmount;
        const result = await userCollection.updateOne(
          { _id: recipient._id },
          { $set: { balance: updatedRecipientBalance } }
        );

        // Check if the update was successful
        if (result.modifiedCount === 1) {
          res.status(200).json({ message: "Transaction successful", result });
        } else {
          res.status(400).json({
            message: "Transaction failed.",
            result,
          });
        }
      } catch (error) {
        console.error("Transaction error:", error);
        res.status(500).json({ message: "Transaction failed" });
      }
    });

    // Cash Out
    app.post("/cashOut", verifyToken, async (req, res) => {
      const { recipientEmail, amount, pin } = req.body;
      try {
        // Fetch sender's details from the database
        const sender = await userCollection.findOne({
          _id: new ObjectId(req.userId),
        });

        if (!sender || !sender.password) {
          return res
            .status(404)
            .json({ message: "Sender not found or pin is missing" });
        }

        const pinMatch = await bcrypt.compare(pin, sender.password);

        if (!pinMatch) {
          return res.status(401).json({ message: "Incorrect PIN" });
        }

        // Fetch  agent details from the database
        const recipient = await userCollection.findOne({
          email: recipientEmail,
        });

        if (!recipient || recipient.role !== "agent") {
          return res.status(404).json({ message: "Agent not found" });
        }

        const transactionAmount = parseInt(amount);
        const fee = transactionAmount * 0.015;
        const totalAmountToDeduct = transactionAmount + fee;

        if (sender.balance < totalAmountToDeduct) {
          return res.status(400).json({ message: "Insufficient balance" });
        }

        // Deduct amount from sender's balance and add to recipient's balance
        const updatedSenderBalance = sender.balance - totalAmountToDeduct;
        const updatedRecipientBalance =
          recipient.balance + transactionAmount + fee;

        const result = await userCollection.updateOne(
          { _id: sender._id },
          { $set: { balance: updatedSenderBalance } }
        );

        const updateRecipient = await userCollection.updateOne(
          { _id: recipient._id },
          { $set: { balance: updatedRecipientBalance } }
        );

        if (result.modifiedCount === 1 && updateRecipient.modifiedCount === 1) {
          return res
            .status(200)
            .json({ message: "Transaction successful", result });
        } else {
          return res.status(500).json({ message: "Transaction failed" });
        }
      } catch (error) {
        console.error("Transaction error:", error);
        res.status(500).json({ message: "Transaction failed" });
      }
    });

    //user registration
    app.post("/register", async (req, res) => {
      const { name, email, phone, password } = req.body;

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      try {
        const result = await userCollection.insertOne({
          name,
          email,
          phone,
          password: hashedPassword,
          status: "pending",
          role: "user",
          balance: 0,
        });

        // Generate JWT token for authentication
        const token = jwt.sign(
          { userId: result.insertedId },
          process.env.ACCESS_TOKEN_SECRET
        );

        res
          .status(201)
          .json({ message: "User registered successfully", token });
      } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Route for user login
    app.post("/login", async (req, res) => {
      const { email, password } = req.body;

      // Find user by email
      const user = await userCollection.findOne({ email });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Compare passwords
      const passwordMatch = await bcrypt.compare(password, user.password);

      if (!passwordMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // JWT token
      const token = jwt.sign(
        { userId: user._id },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" } // Token expires in 1 hour
      );

      res.status(200).json({ message: "Login successful", token, user });
    });

    // transition history
    app.post("/historyData", async (req, res) => {
      const item = req.body;
      const historyResult = await transactionsCollection.insertOne(item);
      // res.send(paymentResult);
      const response = {
        historyResult,
      };
      res.status(200).send(response);
    });

    // transition get by email
    app.get("/history/:email", verifyToken, async (req, res) => {
      const query = {
        userEmail: req.params.email,
      };
      const result = await transactionsCollection.find(query).toArray();
      res.send(result);
    });

    // all transition
    app.get("/allHistory", verifyToken, async (req, res) => {
      const result = await transactionsCollection.find().toArray();
      res.send(result);
    });

    // End

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("taCash is running");
});

app.listen(port, () => {
  console.log(`taCash Tourist is Running on port ${port}`);
});
