const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./src/models/User.model');

const users = [
    // ==================== ADMIN ACCOUNT ====================
    {
        firstName: 'Admin',
        lastName: 'Rescue',
        email: 'admin@rescue.gov.ph',
        phoneNumber: '09123456789',
        password: 'Admin@2024#Secure',
        role: 'admin',
        isVerified: true,
        isActive: true,
        isApproved: true,
        applicationStatus: 'approved',
        profileImage: '',
        adminDetails: {
            employeeId: 'ADM-001',
            department: 'Municipal Disaster Risk Reduction and Management Office',
            position: 'MDRRMO Administrator',
            accessLevel: 'full',
            permissions: [
                'manage_users',
                'manage_incidents',
                'manage_volunteers',
                'view_reports',
                'system_settings',
                'manage_backups'
            ],
            lastLogin: new Date()
        }
    },

    // ==================== RESPONDER ACCOUNT ====================
    {
        firstName: 'Rescue',
        lastName: 'Team',
        email: 'rescue@gmail.com',
        phoneNumber: '09123456780',
        password: 'Rescue@2024#Team',
        role: 'responder',
        isVerified: true,
        isActive: true,
        isApproved: true,
        applicationStatus: 'approved',
        profileImage: '',
        responderDetails: {
            badgeNumber: 'RES-999',
            station: 'Sta. Rosa Rescue Station',
            certifications: [
                { name: 'BLS', issuedDate: new Date(), expiryDate: new Date('2025-12-31') },
                { name: 'First Aid', issuedDate: new Date(), expiryDate: new Date('2025-12-31') },
                { name: 'Fire Fighting', issuedDate: new Date(), expiryDate: new Date('2025-12-31') }
            ],
            available: true
        }
    },

    // ==================== TEAM ALPHA ====================
    {
        firstName: 'Team',
        lastName: 'Alpha',
        email: 'teamalpha@rescue.gov.ph',
        phoneNumber: '09123456790',
        password: 'TeamAlpha@123456',
        role: 'responder',
        isVerified: true,
        isActive: true,
        isApproved: true,
        applicationStatus: 'approved',
        profileImage: '',
        responderDetails: {
            badgeNumber: 'RES-001',
            station: 'Sta. Rosa Rescue Station - Alpha',
            team: 'Alpha',
            teamLeader: 'M. Chavez',
            certifications: [
                { name: 'BLS', issuedDate: new Date(), expiryDate: new Date('2025-12-31') },
                { name: 'First Aid', issuedDate: new Date(), expiryDate: new Date('2025-12-31') },
                { name: 'Water Rescue', issuedDate: new Date(), expiryDate: new Date('2025-12-31') }
            ],
            available: true
        }
    },

    // ==================== TEAM BETA ====================
    {
        firstName: 'Team',
        lastName: 'Beta',
        email: 'teambeta@rescue.gov.ph',
        phoneNumber: '09123456791',
        password: 'TeamBeta@123456',
        role: 'responder',
        isVerified: true,
        isActive: true,
        isApproved: true,
        applicationStatus: 'approved',
        profileImage: '',
        responderDetails: {
            badgeNumber: 'RES-002',
            station: 'Sta. Rosa Rescue Station - Beta',
            team: 'Beta',
            teamLeader: 'J. Reyes',
            certifications: [
                { name: 'BLS', issuedDate: new Date(), expiryDate: new Date('2025-12-31') },
                { name: 'First Aid', issuedDate: new Date(), expiryDate: new Date('2025-12-31') },
                { name: 'Fire Fighting', issuedDate: new Date(), expiryDate: new Date('2025-12-31') }
            ],
            available: true
        }
    },

    // ==================== TEAM CHARLIE ====================
    {
        firstName: 'Team',
        lastName: 'Charlie',
        email: 'teamcharlie@rescue.gov.ph',
        phoneNumber: '09123456792',
        password: 'TeamCharlie@123456',
        role: 'responder',
        isVerified: true,
        isActive: true,
        isApproved: true,
        applicationStatus: 'approved',
        profileImage: '',
        responderDetails: {
            badgeNumber: 'RES-003',
            station: 'Sta. Rosa Rescue Station - Charlie',
            team: 'Charlie',
            teamLeader: 'A. Santos',
            certifications: [
                { name: 'BLS', issuedDate: new Date(), expiryDate: new Date('2025-12-31') },
                { name: 'First Aid', issuedDate: new Date(), expiryDate: new Date('2025-12-31') },
                { name: 'Mountain Rescue', issuedDate: new Date(), expiryDate: new Date('2025-12-31') }
            ],
            available: true
        }
    },

    // ==================== TEAM DELTA ====================
    {
        firstName: 'Team',
        lastName: 'Delta',
        email: 'teamdelta@rescue.gov.ph',
        phoneNumber: '09123456793',
        password: 'TeamDelta@123456',
        role: 'responder',
        isVerified: true,
        isActive: true,
        isApproved: true,
        applicationStatus: 'approved',
        profileImage: '',
        responderDetails: {
            badgeNumber: 'RES-004',
            station: 'Sta. Rosa Rescue Station - Delta',
            team: 'Delta',
            teamLeader: 'R. Cruz',
            certifications: [
                { name: 'BLS', issuedDate: new Date(), expiryDate: new Date('2025-12-31') },
                { name: 'First Aid', issuedDate: new Date(), expiryDate: new Date('2025-12-31') },
                { name: 'K9 Rescue', issuedDate: new Date(), expiryDate: new Date('2025-12-31') }
            ],
            available: true
        }
    }
];

