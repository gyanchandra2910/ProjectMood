#!/usr/bin/env node

// System Verification Script
// Checks if the room connection system is properly set up

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

console.log('🔍 MoodFusion System Verification');
console.log('==================================\n');

const checks = [];

// Check file structure
function checkFileStructure() {
  console.log('📁 Checking file structure...');
  
  const requiredFiles = [
    'backend/app.js',
    'backend/services/roomConnection.js',
    'backend/services/ambientMatching.js',
    'backend/services/roomConnectionSockets.js',
    'backend/routes/roomConnectionRoutes.js',
    'backend/tests/roomConnectionTest.js',
    'backend/demo/roomConnectionDemo.js',
    'frontend/src/components/Room.js',
    'frontend/src/components/RoomConnectionPanel.js',
    'frontend/src/components/RoomConnectionPanel.css',
    'docs/ROOM_CONNECTIONS.md',
    'start.js'
  ];
  
  let allFilesExist = true;
  requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ ${file} - Missing`);
      allFilesExist = false;
    }
  });
  
  checks.push({ name: 'File Structure', passed: allFilesExist });
  return allFilesExist;
}

// Check package.json dependencies
function checkDependencies() {
  console.log('\n📦 Checking dependencies...');
  
  try {
    // Backend dependencies
    const backendPkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'backend/package.json')));
    const frontendPkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'frontend/package.json')));
    
    const requiredBackend = ['socket.io', 'express', 'mongoose', 'firebase-admin'];
    const requiredFrontend = ['socket.io-client', 'react'];
    
    let backendOk = true;
    let frontendOk = true;
    
    requiredBackend.forEach(dep => {
      if (backendPkg.dependencies && backendPkg.dependencies[dep]) {
        console.log(`✅ Backend: ${dep}`);
      } else {
        console.log(`❌ Backend: ${dep} - Missing`);
        backendOk = false;
      }
    });
    
    requiredFrontend.forEach(dep => {
      if (frontendPkg.dependencies && frontendPkg.dependencies[dep]) {
        console.log(`✅ Frontend: ${dep}`);
      } else {
        console.log(`❌ Frontend: ${dep} - Missing`);
        frontendOk = false;
      }
    });
    
    const depsOk = backendOk && frontendOk;
    checks.push({ name: 'Dependencies', passed: depsOk });
    return depsOk;
    
  } catch (error) {
    console.log('❌ Error reading package.json files');
    checks.push({ name: 'Dependencies', passed: false });
    return false;
  }
}

// Check environment files
function checkEnvironment() {
  console.log('\n🔧 Checking environment setup...');
  
  const backendEnv = path.join(__dirname, 'backend/.env');
  const frontendEnv = path.join(__dirname, 'frontend/.env');
  
  let envOk = true;
  
  if (fs.existsSync(backendEnv)) {
    console.log('✅ Backend .env file exists');
  } else {
    console.log('❌ Backend .env file missing');
    envOk = false;
  }
  
  if (fs.existsSync(frontendEnv)) {
    console.log('✅ Frontend .env file exists');
  } else {
    console.log('❌ Frontend .env file missing');
    envOk = false;
  }
  
  checks.push({ name: 'Environment Files', passed: envOk });
  return envOk;
}

// Check if MongoDB is accessible
function checkMongoDB() {
  return new Promise((resolve) => {
    console.log('\n🗄️  Checking MongoDB connection...');
    
    exec('mongosh --eval "db.adminCommand(\'ismaster\')" --quiet', (error, stdout, stderr) => {
      if (error) {
        console.log('❌ MongoDB not accessible (this is optional for testing)');
        console.log('💡 You can use MongoDB Atlas or install locally');
        checks.push({ name: 'MongoDB', passed: false });
        resolve(false);
      } else {
        console.log('✅ MongoDB is accessible');
        checks.push({ name: 'MongoDB', passed: true });
        resolve(true);
      }
    });
  });
}

// Check Node.js version
function checkNodeVersion() {
  console.log('\n⚙️  Checking Node.js version...');
  
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion >= 16) {
    console.log(`✅ Node.js ${nodeVersion} (>= 16 required)`);
    checks.push({ name: 'Node.js Version', passed: true });
    return true;
  } else {
    console.log(`❌ Node.js ${nodeVersion} (>= 16 required)`);
    checks.push({ name: 'Node.js Version', passed: false });
    return false;
  }
}

// Generate report
function generateReport() {
  console.log('\n📊 System Verification Report');
  console.log('==============================');
  
  let totalChecks = checks.length;
  let passedChecks = checks.filter(check => check.passed).length;
  
  checks.forEach(check => {
    const status = check.passed ? '✅' : '❌';
    console.log(`${status} ${check.name}`);
  });
  
  console.log(`\nScore: ${passedChecks}/${totalChecks} checks passed\n`);
  
  if (passedChecks === totalChecks) {
    console.log('🎉 All checks passed! Your system is ready for MoodFusion.');
    console.log('\n🚀 Next steps:');
    console.log('1. node start.js install-deps  # Install dependencies');
    console.log('2. node start.js start-server  # Start backend');
    console.log('3. node start.js start-frontend # Start frontend');
    console.log('4. node start.js run-demo      # Test room connections');
  } else {
    console.log('⚠️  Some checks failed. Please address the issues above.');
    console.log('\n💡 Common fixes:');
    if (checks.find(c => c.name === 'Dependencies' && !c.passed)) {
      console.log('- Run: node start.js install-deps');
    }
    if (checks.find(c => c.name === 'Environment Files' && !c.passed)) {
      console.log('- Copy .env.example to .env in backend and frontend directories');
    }
    if (checks.find(c => c.name === 'MongoDB' && !c.passed)) {
      console.log('- Install MongoDB locally or use MongoDB Atlas');
    }
  }
}

// Run all checks
async function runVerification() {
  checkNodeVersion();
  checkFileStructure();
  checkDependencies();
  checkEnvironment();
  await checkMongoDB();
  generateReport();
}

// Execute if run directly
if (require.main === module) {
  runVerification();
}

module.exports = { runVerification };
