global.SlowBuffer = global.Buffer;
const express = require("express");
const app = express();
const bcrypt = require("bcryptjs");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const port = process.env.PORT || 5000;

// Configure multer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// middleware
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "https://ta-cash-client.vercel.app",
        "https://ta-cash-sigma.vercel.app",
        "https://ta-cash-server.vercel.app"
      ];
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith(".vercel.app")) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-pgkyffd-shard-00-00.dc9spgo.mongodb.net:27017,ac-pgkyffd-shard-00-01.dc9spgo.mongodb.net:27017,ac-pgkyffd-shard-00-02.dc9spgo.mongodb.net:27017/?ssl=true&replicaSet=atlas-13kwy0-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Database Collections (Initialized globally)
const userCollection = client.db("taCash").collection("Users");
const transactionsCollection = client.db("taCash").collection("history");
const transactionCollection = client.db("taCash").collection("transaction");
const activityCollection = client.db("taCash").collection("activities");
const notificationCollection = client.db("taCash").collection("notifications");
const messagesCollection = client.db("taCash").collection("messages");

// Helper for logging activities
const logActivity = async (email, desc, type = "system") => {
  try {
    await activityCollection.insertOne({
      email,
      desc,
      type,
      time: new Date()
    });
  } catch (err) {
    console.error("Activity log error:", err);
  }
};

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

// Helper for creating notifications
const createNotification = async (email, title, message, type = "info") => {
  try {
    await notificationCollection.insertOne({
      userId: email,
      title,
      message,
      type,
      isRead: false,
      timestamp: new Date()
    });
  } catch (err) {
    console.error("Notification error:", err);
  }
};

async function run() {
  try {
    // Connect the client to the server
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB Connection Error:", err);
  }
}
run().catch(console.dir);

