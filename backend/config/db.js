const mongoose = require('mongoose');
const dns = require('dns');

// Force Node.js to use Google's DNS to resolve Atlas SRV records
// (ISP DNS sometimes refuses SRV lookups)
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not set in .env');
    process.exit(1);
  }

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 20000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
      });
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      console.error(`❌ MongoDB attempt ${attempt}/${MAX_RETRIES}: ${error.message}`);
      if (attempt === MAX_RETRIES) {
        console.error(`\n⚠️  Could not connect to MongoDB Atlas after ${MAX_RETRIES} attempts.`);
        console.error(`   Check: 1) Atlas cluster is not paused  2) IP whitelist has 0.0.0.0/0\n`);
        // Don't exit — server stays up, DB routes will return 500
      } else {
        await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
    }
  }
};

module.exports = connectDB;
