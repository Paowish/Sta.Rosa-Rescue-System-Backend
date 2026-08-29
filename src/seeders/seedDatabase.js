const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../src/models/User.model');
const Team = require('../src/models/Team.model');

// ✅ Sample Users
const users = [
  // Admin / Rescue Team Account
  {
    firstName: 'Rescue',
    lastName: 'Team',
    email: 'rescue@gmail.com',
    phoneNumber: '09123456780',
    password: 'Rescue@2024#Team',
    role: 'admin',
    isVerified: true,
    isActive: true,
    profileImage: '',
  },
  // Volunteer Users (for teams)
  {
    firstName: 'Mark',
    lastName: 'Chavez',
    email: 'mark.chavez@volunteer.com',
    phoneNumber: '09123456781',
    password: 'Volunteer@2024#',
    role: 'volunteer',
    isVerified: true,
    isActive: true,
    isApproved: true,
    profileImage: '',
    address1: 'Brgy. San Juan, Santa Rosa',
    certifications: ['BLS/CPR', 'First Aid', 'Water Rescue']
  },
  {
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    email: 'juan.delacruz@volunteer.com',
    phoneNumber: '09123456782',
    password: 'Volunteer@2024#',
    role: 'volunteer',
    isVerified: true,
    isActive: true,
    isApproved: true,
    profileImage: '',
    address1: 'Brgy. San Jose, Santa Rosa',
    certifications: ['BLS/CPR', 'First Aid']
  },
  {
    firstName: 'Ramon',
    lastName: 'Santos',
    email: 'ramon.santos@volunteer.com',
    phoneNumber: '09123456783',
    password: 'Volunteer@2024#',
    role: 'volunteer',
    isVerified: true,
    isActive: true,
    isApproved: true,
    profileImage: '',
    address1: 'Brgy. San Pedro, Santa Rosa',
    certifications: ['First Aid', 'Water Rescue']
  },
  {
    firstName: 'Miguel',
    lastName: 'Reyes',
    email: 'miguel.reyes@volunteer.com',
    phoneNumber: '09123456784',
    password: 'Volunteer@2024#',
    role: 'volunteer',
    isVerified: true,
    isActive: true,
    isApproved: true,
    profileImage: '',
    address1: 'Brgy. San Miguel, Santa Rosa',
    certifications: ['BLS/CPR', 'USAR LVL 1']
  },
  {
    firstName: 'Andres',
    lastName: 'Gomez',
    email: 'andres.gomez@volunteer.com',
    phoneNumber: '09123456785',
    password: 'Volunteer@2024#',
    role: 'volunteer',
    isVerified: true,
    isActive: true,
    isApproved: true,
    profileImage: '',
    address1: 'Brgy. San Andres, Santa Rosa',
    certifications: ['First Aid', 'Patient Triage']
  },
  {
    firstName: 'Pedro',
    lastName: 'Lopez',
    email: 'pedro.lopez@volunteer.com',
    phoneNumber: '09123456786',
    password: 'Volunteer@2024#',
    role: 'volunteer',
    isVerified: true,
    isActive: true,
    isApproved: true,
    profileImage: '',
    address1: 'Brgy. San Pedro, Santa Rosa',
    certifications: ['BLS/CPR', 'Water Rescue']
  },
  // Team Beta
  {
    firstName: 'James',
    lastName: 'Reyes',
    email: 'james.reyes@volunteer.com',
    phoneNumber: '09123456787',
    password: 'Volunteer@2024#',
    role: 'volunteer',
    isVerified: true,
    isActive: true,
    isApproved: true,
    profileImage: '',
    address1: 'Brgy. San Isidro, Santa Rosa',
    certifications: ['First Aid', 'Fire Fighting']
  },
  {
    firstName: 'Mark',
    lastName: 'Cruz',
    email: 'mark.cruz@volunteer.com',
    phoneNumber: '09123456788',
    password: 'Volunteer@2024#',
    role: 'volunteer',
    isVerified: true,
    isActive: true,
    isApproved: true,
    profileImage: '',
    address1: 'Brgy. San Antonio, Santa Rosa',
    certifications: ['BLS/CPR', 'Fire Fighting']
  },
  {
    firstName: 'Ramon',
    lastName: 'Mendoza',
    email: 'ramon.mendoza@volunteer.com',
    phoneNumber: '09123456789',
    password: 'Volunteer@2024#',
    role: 'volunteer',
    isVerified: true,
    isActive: true,
    isApproved: true,
    profileImage: '',
    address1: 'Brgy. San Ramon, Santa Rosa',
    certifications: ['First Aid', 'Hazmat']
  },
  {
    firstName: 'Albert',
    lastName: 'Santos',
    email: 'albert.santos@volunteer.com',
    phoneNumber: '09123456790',
    password: 'Volunteer@2024#',
    role: 'volunteer',
    isVerified: true,
    isActive: true,
    isApproved: true,
    profileImage: '',
    address1: 'Brgy. San Alberto, Santa Rosa',
    certifications: ['BLS/CPR', 'First Aid']
  },
  {
    firstName: 'Philip',
    lastName: 'Garcia',
    email: 'philip.garcia@volunteer.com',
    phoneNumber: '09123456791',
    password: 'Volunteer@2024#',
    role: 'volunteer',
    isVerified: true,
    isActive: true,
    isApproved: true,
    profileImage: '',
    address1: 'Brgy. San Felipe, Santa Rosa',
    certifications: ['Fire Fighting']
  },
  {
    firstName: 'Luz',
    lastName: 'Torres',
    email: 'luz.torres@volunteer.com',
    phoneNumber: '09123456792',
    password: 'Volunteer@2024#',
    role: 'volunteer',
    isVerified: true,
    isActive: true,
    isApproved: true,
    profileImage: '',
    address1: 'Brgy. Santa Luz, Santa Rosa',
    certifications: ['First Aid', 'Emergency Driving']
  },
  // Team Charlie
  {
    firstName: 'Jose',
    lastName: 'Rizal',
    email: 'jose.rizal@volunteer.com',
    phoneNumber: '09123456793',
    password: 'Volunteer@2024#',
    role: 'volunteer',
    isVerified: true,
    isActive: true,
    isApproved: true,
    profileImage: '',
    address1: 'Brgy. Jose Rizal, Santa Rosa',
    certifications: ['Mountain Rescue', 'USAR LVL 2']
  },
  {
    firstName: 'Manuel',
    lastName: 'Dela Cruz',
    email: 'manuel.delacruz@volunteer.com',
    phoneNumber: '09123456794',
    password: 'Volunteer@2024#',
    role: 'volunteer',
    isVerified: true,
    isActive: true,
    isApproved: true,
    profileImage: '',
    address1: 'Brgy. San Manuel, Santa Rosa',
    certifications: ['First Aid', 'Mountain Rescue']
  },
  {
    firstName: 'Elena',
    lastName: 'Gomez',
    email: 'elena.gomez@volunteer.com',
    phoneNumber: '09123456795',
    password: 'Volunteer@2024#',
    role: 'volunteer',
    isVerified: true,
    isActive: true,
    isApproved: true,
    profileImage: '',
    address1: 'Brgy. Santa Elena, Santa Rosa',
    certifications: ['BLS/CPR', 'Patient Triage']
  },
  {
    firstName: 'Carlos',
    lastName: 'Mendoza',
    email: 'carlos.mendoza@volunteer.com',
    phoneNumber: '09123456796',
    password: 'Volunteer@2024#',
    role: 'volunteer',
    isVerified: true,
    isActive: true,
    isApproved: true,
    profileImage: '',
    address1: 'Brgy. San Carlos, Santa Rosa',
    certifications: ['USAR LVL 2']
  },
  // Team Delta
  {
    firstName: 'Maria',
    lastName: 'Santos',
    email: 'maria.santos@volunteer.com',
    phoneNumber: '09123456797',
    password: 'Volunteer@2024#',
    role: 'volunteer',
    isVerified: true,
    isActive: true,
    isApproved: true,
    profileImage: '',
    address1: 'Brgy. Santa Maria, Santa Rosa',
    certifications: ['K9 Rescue']
  },
  {
    firstName: 'Ana',
    lastName: 'Reyes',
    email: 'ana.reyes@volunteer.com',
    phoneNumber: '09123456798',
    password: 'Volunteer@2024#',
    role: 'volunteer',
    isVerified: true,
    isActive: true,
    isApproved: true,
    profileImage: '',
    address1: 'Brgy. Santa Ana, Santa Rosa',
    certifications: ['BLS/CPR', 'Emergency Driving']
  },
  {
    firstName: 'Luz',
    lastName: 'Gomez',
    email: 'luz.gomez@volunteer.com',
    phoneNumber: '09123456799',
    password: 'Volunteer@2024#',
    role: 'volunteer',
    isVerified: true,
    isActive: true,
    isApproved: true,
    profileImage: '',
    address1: 'Brgy. Santa Luz, Santa Rosa',
    certifications: ['First Aid']
  }
];

