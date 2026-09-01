const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./src/models/User.model');
const Team = require('./src/models/Team.model');

const users = [
    { firstName: 'Mark', lastName: 'Chavez', email: 'mark.chavez@volunteer.com', phoneNumber: '09123456781', password: 'Volunteer@2024#', role: 'volunteer', isVerified: true, isActive: true, isApproved: true },
    { firstName: 'Juan', lastName: 'Dela Cruz', email: 'juan.delacruz@volunteer.com', phoneNumber: '09123456782', password: 'Volunteer@2024#', role: 'volunteer', isVerified: true, isActive: true, isApproved: true },
    { firstName: 'Ramon', lastName: 'Santos', email: 'ramon.santos@volunteer.com', phoneNumber: '09123456783', password: 'Volunteer@2024#', role: 'volunteer', isVerified: true, isActive: true, isApproved: true },
    { firstName: 'Miguel', lastName: 'Reyes', email: 'miguel.reyes@volunteer.com', phoneNumber: '09123456784', password: 'Volunteer@2024#', role: 'volunteer', isVerified: true, isActive: true, isApproved: true },
    { firstName: 'Andres', lastName: 'Gomez', email: 'andres.gomez@volunteer.com', phoneNumber: '09123456785', password: 'Volunteer@2024#', role: 'volunteer', isVerified: true, isActive: true, isApproved: true },
    { firstName: 'Pedro', lastName: 'Lopez', email: 'pedro.lopez@volunteer.com', phoneNumber: '09123456786', password: 'Volunteer@2024#', role: 'volunteer', isVerified: true, isActive: true, isApproved: true },

    { firstName: 'James', lastName: 'Reyes', email: 'james.reyes@volunteer.com', phoneNumber: '09123456787', password: 'Volunteer@2024#', role: 'volunteer', isVerified: true, isActive: true, isApproved: true },
    { firstName: 'Mark', lastName: 'Cruz', email: 'mark.cruz@volunteer.com', phoneNumber: '09123456788', password: 'Volunteer@2024#', role: 'volunteer', isVerified: true, isActive: true, isApproved: true },
    { firstName: 'Ramon', lastName: 'Mendoza', email: 'ramon.mendoza@volunteer.com', phoneNumber: '09123456789', password: 'Volunteer@2024#', role: 'volunteer', isVerified: true, isActive: true, isApproved: true },
    { firstName: 'Albert', lastName: 'Santos', email: 'albert.santos@volunteer.com', phoneNumber: '09123456790', password: 'Volunteer@2024#', role: 'volunteer', isVerified: true, isActive: true, isApproved: true },
    { firstName: 'Philip', lastName: 'Garcia', email: 'philip.garcia@volunteer.com', phoneNumber: '09123456791', password: 'Volunteer@2024#', role: 'volunteer', isVerified: true, isActive: true, isApproved: true },
    { firstName: 'Luz', lastName: 'Torres', email: 'luz.torres@volunteer.com', phoneNumber: '09123456792', password: 'Volunteer@2024#', role: 'volunteer', isVerified: true, isActive: true, isApproved: true },

    { firstName: 'Jose', lastName: 'Rizal', email: 'jose.rizal@volunteer.com', phoneNumber: '09123456793', password: 'Volunteer@2024#', role: 'volunteer', isVerified: true, isActive: true, isApproved: true },
    { firstName: 'Manuel', lastName: 'Dela Cruz', email: 'manuel.delacruz@volunteer.com', phoneNumber: '09123456794', password: 'Volunteer@2024#', role: 'volunteer', isVerified: true, isActive: true, isApproved: true },
    { firstName: 'Elena', lastName: 'Gomez', email: 'elena.gomez@volunteer.com', phoneNumber: '09123456795', password: 'Volunteer@2024#', role: 'volunteer', isVerified: true, isActive: true, isApproved: true },
    { firstName: 'Carlos', lastName: 'Mendoza', email: 'carlos.mendoza@volunteer.com', phoneNumber: '09123456796', password: 'Volunteer@2024#', role: 'volunteer', isVerified: true, isActive: true, isApproved: true },

    { firstName: 'Maria', lastName: 'Santos', email: 'maria.santos@volunteer.com', phoneNumber: '09123456797', password: 'Volunteer@2024#', role: 'volunteer', isVerified: true, isActive: true, isApproved: true },
    { firstName: 'Ana', lastName: 'Reyes', email: 'ana.reyes@volunteer.com', phoneNumber: '09123456798', password: 'Volunteer@2024#', role: 'volunteer', isVerified: true, isActive: true, isApproved: true },
    { firstName: 'Luz', lastName: 'Gomez', email: 'luz.gomez@volunteer.com', phoneNumber: '09123456799', password: 'Volunteer@2024#', role: 'volunteer', isVerified: true, isActive: true, isApproved: true }
];

