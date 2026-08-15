const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../src/models/User.model');

const users = [
  {
    firstName: 'Rescue',
    lastName: 'Team',
    email: 'rescue@gmail.com',
    phoneNumber: '09123456780',
    password: 'Rescue@2024#Team',
    role: 'rescue',
    isVerified: true,
    isActive: true,
    profileImage: '',
    rescueDetails: {
      badgeNumber: 'RES-999',
      station: 'Sta. Rosa Rescue Station',
      certifications: ['BLS', 'First Aid', 'Fire Fighting'],
      available: true
    }
  }
];

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing users
    await User.deleteMany({});
    console.log('🗑️ Cleared existing users');

    // Create users
    for (const userData of users) {
      const salt = await bcrypt.genSalt(12);
      userData.password = await bcrypt.hash(userData.password, salt);
      await User.create(userData);
      console.log(`✅ Created user: ${userData.email} (${userData.role})`);
    }

    console.log('\n🎉 =====================================');
    console.log('   DATABASE SEEDING COMPLETED!');
    console.log('   =====================================\n');
    console.log('📝 RESCUE TEAM ACCOUNT:\n');
    console.log('┌─────────────────────────────────────────────────────┐');
    console.log('│ EMAIL                    │ PASSWORD               │');
    console.log('├──────────────────────────┼────────────────────────┤');
    console.log('│ rescue@gmail.com         │ Rescue@2024#Team       │');
    console.log('└──────────────────────────┴────────────────────────┘\n');
    console.log('📍 ROUTE DESTINATIONS:\n');
    console.log('   • Rescue → /dashboard\n');
    console.log('💡 NOTE: Volunteer and Civilian accounts can be created through the signup page.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

seedDatabase();