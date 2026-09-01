const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./src/models/User.model');

async function findUsers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const allUsers = await User.find({}).select('email firstName lastName');
        console.log('📋 Users in CURRENT DATABASE:');
        allUsers.forEach(u => console.log(`   - ${u.email}`));
        console.log(`\n📊 Total: ${allUsers.length} users`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

findUsers();