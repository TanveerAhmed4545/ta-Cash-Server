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

    const userCollection = client.db("taCash").collection("Users");

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
    app.get("/Users", verifyToken, async (req, res) => {
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

    // Example route for user registration
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
          status: "pending", // Example: Set user status to pending for admin approval
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

      // Return user data and JWT token
      const token = jwt.sign(
        { userId: user._id },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" } // Token expires in 1 hour
      );

      res.status(200).json({ message: "Login successful", token, user });
    });

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
