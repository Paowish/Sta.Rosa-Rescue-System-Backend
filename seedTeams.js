const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./src/models/User.model');
const Team = require('./src/models/Team.model');

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

    // ==================== TEAM ALPHA MEMBERS (6) - ALL ARE RESPONDERS ====================
    { firstName: 'Mark', lastName: 'Chavez', email: 'mark.chavez@gmail.com', phoneNumber: '09123456781', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Juan', lastName: 'Dela Cruz', email: 'juan.delacruz@gmail.com', phoneNumber: '09123456782', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Ramon', lastName: 'Santos', email: 'ramon.santos@gmail.com', phoneNumber: '09123456783', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Miguel', lastName: 'Reyes', email: 'miguel.reyes@gmail.com', phoneNumber: '09123456784', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Andres', lastName: 'Gomez', email: 'andres.gomez@gmail.com', phoneNumber: '09123456785', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Pedro', lastName: 'Lopez', email: 'pedro.lopez@gmail.com', phoneNumber: '09123456786', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },

    // ==================== TEAM BETA MEMBERS (6) - ALL ARE RESPONDERS ====================
    { firstName: 'James', lastName: 'Reyes', email: 'james.reyes@gmail.com', phoneNumber: '09123456787', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Mark', lastName: 'Cruz', email: 'mark.cruz@gmail.com', phoneNumber: '09123456788', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Ramon', lastName: 'Mendoza', email: 'ramon.mendoza@gmail.com', phoneNumber: '09123456789', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Albert', lastName: 'Santos', email: 'albert.santos@gmail.com', phoneNumber: '09123456790', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Philip', lastName: 'Garcia', email: 'philip.garcia@gmail.com', phoneNumber: '09123456791', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Luz', lastName: 'Torres', email: 'luz.torres@gmail.com', phoneNumber: '09123456792', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },

    // ==================== TEAM CHARLIE MEMBERS (6) - ALL ARE RESPONDERS ====================
    { firstName: 'Jose', lastName: 'Rizal', email: 'jose.rizal@gmail.com', phoneNumber: '09123456793', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Manuel', lastName: 'Dela Cruz', email: 'manuel.delacruz@gmail.com', phoneNumber: '09123456794', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Elena', lastName: 'Gomez', email: 'elena.gomez@gmail.com', phoneNumber: '09123456795', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Carlos', lastName: 'Mendoza', email: 'carlos.mendoza@gmail.com', phoneNumber: '09123456796', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Roberto', lastName: 'Flores', email: 'roberto.flores@gmail.com', phoneNumber: '09123456800', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Sofia', lastName: 'Ramos', email: 'sofia.ramos@gmail.com', phoneNumber: '09123456801', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },

    // ==================== TEAM DELTA MEMBERS (6) - ALL ARE RESPONDERS ====================
    { firstName: 'Maria', lastName: 'Santos', email: 'maria.santos@gmail.com', phoneNumber: '09123456797', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Ana', lastName: 'Reyes', email: 'ana.reyes@gmail.com', phoneNumber: '09123456798', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Luz', lastName: 'Gomez', email: 'luz.gomez@gmail.com', phoneNumber: '09123456799', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Diego', lastName: 'Martinez', email: 'diego.martinez@gmail.com', phoneNumber: '09123456802', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Carla', lastName: 'Torres', email: 'carla.torres@gmail.com', phoneNumber: '09123456803', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Paolo', lastName: 'Vince', email: 'paolo.vince@gmail.com', phoneNumber: '09123456804', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' }
];

// ==================== YOUR EXISTING USERS TO KEEP ====================
const existingUsersToKeep = [
    // Civilian
    { email: 'sanshimii@gmail.com' },
    { email: 'paolocarunia139@gmail.com' },

    // Volunteers
    { email: 'verdilloalii@gmail.com' },
    { email: 'caruniapaolovince@gmail.com' },
    { email: 'allyearchive@gmail.com' },
    { email: 'hikasarchives@gmail.com' },
    { email: 'aliisakaida@gmail.com' }
];

async function seedDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rescue-response-system');
        console.log('✅ Connected to MongoDB');

        // ✅ DO NOT delete all users!
        // Instead, only delete users with fake emails (@rescue.gov.ph)
        const fakeEmailResult = await User.deleteMany({
            email: { $regex: '@(rescue\\.gov\\.ph|volunteer\\.com)$', $options: 'i' }
        });
        console.log(`🗑️ Deleted ${fakeEmailResult.deletedCount} fake email users`);

        // ✅ Also delete old Teams (will recreate them)
        await Team.deleteMany({});
        console.log('🗑️ Cleared teams');

        // ✅ Hash & Create Users (only if they don't already exist)
        const createdUsers = [];
        for (const userData of users) {
            // Check if user already exists
            const existingUser = await User.findOne({ email: userData.email });
            if (existingUser) {
                console.log(`⚠️ User already exists: ${userData.email} - skipping`);
                createdUsers.push(existingUser);
                continue;
            }

            const salt = await bcrypt.genSalt(12);
            userData.password = await bcrypt.hash(userData.password, salt);
            const user = await User.create(userData);
            createdUsers.push(user);
            console.log(`✅ Created user: ${userData.email} (${userData.role})`);
        }

        // ✅ Keep existing users (civilians & volunteers)
        for (const keepUser of existingUsersToKeep) {
            const user = await User.findOne({ email: keepUser.email });
            if (user) {
                console.log(`✅ Keeping user: ${keepUser.email} (${user.role})`);
            } else {
                console.log(`⚠️ User not found: ${keepUser.email}`);
            }
        }

        const userMap = {};
        createdUsers.forEach(u => { userMap[u.email] = u; });

        // ✅ Also add existing users to userMap
        for (const keepUser of existingUsersToKeep) {
            const user = await User.findOne({ email: keepUser.email });
            if (user) {
                userMap[user.email] = user;
            }
        }

        // Create Teams
        const teamDefinitions = [
            { name: 'Team Alpha', role: 'Search & Rescue', volunteerId: 'RES-001', teamLeader: userMap['mark.chavez@gmail.com']?._id, members: ['mark.chavez@gmail.com', 'juan.delacruz@gmail.com', 'ramon.santos@gmail.com', 'miguel.reyes@gmail.com', 'andres.gomez@gmail.com', 'pedro.lopez@gmail.com'].map(e => userMap[e]?._id), specialties: ['First Aid', 'BLS/CPR', 'Water Rescue'], schedule: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
            { name: 'Team Beta', role: 'Fire & Rescue', volunteerId: 'RES-002', teamLeader: userMap['james.reyes@gmail.com']?._id, members: ['james.reyes@gmail.com', 'mark.cruz@gmail.com', 'ramon.mendoza@gmail.com', 'albert.santos@gmail.com', 'philip.garcia@gmail.com', 'luz.torres@gmail.com'].map(e => userMap[e]?._id), specialties: ['First Aid', 'Fire Fighting', 'Hazmat'], schedule: ['Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
            { name: 'Team Charlie', role: 'Mountain Rescue', volunteerId: 'RES-003', teamLeader: userMap['jose.rizal@gmail.com']?._id, members: ['jose.rizal@gmail.com', 'manuel.delacruz@gmail.com', 'elena.gomez@gmail.com', 'carlos.mendoza@gmail.com', 'roberto.flores@gmail.com', 'sofia.ramos@gmail.com'].map(e => userMap[e]?._id), specialties: ['First Aid', 'Mountain Rescue', 'USAR LVL 2'], schedule: ['Mon', 'Tue', 'Thu', 'Fri', 'Sun'] },
            { name: 'Team Delta', role: 'K9 & Emergency', volunteerId: 'RES-004', teamLeader: userMap['maria.santos@gmail.com']?._id, members: ['maria.santos@gmail.com', 'ana.reyes@gmail.com', 'luz.gomez@gmail.com', 'diego.martinez@gmail.com', 'carla.torres@gmail.com', 'paolo.vince@gmail.com'].map(e => userMap[e]?._id), specialties: ['BLS/CPR', 'K9 Rescue', 'Emergency Driving'], schedule: ['Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }
        ];

        for (const teamData of teamDefinitions) {
            if (!teamData.teamLeader) {
                console.log(`⚠️ Skipping ${teamData.name}: No leader found`);
                continue;
            }
            await Team.create(teamData);
            console.log(`✅ Created team: ${teamData.name}`);
        }

        console.log('\n🎉 =============================================');
        console.log('   DATABASE SEEDING COMPLETED!');
        console.log('   =============================================\n');

        console.log('📝 ACCOUNT CREDENTIALS:\n');
        console.log('┌──────────────────────────────────────────────────────────────────────────────────────────────┐');
        console.log('│ ROLE        │ EMAIL                         │ PASSWORD                     │ TEAM        │');
        console.log('├─────────────┼───────────────────────────────┼──────────────────────────────┼─────────────┤');
        console.log('│ Admin       │ admin@rescue.gov.ph        │ Admin@2024#Secure            │ -           │');
        console.log('│ Responder   │ rescue@gmail.com         │ Rescue@2024#Team             │ -           │');
        console.log('│ Team Alpha  │ mark.chavez@gmail.com         │ Volunteer@2024#              │ Alpha       │');
        console.log('│ Team Beta   │ james.reyes@gmail.com         │ Volunteer@2024#              │ Beta        │');
        console.log('│ Team Charlie│ jose.rizal@gmail.com          │ Volunteer@2024#              │ Charlie     │');
        console.log('│ Team Delta  │ maria.santos@gmail.com        │ Volunteer@2024#              │ Delta       │');
        console.log('│ Civilian    │ sanshimii@gmail.com           │ (existing)                   │ -           │');
        console.log('│ Civilian    │ paolocarunia139@gmail.com     │ (existing)                   │ -           │');
        console.log('│ Volunteer   │ verdilloalii@gmail.com        │ (existing)                   │ -           │');
        console.log('│ Volunteer   │ caruniapaolovince@gmail.com   │ (existing)                   │ -           │');
        console.log('│ Volunteer   │ allyearchive@gmail.com        │ (existing)                   │ -           │');
        console.log('│ Volunteer   │ hikasarchives@gmail.com       │ (existing)                   │ -           │');
        console.log('│ Volunteer   │ aliisakaida@gmail.com         │ (existing)                   │ -           │');
        console.log('└─────────────┴───────────────────────────────┴──────────────────────────────┴─────────────┘\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding error:', error);
        process.exit(1);
    }
}

seedDatabase();