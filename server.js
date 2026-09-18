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

// MongoDB Connection (Agar .env me link nahi hai to direct yahan dal sakte hain)
const mongoURI = process.env.MONGO_URI || "YAHAN_APNA_MONGODB_LINK_DAAL_DENGE";
mongoose.connect(mongoURI)
  .then(() => console.log('Connected to MongoDB Atlas Successfully!'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

let adminForcedResult = null; 
let countdown = 30; 

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

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    socket.on('setAdminResult', (data) => {
        adminForcedResult = data.result; 
        console.log('Admin forced next result to:', adminForcedResult);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});