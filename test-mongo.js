const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-pgkyffd-shard-00-00.dc9spgo.mongodb.net:27017,ac-pgkyffd-shard-00-01.dc9spgo.mongodb.net:27017,ac-pgkyffd-shard-00-02.dc9spgo.mongodb.net:27017/?ssl=true&replicaSet=atlas-13kwy0-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0`;

console.log("URI:", uri);

const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error("Connection error:", error);
  } finally {
    await client.close();
  }
}
run();
