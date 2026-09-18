const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection
const mongoURI = process.env.MONGO_URI || "YAHAN_APNA_MONGODB_LINK_DAAL_DENGE";
mongoose.connect(mongoURI)
  .then(() => console.log('Connected to MongoDB Atlas Successfully!'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

// User Schema for Wallet
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    balance: { type: Number, default: 0 }
});
const User = mongoose.model('User', userSchema);

// Settings Schema for Dynamic UPI & QR
const settingsSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    upiId: String,
    qrUrl: String
});
const Settings = mongoose.model('Settings', settingsSchema);

// Game States
let adminForcedResult30 = null; 
let adminForcedResult60 = null; 
let countdown30 = 30; 
let countdown60 = 60; 

// 30 Seconds Timer Engine
setInterval(() => {
    countdown30--;
    if (countdown30 <= 0) {
        let winningResult = adminForcedResult30 ? adminForcedResult30 : (Math.random() > 0.5 ? 'Big' : 'Small');
        io.emit('roundResult30', { result: winningResult });
        adminForcedResult30 = null; 
        countdown30 = 30;
    }
    io.emit('timerUpdate30', { countdown: countdown30 });
}, 1000);

// 60 Seconds Timer Engine
setInterval(() => {
    countdown60--;
    if (countdown60 <= 0) {
        let winningResult = adminForcedResult60 ? adminForcedResult60 : (Math.random() > 0.5 ? 'Big' : 'Small');
        io.emit('roundResult60', { result: winningResult });
        adminForcedResult60 = null; 
        countdown60 = 60;
    }
    io.emit('timerUpdate60', { countdown: countdown60 });
}, 1000);

// Socket Connections
io.on('connection', async (socket) => {
    console.log('A user connected:', socket.id);

    // Send UPI settings on load
    try {
        let settings = await Settings.findOne({ key: 'payment_config' });
        if (settings) {
            socket.emit('updateUpiSettings', { upiId: settings.upiId, qrUrl: settings.qrUrl });
        }
    } catch (err) {
        console.log(err);
    }

    // Get or Create User Balance
    socket.on('loginUser', async (username) => {
        try {
            let user = await User.findOne({ username });
            if (!user) {
                user = new User({ username, balance: 0 });
                await user.save();
            }
            socket.emit('balanceUpdate', user.balance);
        } catch (err) {
            console.log(err);
        }
    });

    // Admin: Add or Deduct Balance
    socket.on('adminAction', async (data) => {
        try {
            let { username, amount, action } = data; 
            let user = await User.findOne({ username });
            if (user) {
                if (action === 'add') {
                    user.balance += Number(amount);
                } else if (action === 'cut') {
                    user.balance -= Number(amount);
                    if (user.balance < 0) user.balance = 0;
                }
                await user.save();
                io.emit('refreshBalance', { username, balance: user.balance });
            }
        } catch (err) {
            console.log(err);
        }
    });

    // Admin: Update UPI & QR Settings
    socket.on('updateUpiConfig', async (data) => {
        try {
            let { upiId, qrUrl } = data;
            await Settings.findOneAndUpdate(
                { key: 'payment_config' },
                { upiId, qrUrl },
                { upsert: true, new: true }
            );
            io.emit('updateUpiSettings', { upiId, qrUrl });
        } catch (err) {
            console.log(err);
        }
    });

    // Admin Forced Results for both timers
    socket.on('setAdminResult', (data) => {
        if (data.mode === '30s') {
            adminForcedResult30 = data.result;
        } else if (data.mode === '60s') {
            adminForcedResult60 = data.result;
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});