async function seedDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rescue-response-system');
        console.log('✅ Connected to MongoDB');

        // Process each user
        for (const userData of users) {
            // Check if user already exists
            const existingUser = await User.findOne({ email: userData.email });

            if (existingUser) {
                console.log(`⚠️ User ${userData.email} already exists. Updating...`);

                const salt = await bcrypt.genSalt(12);
                const hashedPassword = await bcrypt.hash(userData.password, salt);

                existingUser.password = hashedPassword;
                existingUser.isActive = true;
                existingUser.isApproved = true;
                existingUser.applicationStatus = 'approved';
                existingUser.role = userData.role;

                // Update role-specific details
                if (userData.adminDetails) {
                    existingUser.adminDetails = userData.adminDetails;
                }
                if (userData.responderDetails) {
                    existingUser.responderDetails = userData.responderDetails;
                }

                await existingUser.save();
                console.log(`✅ Updated user: ${userData.email} (${userData.role})`);
            } else {
                // Create new user
                const salt = await bcrypt.genSalt(12);
                userData.password = await bcrypt.hash(userData.password, salt);
                await User.create(userData);
                console.log(`✅ Created user: ${userData.email} (${userData.role})`);
            }
        }

        console.log('\n🎉 =============================================');
        console.log('   DATABASE SEEDING COMPLETED!');
        console.log('   =============================================\n');

        console.log('📝 ACCOUNT CREDENTIALS:\n');
        console.log('┌──────────────────────────────────────────────────────────────────────────────────────────────┐');
        console.log('│ ROLE        │ EMAIL                         │ PASSWORD                     │ TEAM        │');
        console.log('├─────────────┼───────────────────────────────┼──────────────────────────────┼─────────────┤');
        console.log('│ Admin       │ admin@rescue.gov.ph           │ Admin@2024#Secure            │ -           │');
        console.log('│ Responder   │ rescue@gmail.com              │ Rescue@2024#Team             │ -           │');
        console.log('│ Team Alpha  │ teamalpha@rescue.gov.ph       │ TeamAlpha@123456             │ Alpha       │');
        console.log('│ Team Beta   │ teambeta@rescue.gov.ph        │ TeamBeta@123456              │ Beta        │');
        console.log('│ Team Charlie│ teamcharlie@rescue.gov.ph     │ TeamCharlie@123456           │ Charlie     │');
        console.log('│ Team Delta  │ teamdelta@rescue.gov.ph       │ TeamDelta@123456             │ Delta       │');
        console.log('└─────────────┴───────────────────────────────┴──────────────────────────────┴─────────────┘\n');

        console.log('🛡️  Admin Permissions:');
        console.log('   ✓ Manage Users');
        console.log('   ✓ Manage Incidents');
        console.log('   ✓ Manage Volunteers');
        console.log('   ✓ View Reports');
        console.log('   ✓ System Settings');
        console.log('   ✓ Manage Backups\n');

        console.log('🚒  Rescue Teams:');
        console.log('   🔹 Team Alpha   - Team Leader: M. Chavez');
        console.log('   🔹 Team Beta    - Team Leader: J. Reyes');
        console.log('   🔹 Team Charlie - Team Leader: A. Santos');
        console.log('   🔹 Team Delta   - Team Leader: R. Cruz\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding error:', error);
        process.exit(1);
    }
}

seedDatabase();