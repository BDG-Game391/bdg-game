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

let adminForcedResult = null; 
let countdown = 30; 

// Timer & Game Engine
setInterval(() => {
    countdown--;
    if (countdown <= 0) {
        let winningResult = adminForcedResult ? adminForcedResult : (Math.random() > 0.5 ? 'Big' : 'Small');
        io.emit('roundResult', { result: winningResult });
        adminForcedResult = null; 
        countdown = 30;
    }
    io.emit('timerUpdate', { countdown });
}, 1000);

// Socket Connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Get or Create User Balance
    socket.on('loginUser', async (username) => {
        try {
            let user = await User.findOne({ username });
            if (!user) {
                user = new User({ username, balance: 100 }); // Free starting bonus 100
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
            let { username, amount, action } = data; // action: 'add' or 'cut'
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
                console.log(`Admin updated ${username}'s balance. New balance: ${user.balance}`);
            }
        } catch (err) {
            console.log(err);
        }
    });

    // Admin Forced Result
    socket.on('setAdminResult', (data) => {
        adminForcedResult = data.result; 
        console.log('Admin forced next result to:', adminForcedResult);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});