import { MongoClient, Db } from 'mongodb';

// Check for the required environment variables.
const user = process.env.MONGODB_USER;
const pass = process.env.MONGODB_PASS;
const cluster = process.env.MONGODB_CLUSTER;
const dbName = process.env.MONGODB_DB_NAME || 'stripe-payments';

if (!user || !pass || !cluster) {
  throw new Error('Please define MONGODB_USER, MONGODB_PASS, and MONGODB_CLUSTER environment variables inside .env.local');
}

// Construct the URI, ensuring the password is properly encoded.
const uri = `mongodb+srv://${user}:${encodeURIComponent(pass)}@${cluster}/?retryWrites=true&w=majority&appName=Cluster0`;


let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(uri);

  await client.connect();
  console.log("Successfully connected to MongoDB.");

  const db = client.db(dbName);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}
