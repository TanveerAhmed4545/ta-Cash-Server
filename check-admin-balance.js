const { MongoClient } = require('mongodb');
require('dotenv').config({ path: 'd:\\My Projects\\ta-cash\\ta-Cash-Server\\.env' });

async function run() {
  const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-pgkyffd-shard-00-00.dc9spgo.mongodb.net:27017,ac-pgkyffd-shard-00-01.dc9spgo.mongodb.net:27017,ac-pgkyffd-shard-00-02.dc9spgo.mongodb.net:27017/?ssl=true&replicaSet=atlas-13kwy0-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0`;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('taCash');
    const user = await db.collection('Users').findOne({ role: 'admin' });
    console.log("Admin User:", user);
  } finally {
    await client.close();
  }
}

run().catch(console.error);