async function seedDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Clear existing
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
            console.log(`✅ Created user: ${userData.email}`);
        }

        const userMap = {};
        createdUsers.forEach(u => { userMap[u.email] = u; });

        const teamDefinitions = [
            { name: 'Team Alpha', role: 'Search & Rescue', volunteerId: 'RES-001', teamLeader: userMap['mark.chavez@volunteer.com']?._id, members: ['mark.chavez@volunteer.com', 'juan.delacruz@volunteer.com', 'ramon.santos@volunteer.com', 'miguel.reyes@volunteer.com', 'andres.gomez@volunteer.com', 'pedro.lopez@volunteer.com'].map(e => userMap[e]?._id), specialties: ['First Aid', 'BLS/CPR', 'Water Rescue'], schedule: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
            { name: 'Team Beta', role: 'Fire & Rescue', volunteerId: 'RES-002', teamLeader: userMap['james.reyes@volunteer.com']?._id, members: ['james.reyes@volunteer.com', 'mark.cruz@volunteer.com', 'ramon.mendoza@volunteer.com', 'albert.santos@volunteer.com', 'philip.garcia@volunteer.com', 'luz.torres@volunteer.com'].map(e => userMap[e]?._id), specialties: ['First Aid', 'Fire Fighting', 'Hazmat'], schedule: ['Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
            { name: 'Team Charlie', role: 'Mountain Rescue', volunteerId: 'RES-003', teamLeader: userMap['albert.santos@volunteer.com']?._id, members: ['albert.santos@volunteer.com', 'jose.rizal@volunteer.com', 'manuel.delacruz@volunteer.com', 'ramon.mendoza@volunteer.com', 'elena.gomez@volunteer.com', 'carlos.mendoza@volunteer.com'].map(e => userMap[e]?._id), specialties: ['First Aid', 'Mountain Rescue', 'USAR LVL 2'], schedule: ['Mon', 'Tue', 'Thu', 'Fri', 'Sun'] },
            { name: 'Team Delta', role: 'K9 & Emergency', volunteerId: 'RES-004', teamLeader: userMap['ramon.santos@volunteer.com']?._id, members: ['ramon.santos@volunteer.com', 'maria.santos@volunteer.com', 'juan.delacruz@volunteer.com', 'ana.reyes@volunteer.com', 'pedro.lopez@volunteer.com', 'luz.gomez@volunteer.com'].map(e => userMap[e]?._id), specialties: ['BLS/CPR', 'K9 Rescue', 'Emergency Driving'], schedule: ['Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }
        ];

        for (const teamData of teamDefinitions) {
            if (!teamData.teamLeader) {
                console.log(`⚠️ Skipping ${teamData.name}: No leader found`);
                continue;
            }
            await Team.create(teamData);
            console.log(`✅ Created team: ${teamData.name}`);
        }

        console.log('\n🎉 SEEDING COMPLETE! Teams are now in your database.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding error:', error);
        process.exit(1);
    }
}

seedDatabase();