// ✅ Team Definitions
const getTeamDefinitions = (volunteers) => {
  // Map volunteers by name for easy lookup
  const volunteerMap = {};
  volunteers.forEach(v => {
    const key = `${v.firstName} ${v.lastName}`;
    volunteerMap[key] = v;
  });

  // Helper to get volunteer IDs by name list
  const getIds = (names) => {
    return names.map(name => {
      const volunteer = volunteerMap[name];
      if (!volunteer) {
        console.warn(`⚠️ Volunteer not found: ${name}`);
        return null;
      }
      return volunteer._id;
    }).filter(id => id !== null);
  };

  return [
    {
      name: 'Team Alpha',
      role: 'Search & Rescue',
      teamLeader: volunteerMap['Mark Chavez']?._id || null,
      volunteerId: 'RES-001',
      members: getIds(['Mark Chavez', 'Juan Dela Cruz', 'Ramon Santos', 'Miguel Reyes', 'Andres Gomez', 'Pedro Lopez']),
      specialties: ['First Aid', 'BLS/CPR', 'Water Rescue'],
      schedule: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    },
    {
      name: 'Team Beta',
      role: 'Fire & Rescue',
      teamLeader: volunteerMap['James Reyes']?._id || null,
      volunteerId: 'RES-002',
      members: getIds(['James Reyes', 'Mark Cruz', 'Ramon Mendoza', 'Albert Santos', 'Philip Garcia', 'Luz Torres']),
      specialties: ['First Aid', 'Fire Fighting', 'Hazmat'],
      schedule: ['Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    },
    {
      name: 'Team Charlie',
      role: 'Mountain Rescue',
      teamLeader: volunteerMap['Albert Santos']?._id || null,
      volunteerId: 'RES-003',
      members: getIds(['Albert Santos', 'Jose Rizal', 'Manuel Dela Cruz', 'Ramon Cruz', 'Elena Gomez', 'Carlos Mendoza']),
      specialties: ['First Aid', 'Mountain Rescue', 'USAR LVL 2'],
      schedule: ['Mon', 'Tue', 'Thu', 'Fri', 'Sun']
    },
    {
      name: 'Team Delta',
      role: 'K9 & Emergency',
      teamLeader: volunteerMap['Ramon Cruz']?._id || null,
      volunteerId: 'RES-004',
      members: getIds(['Ramon Cruz', 'Maria Santos', 'Juan Dela Cruz', 'Ana Reyes', 'Pedro Lopez', 'Luz Gomez']),
      specialties: ['BLS/CPR', 'K9 Rescue', 'Emergency Driving'],
      schedule: ['Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    }
  ];
};

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rescue_db');
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    console.log('🗑️ Cleared existing users');

    await Team.deleteMany({});
    console.log('🗑️ Cleared existing teams');

    // Hash passwords and create users
    const createdUsers = [];
    for (const userData of users) {
      const salt = await bcrypt.genSalt(12);
      userData.password = await bcrypt.hash(userData.password, salt);
      const user = await User.create(userData);
      createdUsers.push(user);
      console.log(`✅ Created user: ${userData.email} (${userData.role})`);
    }

    // Create teams
    const teamDefinitions = getTeamDefinitions(createdUsers);
    for (const teamData of teamDefinitions) {
      if (teamData.members.length === 0) {
        console.warn(`⚠️ Skipping ${teamData.name}: No valid members`);
        continue;
      }
      if (!teamData.teamLeader) {
        console.warn(`⚠️ Skipping ${teamData.name}: No team leader found`);
        continue;
      }
      const team = await Team.create(teamData);
      console.log(`✅ Created team: ${team.name} with ${team.members.length} members`);
    }

    console.log('\n🎉 =====================================');
    console.log('   DATABASE SEEDING COMPLETED!');
    console.log('   =====================================\n');

    console.log('📝 ACCOUNTS:\n');
    console.log('┌─────────────────────────────────────────────────────┐');
    console.log('│ EMAIL                    │ PASSWORD               │');
    console.log('├──────────────────────────┼────────────────────────┤');
    console.log('│ rescue@gmail.com         │ Rescue@2024#Team       │');
    console.log('└──────────────────────────┴────────────────────────┘\n');

    console.log('📍 ROUTE DESTINATIONS:\n');
    console.log('   • Admin/Rescue → /dashboard\n');
    console.log('   • Volunteer → /volunteer-dashboard\n');
    console.log('   • Civilian → /civilian-dashboard\n');

    console.log('📋 TEAMS CREATED:\n');
    const teams = await Team.find().populate('members', 'firstName lastName');
    teams.forEach(team => {
      const memberNames = team.members.map(m => `${m.firstName} ${m.lastName}`).join(', ');
      console.log(`   • ${team.name} (${team.role})`);
      console.log(`     Members: ${memberNames}`);
      console.log(`     Team Leader: ${team.teamLeader}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

seedDatabase();