// --- ROUTES START HERE ---

    // Get user notifications
    app.get("/notifications/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        const result = await notificationCollection
          .find({ userId: email })
          .sort({ timestamp: -1 })
          .limit(20)
          .toArray();
        res.status(200).json(result);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    // Mark all notifications as read
    app.patch("/notifications/mark-read", verifyToken, async (req, res) => {
      try {
        const { email } = req.body;
        const result = await notificationCollection.updateMany(
          { userId: email, isRead: false },
          { $set: { isRead: true } }
        );
        res.status(200).json(result);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    // Proxy image upload to ImgBB (Using user-provided key)
    app.post("/upload-image", upload.single("image"), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No image file provided" });
        }

        const IMGBB_KEY = process.env.IMGBB_KEY;
        const formData = new FormData();
        formData.append("image", req.file.buffer.toString("base64"));

        const response = await axios.post(
          `https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
            },
          }
        );

        if (response.data.success) {
          res.status(200).json({ url: response.data.data.display_url });
        } else {
          res.status(500).json({ message: "Failed to upload to ImgBB" });
        }
      } catch (error) {
        console.error("Backend ImgBB upload error:", error.response?.data || error.message);
        res.status(500).json({ message: "Internal server error" });
      }
    });

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

    // get a user info by email from db
    app.get("/user-role/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      res.send(result);
    });

    // get a user info by email from db
    app.get("/user-status/:email", verifyToken, async (req, res) => {
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

    // Get user limits and saving goals
    app.get("/user-limits/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email });
      if (!user) return res.status(404).json({ message: "User not found" });
      
      res.json({
        dailyLimit: user.dailyLimit || 20000,
        dailySpent: user.dailySpent || 0,
        savingGoals: user.savingGoals || []
      });
    });

    // Get user balance
    app.get("/user-balance/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email });
      if (!user) return res.status(404).json({ message: "User not found" });
      
      res.json({ balance: user.balance || 0 });
    });

    // Get user limits and activity stats
    app.get("/user-limits/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email });
      if (!user) return res.status(404).json({ message: "User not found" });
      
      res.json({
        dailyLimit: user.dailyLimit || 50000,
        dailySpent: user.dailySpent || 0,
        savingGoals: user.savingGoals || [
          { id: 1, title: "New Car", target: 50000, current: 15000 },
          { id: 2, title: "House Rent", target: 20000, current: 8000 }
        ]
      });
    });

    // Get recent activities (formatted history)
    app.get("/activities/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const history = await transactionsCollection
        .find({ $or: [{ userEmail: email }, { recipientEmail: email }] })
        .sort({ time: -1 })
        .limit(5)
        .toArray();
      
      const activities = history.map(item => ({
        id: item._id,
        desc: item.type === 'send-money' ? `Sent $${item.amount} to ${item.recipientEmail}` : 
              item.type === 'cash-in' ? `Received $${item.amount} via Cash-In` :
              item.type === 'cash-out' ? `Withdrew $${item.amount} via Cash-Out` :
              `Performed a ${item.type} transaction`,
        time: item.time || new Date()
      }));

      res.json(activities);
    });

    // Add a saving goal
    app.post("/saving-goals", verifyToken, async (req, res) => {
      const { email, title, target, current } = req.body;
      const newGoal = { id: new ObjectId(), title, target: parseInt(target), current: parseInt(current) };
      const result = await userCollection.updateOne(
        { email },
        { $push: { savingGoals: newGoal } }
      );
      await logActivity(email, `added a new savings goal for ${title}`, "goal");
      
      // Notification
      await createNotification(
        email,
        "New Saving Goal Created",
        `You've set a new goal: "${title}" with a target of $${target}.`,
        "info"
      );
      
      res.json({ message: "Goal added successfully", result });
    });

    // Get notifications
    app.get("/notifications/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await notificationCollection
        .find({ userId: email })
        .sort({ timestamp: -1 })
        .limit(20)
        .toArray();
      res.json(result);
    });

    // Get messages
    app.get("/messages/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await messagesCollection
        .find({ $or: [{ sender: email }, { recipient: email }] })
        .sort({ timestamp: -1 })
        .toArray();
      res.json(result);
    });

    // Send a message
    app.post("/messages", verifyToken, async (req, res) => {
      const { recipient, message, subject } = req.body;
      const sender = await userCollection.findOne({ _id: new ObjectId(req.userId) });
      
      const newMessage = {
        sender: sender.email,
        senderName: sender.name,
        recipient,
        subject: subject || "No Subject",
        message,
        isRead: false,
        timestamp: new Date()
      };

      const result = await messagesCollection.insertOne(newMessage);
      
      // Create notification for recipient
      await createNotification(
        recipient,
        "New Message",
        `You received a new message from ${sender.name}.`,
        "message"
      );

      res.status(201).json({ message: "Message sent", result });
    });

    // Mark all notifications as read
    app.patch("/notifications/mark-read", verifyToken, async (req, res) => {
      const { email } = req.body;
      const result = await notificationCollection.updateMany(
        { userId: email, isRead: false },
        { $set: { isRead: true } }
      );
      res.json(result);
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

    // Delete User/Agent
    app.delete("/users/:email", verifyToken, async (req, res) => {
      const { email } = req.params;

      try {
        // Security check: Only admins can delete users
        const requester = await userCollection.findOne({ _id: new ObjectId(req.userId) });
        if (!requester || requester.role !== "admin") {
          return res.status(403).json({ message: "Forbidden: Only admins can delete users" });
        }

        const result = await userCollection.deleteOne({ email });

        if (result.deletedCount === 1) {
          res.status(200).json({ message: "User deleted successfully" });
        } else {
          res.status(404).json({ message: "User not found" });
        }
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ message: "Internal server error" });
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
        const fee = transactionAmount > 100 ? 5 : 0;

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
          // Notifications
          await createNotification(
            sender.email, 
            "Money Sent", 
            `You sent $${totalAmount} to ${recipientEmail}. Fee: $${fee}`, 
            "send-money"
          );
          await createNotification(
            recipientEmail, 
            "Money Received", 
            `You received $${totalAmount} from ${sender.email}.`, 
            "send-money"
          );

          res
            .status(200)
            .json({ message: "Transaction successful", result, totalAmount });
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
          // Notifications
          await createNotification(
            sender.email, 
            "Cash Out Successful", 
            `You withdrew $${transactionAmount} via Agent ${recipientEmail}. Fee: $${fee}`, 
            "cash-out"
          );
          await createNotification(
            recipientEmail, 
            "Cash Out Received", 
            `User ${sender.email} cashed out $${transactionAmount} through you.`, 
            "cash-out"
          );

          return res.status(200).json({
            message: "Transaction successful",
            result,
            totalAmountToDeduct,
          });
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
        
        // Welcome Notification
        await createNotification(
          email,
          "Welcome to Ta-Cash!",
          "Thank you for joining our community. Start managing your finances today!",
          "info"
        );
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

      await logActivity(email, "logged in", "auth");
      res.status(200).json({ message: "Login successful", token, user });
    });

    // Update PIN
    app.patch("/update-pin", verifyToken, async (req, res) => {
      const { oldPin, newPin } = req.body;
      const userId = req.userId;

      try {
        const user = await userCollection.findOne({ _id: new ObjectId(userId) });
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Verify old PIN
        const isMatch = await bcrypt.compare(oldPin, user.password);
        if (!isMatch) {
          return res.status(401).json({ message: "Incorrect current PIN" });
        }

        // Validate new PIN format (5 digits)
        if (!/^\d{5}$/.test(newPin)) {
          return res.status(400).json({ message: "New PIN must be exactly 5 digits" });
        }

        // Hash and update
        const hashedPassword = await bcrypt.hash(newPin, 10);
        await userCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { password: hashedPassword, lastPinChange: new Date() } }
        );

        await logActivity(user.email, "updated security PIN", "security");
        await createNotification(
          user.email,
          "Security Update",
          "Your account PIN has been successfully updated.",
          "security"
        );

        res.status(200).json({ message: "PIN updated successfully" });
      } catch (error) {
        console.error("Error updating PIN:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Update Profile (Name/Phone)
    app.patch("/update-profile", verifyToken, async (req, res) => {
      const { name, phone, photoURL } = req.body;
      const userId = req.userId;

      try {
        const updateDoc = {};
        if (name) updateDoc.name = name;
        if (phone) updateDoc.phone = phone;
        if (photoURL) updateDoc.photoURL = photoURL;

        if (Object.keys(updateDoc).length === 0) {
          return res.status(400).json({ message: "No fields to update" });
        }

        const result = await userCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: updateDoc }
        );

        if (result.modifiedCount === 0) {
          return res.status(404).json({ message: "User not found or no changes made" });
        }

        const updatedUser = await userCollection.findOne({ _id: new ObjectId(userId) });
        res.status(200).json({ message: "Profile updated successfully", user: updatedUser });
      } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ message: "Internal server error" });
      }
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
      const email = req.params.email;
      const query = {
        $or: [{ userEmail: email }, { recipientEmail: email }],
      };
      const result = await transactionsCollection.find(query).toArray();
      res.send(result);
    });

    // all transition
    app.get("/allHistory", verifyToken, async (req, res) => {
      const result = await transactionsCollection.find().toArray();
      res.send(result);
    });

    // Cash in req
    app.post("/cashInRequest", verifyToken, async (req, res) => {
      const { userEmail, agentEmail, amount } = req.body;

      try {
        const user = await userCollection.findOne({
          _id: new ObjectId(req.userId),
        });
        const agent = await userCollection.findOne({
          email: agentEmail,
          role: "agent",
        });

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        if (!agent) {
          return res.status(404).json({ message: "Agent not found" });
        }

        const request = {
          userId: req.userId,
          agentEmail,
          userEmail,
          amount: parseInt(amount),
          status: "pending", // initial status
          type: "cash-in",
        };

        await transactionCollection.insertOne(request);

        // Notification for Agent
        await createNotification(
          agentEmail,
          "New Cash-In Request",
          `User ${userEmail} has requested a Cash-In of $${amount}.`,
          "cash-in"
        );

        res.status(200).json({ message: "Cash-in request sent successfully" });
      } catch (error) {
        console.error("Cash-in request error:", error);
        res.status(500).json({ message: "Failed to send cash-in request" });
      }
    });

    // Agent Cash in req (to Admin)
    app.post("/agentCashInRequest", verifyToken, async (req, res) => {
      const { amount } = req.body;

      try {
        const agent = await userCollection.findOne({
          _id: new ObjectId(req.userId),
        });

        if (!agent || agent.role !== "agent") {
          return res.status(403).json({ message: "Only agents can make this request" });
        }

        const request = {
          userId: req.userId,
          agentEmail: agent.email,
          userEmail: "admin", // Marking it for admin
          amount: parseInt(amount),
          status: "pending",
          type: "agent-cash-in",
          timestamp: new Date()
        };

        await transactionCollection.insertOne(request);

        // Find admins to notify
        const admins = await userCollection.find({ role: "admin" }).toArray();
        for (const admin of admins) {
          await createNotification(
            admin.email,
            "New Agent Cash-In Request",
            `Agent ${agent.email} has requested a Cash-In of $${amount}.`,
            "agent-cash-in"
          );
        }

        res.status(200).json({ message: "Request sent to Admin successfully" });
      } catch (error) {
        console.error("Agent cash-in request error:", error);
        res.status(500).json({ message: "Failed to send request" });
      }
    });

    // Fetch transactions (filtered by role)
    app.get("/transactions", verifyToken, async (req, res) => {
      try {
        const user = await userCollection.findOne({
          _id: new ObjectId(req.userId),
        });
        
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        let query = {};
        // If agent, only show their own transactions
        if (user.role === "agent") {
          query = { agentEmail: user.email };
        } 
        // If user, show their own transactions
        else if (user.role === "user") {
          query = { userEmail: user.email };
        }
        // If admin, show all (query remains {})

        const transactions = await transactionCollection.find(query).toArray();
        res.json(transactions);
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    // Manage a transaction (approve or reject cash-in)
    app.post("/manageTransaction", verifyToken, async (req, res) => {
      const { transactionId, action } = req.body;

      if (!["approve", "reject"].includes(action)) {
        return res.status(400).json({ message: "Invalid action" });
      }

      try {
        const transaction = await transactionCollection.findOne({
          _id: new ObjectId(transactionId),
        });

        if (!transaction) {
          return res.status(404).json({ message: "Transaction not found" });
        }

        if (transaction.status !== "pending") {
          return res
            .status(400)
            .json({ message: "Transaction already processed" });
        }

        if (action === "approve") {
          // Process the transaction based on type
          if (transaction.type === "agent-cash-in") {
            // Agent requested money from Admin
            const agent = await userCollection.findOne({
              email: transaction.agentEmail,
            });

            if (!agent) {
              return res.status(404).json({ message: "Agent not found" });
            }

            // Increment agent balance
            await userCollection.updateOne(
              { _id: agent._id },
              { $inc: { balance: transaction.amount } }
            );

            // Optionally deduct from admin balance here if needed
            // const admin = await userCollection.findOne({ role: "admin" });
            // await userCollection.updateOne({ _id: admin._id }, { $inc: { balance: -transaction.amount } });

          } else {
            // Regular user cash-in (requested from Agent)
            const user = await userCollection.findOne({
              _id: new ObjectId(transaction.userId),
            });
            const agent = await userCollection.findOne({
              email: transaction.agentEmail,
            });

            if (!user || !agent) {
              return res.status(404).json({ message: "User or Agent not found" });
            }

            // Check if agent has enough balance
            if (agent.balance < transaction.amount) {
              return res.status(400).json({ message: "Agent has insufficient balance" });
            }

            // Deduct from agent and add to user
            await userCollection.updateOne(
              { _id: agent._id },
              { $inc: { balance: -transaction.amount } }
            );
            await userCollection.updateOne(
              { _id: user._id },
              { $inc: { balance: transaction.amount } }
            );
          }

          transaction.status = "approved";
        } else if (action === "reject") {
          transaction.status = "rejected";
        }

        const result = await transactionCollection.updateOne(
          { _id: new ObjectId(transactionId) },
          { $set: { status: transaction.status } }
        );

        // Create Notification for User
        await createNotification(
          transaction.userEmail, 
          `Transaction ${action === 'approve' ? 'Successful' : 'Rejected'}`,
          `Your ${transaction.type} request for $${transaction.amount} has been ${action === 'approve' ? 'completed' : 'rejected'}.`,
          transaction.type
        );

        res.status(200).json({
          message: "Transaction processed successfully",
          transaction,
          result,
        });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    // End


app.get("/", (req, res) => {
  res.send("taCash is running");
});

app.listen(port, () => {
  console.log(`taCash Tourist is Running on port ${port}`);
});

module.exports = app;
