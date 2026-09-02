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
    { firstName: 'Mark', lastName: 'Chavez', email: 'mark.chavez@rescue.gov.ph', phoneNumber: '09123456781', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Juan', lastName: 'Dela Cruz', email: 'juan.delacruz@rescue.gov.ph', phoneNumber: '09123456782', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Ramon', lastName: 'Santos', email: 'ramon.santos@rescue.gov.ph', phoneNumber: '09123456783', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Miguel', lastName: 'Reyes', email: 'miguel.reyes@rescue.gov.ph', phoneNumber: '09123456784', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Andres', lastName: 'Gomez', email: 'andres.gomez@rescue.gov.ph', phoneNumber: '09123456785', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Pedro', lastName: 'Lopez', email: 'pedro.lopez@rescue.gov.ph', phoneNumber: '09123456786', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },

    // ==================== TEAM BETA MEMBERS (6) - ALL ARE RESPONDERS ====================
    { firstName: 'James', lastName: 'Reyes', email: 'james.reyes@rescue.gov.ph', phoneNumber: '09123456787', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Mark', lastName: 'Cruz', email: 'mark.cruz@rescue.gov.ph', phoneNumber: '09123456788', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Ramon', lastName: 'Mendoza', email: 'ramon.mendoza@rescue.gov.ph', phoneNumber: '09123456789', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Albert', lastName: 'Santos', email: 'albert.santos@rescue.gov.ph', phoneNumber: '09123456790', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Philip', lastName: 'Garcia', email: 'philip.garcia@rescue.gov.ph', phoneNumber: '09123456791', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Luz', lastName: 'Torres', email: 'luz.torres@rescue.gov.ph', phoneNumber: '09123456792', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },

    // ==================== TEAM CHARLIE MEMBERS (6) - ALL ARE RESPONDERS ====================
    { firstName: 'Jose', lastName: 'Rizal', email: 'jose.rizal@rescue.gov.ph', phoneNumber: '09123456793', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Manuel', lastName: 'Dela Cruz', email: 'manuel.delacruz@rescue.gov.ph', phoneNumber: '09123456794', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Elena', lastName: 'Gomez', email: 'elena.gomez@rescue.gov.ph', phoneNumber: '09123456795', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Carlos', lastName: 'Mendoza', email: 'carlos.mendoza@rescue.gov.ph', phoneNumber: '09123456796', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Roberto', lastName: 'Flores', email: 'roberto.flores@rescue.gov.ph', phoneNumber: '09123456800', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Sofia', lastName: 'Ramos', email: 'sofia.ramos@rescue.gov.ph', phoneNumber: '09123456801', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },

    // ==================== TEAM DELTA MEMBERS (6) - ALL ARE RESPONDERS ====================
    { firstName: 'Maria', lastName: 'Santos', email: 'maria.santos@rescue.gov.ph', phoneNumber: '09123456797', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Ana', lastName: 'Reyes', email: 'ana.reyes@rescue.gov.ph', phoneNumber: '09123456798', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Luz', lastName: 'Gomez', email: 'luz.gomez@rescue.gov.ph', phoneNumber: '09123456799', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Diego', lastName: 'Martinez', email: 'diego.martinez@rescue.gov.ph', phoneNumber: '09123456802', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Carla', lastName: 'Torres', email: 'carla.torres@rescue.gov.ph', phoneNumber: '09123456803', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' },
    { firstName: 'Paolo', lastName: 'Vince', email: 'paolo.vince@rescue.gov.ph', phoneNumber: '09123456804', password: 'Volunteer@2024#', role: 'responder', isVerified: true, isActive: true, isApproved: true, applicationStatus: 'approved' }
];

async function seedDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rescue-response-system');
        console.log('✅ Connected to MongoDB');

        // Clear existing users and teams
        await User.deleteMany({});
        await Team.deleteMany({});
        console.log('🗑️ Cleared users and teams');

        // Hash & Create Users
        const createdUsers = [];
        for (const userData of users) {
            const salt = await bcrypt.genSalt(12);
            userData.password = await bcrypt.hash(userData.password, salt);
            const user = await User.create(userData);
            createdUsers.push(user);
            console.log(`✅ Created user: ${userData.email} (${userData.role})`);
        }

        const userMap = {};
        createdUsers.forEach(u => { userMap[u.email] = u; });

        // Create Teams
        const teamDefinitions = [
            { name: 'Team Alpha', role: 'Search & Rescue', volunteerId: 'RES-001', teamLeader: userMap['mark.chavez@rescue.gov.ph']?._id, members: ['mark.chavez@rescue.gov.ph', 'juan.delacruz@rescue.gov.ph', 'ramon.santos@rescue.gov.ph', 'miguel.reyes@rescue.gov.ph', 'andres.gomez@rescue.gov.ph', 'pedro.lopez@rescue.gov.ph'].map(e => userMap[e]?._id), specialties: ['First Aid', 'BLS/CPR', 'Water Rescue'], schedule: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
            { name: 'Team Beta', role: 'Fire & Rescue', volunteerId: 'RES-002', teamLeader: userMap['james.reyes@rescue.gov.ph']?._id, members: ['james.reyes@rescue.gov.ph', 'mark.cruz@rescue.gov.ph', 'ramon.mendoza@rescue.gov.ph', 'albert.santos@rescue.gov.ph', 'philip.garcia@rescue.gov.ph', 'luz.torres@rescue.gov.ph'].map(e => userMap[e]?._id), specialties: ['First Aid', 'Fire Fighting', 'Hazmat'], schedule: ['Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
            { name: 'Team Charlie', role: 'Mountain Rescue', volunteerId: 'RES-003', teamLeader: userMap['jose.rizal@rescue.gov.ph']?._id, members: ['jose.rizal@rescue.gov.ph', 'manuel.delacruz@rescue.gov.ph', 'elena.gomez@rescue.gov.ph', 'carlos.mendoza@rescue.gov.ph', 'roberto.flores@rescue.gov.ph', 'sofia.ramos@rescue.gov.ph'].map(e => userMap[e]?._id), specialties: ['First Aid', 'Mountain Rescue', 'USAR LVL 2'], schedule: ['Mon', 'Tue', 'Thu', 'Fri', 'Sun'] },
            { name: 'Team Delta', role: 'K9 & Emergency', volunteerId: 'RES-004', teamLeader: userMap['maria.santos@rescue.gov.ph']?._id, members: ['maria.santos@rescue.gov.ph', 'ana.reyes@rescue.gov.ph', 'luz.gomez@rescue.gov.ph', 'diego.martinez@rescue.gov.ph', 'carla.torres@rescue.gov.ph', 'paolo.vince@rescue.gov.ph'].map(e => userMap[e]?._id), specialties: ['BLS/CPR', 'K9 Rescue', 'Emergency Driving'], schedule: ['Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }
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
        console.log('│ Admin       │ admin@rescue.gov.ph           │ Admin@2024#Secure            │ -           │');
        console.log('│ Responder   │ rescue@gmail.com              │ Rescue@2024#Team             │ -           │');
        console.log('│ Team Alpha  │ teamalpha@rescue.gov.ph       │ TeamAlpha@123456             │ Alpha       │');
        console.log('│ Team Beta   │ teambeta@rescue.gov.ph        │ TeamBeta@123456              │ Beta        │');
        console.log('│ Team Charlie│ teamcharlie@rescue.gov.ph     │ TeamCharlie@123456           │ Charlie     │');
        console.log('│ Team Delta  │ teamdelta@rescue.gov.ph       │ TeamDelta@123456             │ Delta       │');
        console.log('└─────────────┴───────────────────────────────┴──────────────────────────────┴─────────────┘\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding error:', error);
        process.exit(1);
    }
}

seedDatabase();