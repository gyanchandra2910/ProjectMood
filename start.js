#!/usr/bin/env node

// Room Connection System Starter
// Quick setup and testing utility for the room connection features

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🎵 MoodFusion Room Connection System');
console.log('=====================================\n');

const commands = {
  'start-server': {
    description: 'Start the backend server with room connections',
    command: 'node',
    args: ['app.js'],
    cwd: path.join(__dirname, 'backend')
  },
  'start-frontend': {
    description: 'Start the React frontend application',
    command: 'npm',
    args: ['start'],
    cwd: path.join(__dirname, 'frontend')
  },
  'run-demo': {
    description: 'Run the room connection demo',
    command: 'node',
    args: ['demo/roomConnectionDemo.js'],
    cwd: path.join(__dirname, 'backend')
  },
  'run-tests': {
    description: 'Run the room connection test suite',
    command: 'node',
    args: ['tests/roomConnectionTest.js'],
    cwd: path.join(__dirname, 'backend')
  },
  'install-deps': {
    description: 'Install all dependencies for backend and frontend',
    command: 'npm',
    args: ['install'],
    multi: [
      { cwd: path.join(__dirname, 'backend') },
      { cwd: path.join(__dirname, 'frontend') }
    ]
  },
  'health-check': {
    description: 'Check if the server is running and healthy',
    command: 'curl',
    args: ['http://localhost:3001/api/health']
  },
  'verify': {
    description: 'Run comprehensive system verification',
    command: 'node',
    args: ['verify.js'],
    cwd: __dirname
  }
};

function showHelp() {
  console.log('Available commands:\n');
  Object.entries(commands).forEach(([cmd, config]) => {
    console.log(`  ${cmd.padEnd(15)} - ${config.description}`);
  });
  console.log('\nUsage: node start.js <command>');
  console.log('Example: node start.js start-server\n');
}

function runCommand(commandName) {
  const config = commands[commandName];
  if (!config) {
    console.error(`❌ Unknown command: ${commandName}`);
    showHelp();
    return;
  }

  console.log(`🚀 Running: ${config.description}`);
  
  if (config.multi) {
    // Run command in multiple directories
    config.multi.forEach((location, index) => {
      console.log(`📁 Location ${index + 1}: ${location.cwd}`);
      const process = spawn(config.command, config.args, {
        cwd: location.cwd,
        stdio: 'inherit',
        shell: true
      });

      process.on('error', (error) => {
        console.error(`❌ Error in ${location.cwd}:`, error.message);
      });
    });
  } else {
    // Single command
    if (config.cwd) {
      console.log(`📁 Working directory: ${config.cwd}`);
    }
    
    const process = spawn(config.command, config.args, {
      cwd: config.cwd || process.cwd(),
      stdio: 'inherit',
      shell: true
    });

    process.on('error', (error) => {
      console.error('❌ Command failed:', error.message);
    });

    process.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Command completed successfully');
      } else {
        console.log(`\n❌ Command exited with code ${code}`);
      }
    });
  }
}

// Quick setup check
function checkSetup() {
  const backendPath = path.join(__dirname, 'backend');
  const frontendPath = path.join(__dirname, 'frontend');
  
  console.log('🔍 Checking project setup...\n');
  
  // Check if directories exist
  if (!fs.existsSync(backendPath)) {
    console.log('❌ Backend directory not found');
    return false;
  }
  if (!fs.existsSync(frontendPath)) {
    console.log('❌ Frontend directory not found');
    return false;
  }
  
  // Check key files
  const keyFiles = [
    path.join(backendPath, 'app.js'),
    path.join(backendPath, 'services/roomConnection.js'),
    path.join(backendPath, 'services/ambientMatching.js'),
    path.join(frontendPath, 'src/components/RoomConnectionPanel.js')
  ];
  
  let allFilesExist = true;
  keyFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${path.relative(__dirname, file)}`);
    } else {
      console.log(`❌ ${path.relative(__dirname, file)} - Missing`);
      allFilesExist = false;
    }
  });
  
  // Check package.json dependencies
  try {
    const backendPkg = JSON.parse(fs.readFileSync(path.join(backendPath, 'package.json')));
    const frontendPkg = JSON.parse(fs.readFileSync(path.join(frontendPath, 'package.json')));
    
    const requiredBackendDeps = ['socket.io', 'express', 'mongoose'];
    const requiredFrontendDeps = ['socket.io-client', 'react'];
    
    requiredBackendDeps.forEach(dep => {
      if (backendPkg.dependencies && backendPkg.dependencies[dep]) {
        console.log(`✅ Backend dependency: ${dep}`);
      } else {
        console.log(`❌ Backend dependency missing: ${dep}`);
        allFilesExist = false;
      }
    });
    
    requiredFrontendDeps.forEach(dep => {
      if (frontendPkg.dependencies && frontendPkg.dependencies[dep]) {
        console.log(`✅ Frontend dependency: ${dep}`);
      } else {
        console.log(`❌ Frontend dependency missing: ${dep}`);
        allFilesExist = false;
      }
    });
    
  } catch (error) {
    console.log('❌ Error reading package.json files');
    allFilesExist = false;
  }
  
  console.log('');
  if (allFilesExist) {
    console.log('🎉 Setup looks good! Ready to start.');
    console.log('💡 Tip: Run "node start.js install-deps" if you haven\'t installed dependencies yet.');
  } else {
    console.log('⚠️  Some files or dependencies are missing. Please check the setup.');
  }
  
  return allFilesExist;
}

// Main execution
const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'help' || command === '--help' || command === '-h') {
  showHelp();
} else if (command === 'check' || command === 'setup-check') {
  checkSetup();
} else {
  checkSetup();
  console.log('');
  runCommand(command);
}

// Quick start guide
if (!command) {
  console.log('🚀 Quick Start Guide:');
  console.log('1. node start.js verify       # Verify system setup');
  console.log('2. node start.js install-deps  # Install dependencies');
  console.log('3. node start.js start-server  # Start backend (in one terminal)');
  console.log('4. node start.js start-frontend # Start frontend (in another terminal)');
  console.log('5. node start.js run-demo      # See the room connection demo');
  console.log('6. Open http://localhost:3000 in your browser');
}
