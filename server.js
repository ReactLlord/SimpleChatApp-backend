import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';

// Mongoose models
const UserSchema = new mongoose.Schema({
  username: String,
});
const User = mongoose.model('User', UserSchema);

const MessageSchema = new mongoose.Schema({
  roomId: String,
  senderId: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
});
const Message = mongoose.model('Message', MessageSchema);

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// Connect MongoDB
mongoose.connect('mongodb://localhost:27017/chat-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'));

// Utility to get roomId for two users
function getRoomId(user1, user2) {
  return user1 < user2 ? user1 + '_' + user2 : user2 + '_' + user1;
}

// REST API to get all users
app.get('/users', async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// REST API to get message history between two users
app.get('/messages/:user1/:user2', async (req, res) => {
  const { user1, user2 } = req.params;
  const roomId = getRoomId(user1, user2);
  const messages = await Message.find({ roomId }).sort({ createdAt: 1 });
  res.json(messages);
});

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('joinRoom', ({ userId, otherUserId }) => {
    const roomId = getRoomId(userId, otherUserId);
    socket.join(roomId);
    console.log(`User ${userId} joined room ${roomId}`);
  });

  socket.on('sendMessage', async ({ senderId, receiverId, message }) => {
    const roomId = getRoomId(senderId, receiverId);
    const newMessage = new Message({ roomId, senderId, message });
    await newMessage.save();

    io.to(roomId).emit('receiveMessage', newMessage);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start server
server.listen(3000, () => {
  console.log('Server listening on port 3000');
});
