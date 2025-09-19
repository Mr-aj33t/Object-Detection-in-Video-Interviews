# 🚀 AI Video Proctoring System - Startup Guide

## 🎯 Quick Start (Recommended)

### Option 1: Automatic Startup (Windows)
```bash
# Double-click the start.bat file or run:
start.bat
```

### Option 2: Manual Startup
Follow the steps below for manual control.

## 📋 Prerequisites Check

Before starting, ensure you have:
- ✅ **Node.js** (v14+) - `node --version`
- ✅ **Python** (for frontend server) - `python --version`
- ✅ **MongoDB** (optional - uses in-memory if not available)
- ✅ **Modern Browser** (Chrome, Firefox, Edge)

## 🔧 Step-by-Step Manual Startup

### Step 1: Install Dependencies
```bash
# In project root directory
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### Step 2: Start Backend Server
```bash
# Open Terminal 1
cd backend
npm run dev

# You should see:
# 🚀 Server running on port 5000
# 📊 Socket.IO server initialized
# 🤖 AI detection endpoints ready
```

### Step 3: Start Frontend Server
```bash
# Open Terminal 2 (new terminal)
cd frontend
python -m http.server 3000

# Alternative for Node.js users:
# npx http-server -p 3000

# You should see:
# Serving HTTP on 0.0.0.0 port 3000
```

### Step 4: Open Application
1. Open browser and go to: `http://localhost:3000`
2. Allow camera and microphone permissions
3. Wait for AI models to load (15-30 seconds)
4. System will auto-start after loading

## 🤖 AI Model Loading Process

When you first open the application, you'll see:

```
🚀 Loading AI models...
📦 Loading TensorFlow.js models...
✅ COCO-SSD model loaded
✅ Face detection model loaded
📦 Loading MediaPipe Face Mesh...
✅ MediaPipe Face Mesh loaded
✅ All AI models loaded successfully
```

**Loading Time:** 15-30 seconds (depending on internet speed)

## 🎮 Testing the System

### 1. Basic Functionality Test
- ✅ Camera feed appears
- ✅ AI status shows "Ready" for all models
- ✅ No console errors

### 2. AI Detection Tests
- **Face Detection**: Should show "1 face detected" for single person
- **Mobile Detection**: Show mobile phone → should detect with confidence
- **Object Detection**: Show book/laptop → should identify object type
- **Gaze Tracking**: Look away → should trigger focus loss alert

### 3. System Status Check
Look for these indicators:
- 🟢 **TensorFlow.js**: Ready
- 🟢 **COCO-SSD**: Ready  
- 🟢 **MediaPipe**: Ready
- 🟢 **Detection Mode**: AI Enhanced

## 🚨 Troubleshooting

### AI Models Not Loading
```bash
# Check browser console for errors
# Common solutions:
1. Refresh page (Ctrl+F5)
2. Check internet connection
3. Try different browser
4. Clear browser cache
```

### Backend Connection Issues
```bash
# Check if backend is running:
curl http://localhost:5000

# If not working:
1. Check if port 5000 is free
2. Restart backend server
3. Check .env configuration
```

### Camera/Microphone Issues
```bash
# Browser permissions:
1. Click camera icon in address bar
2. Allow camera and microphone
3. Refresh page
4. Try different browser if needed
```

### Performance Issues
```bash
# If system is slow:
1. Close other browser tabs
2. Check CPU usage
3. Reduce video quality in browser settings
4. System will auto-fallback to basic mode if needed
```

## 🔍 System Monitoring

### Backend Logs
Monitor Terminal 1 for:
```
✅ Server running on port 5000
📊 Socket.IO connection established
🤖 AI detection endpoint hit
📊 Report generated successfully
```

### Frontend Console
Press F12 in browser and check Console for:
```
🤖 AI Detection System initialized
✅ AI models loaded successfully
🎯 Starting AI-powered detection...
👥 AI Face Detection: 1 faces detected
📱 AI Object Detection: cell phone (87.3% confidence)
```

## 📊 Expected System Behavior

### Normal Operation
1. **Startup**: 15-30 seconds for AI model loading
2. **Detection**: Real-time analysis every 1-2 seconds
3. **Alerts**: Immediate violation notifications
4. **Performance**: Smooth video feed with no lag

### Fallback Mode
If AI models fail to load:
1. System automatically switches to basic detection
2. Status shows "Basic Mode" instead of "AI Enhanced"
3. Detection continues with reduced accuracy
4. All core functionality remains available

## 🎯 Success Indicators

You know the system is working correctly when:
- ✅ Both servers running without errors
- ✅ Camera feed visible and smooth
- ✅ AI status indicators show "Ready"
- ✅ Detection logs appear in console
- ✅ Violation alerts work when triggered

## 📱 Access Points

- **Main Application**: http://localhost:3000
- **Interviewer Dashboard**: http://localhost:3000/interviewer.html
- **Backend API**: http://localhost:5000
- **API Health Check**: http://localhost:5000/health

## 🛑 Stopping the System

### Automatic Shutdown
Close both terminal windows that opened from start.bat

### Manual Shutdown
1. Press `Ctrl+C` in Backend terminal
2. Press `Ctrl+C` in Frontend terminal
3. Close browser tabs

## 📞 Support

If you encounter issues:
1. Check this troubleshooting guide
2. Review browser console for errors
3. Check backend terminal for error messages
4. Ensure all prerequisites are installed

**System is now ready for AI-powered video proctoring!** 🤖✨
