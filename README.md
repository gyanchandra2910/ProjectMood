# ProjectMood

A real-time communication application built with React, Tailwind CSS, Node.js, Express, and Socket.IO.

## 🚀 Features

- **Real-time Messaging**: Instant communication using Socket.IO
- **Modern UI**: Clean and responsive design with Tailwind CSS
- **Full-Stack**: React frontend with Node.js/Express backend
- **CI/CD Ready**: GitHub Actions workflow included
- **Health Monitoring**: Built-in health check endpoints

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn package manager

## 🛠️ Installation & Setup

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd ProjectMood
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

The backend server will start on `http://localhost:3001`

### 3. Frontend Setup
```bash
cd frontend
npm install
npm start
```

The frontend will start on `http://localhost:3000`

## 🏃‍♂️ Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

### Production Mode

**Backend:**
```bash
cd backend
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
# Serve the build folder with your preferred static server
```

## 📁 Project Structure

```
ProjectMood/
├── frontend/                 # React application
│   ├── public/              # Static files
│   ├── src/
│   │   ├── components/      # React components
│   │   │   └── Home.js      # Main home component
│   │   ├── App.js           # Main App component
│   │   ├── index.js         # Entry point
│   │   └── index.css        # Tailwind CSS imports
│   ├── package.json
│   ├── tailwind.config.js
│   └── postcss.config.js
├── backend/                 # Node.js/Express server
│   ├── server.js           # Main server file
│   ├── package.json
│   └── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml          # GitHub Actions CI/CD
├── README.md
└── LICENSE
```

## 🔌 API Endpoints

- `GET /` - API information
- `GET /health` - Health check endpoint
- Socket.IO events:
  - `connection` - Client connects
  - `message` - Send/receive messages
  - `join-room` - Join a specific room
  - `leave-room` - Leave a room
  - `disconnect` - Client disconnects

## 🧪 Testing

**Frontend:**
```bash
cd frontend
npm test
```

**Backend:**
```bash
cd backend
npm test
```

## 🚀 Deployment

The application is ready for deployment on platforms like:
- **Frontend**: Vercel, Netlify, GitHub Pages
- **Backend**: Heroku, Railway, DigitalOcean

### Environment Variables

Make sure to set the following environment variables in production:

**Backend (.env):**
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (production/development)
- `CORS_ORIGIN` - Frontend URL for CORS

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🛠️ Built With

- **Frontend**: React, Tailwind CSS, Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO, CORS
- **Development**: ESLint, Prettier, Nodemon
- **CI/CD**: GitHub Actions

## 📞 Support

If you have any questions or need help, please open an issue in the GitHub repository.

---

Made with ❤️ by the ProjectMood team
