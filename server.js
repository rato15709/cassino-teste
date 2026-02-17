const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const gameRoutes = require('./routes/games');
const transactionRoutes = require('./routes/transactions');
const adminRoutes = require('./routes/admin');
const tournamentRoutes = require('./routes/tournaments');

// Import models
const User = require('./models/User');
const Game = require('./models/Game');
const Transaction = require('./models/Transaction');
const Tournament = require('./models/Tournament');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Static files
app.use(express.static('public'));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lucky-casino', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('Conectado ao MongoDB'))
.catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tournaments', tournamentRoutes);

// Socket.IO for real-time features
const connectedUsers = new Map();

io.on('connection', (socket) => {
    console.log('Usuário conectado:', socket.id);

    // User authentication
    socket.on('authenticate', async (token) => {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('-password');
            if (user) {
                connectedUsers.set(socket.id, user);
                socket.userId = user._id;
                socket.emit('authenticated', { user });
                
                // Broadcast user status
                socket.broadcast.emit('userOnline', { 
                    userId: user._id, 
                    username: user.username 
                });
            }
        } catch (error) {
            socket.emit('authenticationError', { message: 'Token inválido' });
        }
    });

    // Multiplayer game events
    socket.on('joinGame', async (gameData) => {
        const { gameType, betAmount } = gameData;
        const user = connectedUsers.get(socket.id);
        
        if (!user || user.balance < betAmount) {
            socket.emit('gameError', { message: 'Saldo insuficiente' });
            return;
        }

        // Join game room
        const room = `${gameType}_${betAmount}`;
        socket.join(room);

        // Create or join game session
        let game = await Game.findOne({ 
            type: gameType, 
            betAmount, 
            status: 'waiting',
            players: { $lt: 2 }
        });

        if (!game) {
            game = new Game({
                type: gameType,
                betAmount,
                players: [user._id],
                status: 'waiting'
            });
        } else {
            game.players.push(user._id);
            game.status = 'active';
        }

        await game.save();

        // Deduct bet amount
        await User.findByIdAndUpdate(user._id, { 
            $inc: { balance: -betAmount } 
        });

        socket.emit('joinedGame', { gameId: game._id, room });

        // If game is full, start it
        if (game.players.length === 2) {
            io.to(room).emit('gameStart', { gameId: game._id });
            
            // Update game status
            await Game.findByIdAndUpdate(game._id, { 
                status: 'playing',
                startedAt: new Date()
            });
        }
    });

    // Game moves
    socket.on('gameMove', async (moveData) => {
        const { gameId, move } = moveData;
        const user = connectedUsers.get(socket.id);
        
        const game = await Game.findById(gameId);
        if (!game || !game.players.includes(user._id)) {
            return;
        }

        // Add move to game history
        game.moves.push({
            player: user._id,
            move,
            timestamp: new Date()
        });

        // Broadcast move to other players
        socket.to(`game_${gameId}`).emit('opponentMove', {
            move,
            player: user.username
        });

        // Check if game is complete (simplified logic)
        if (game.moves.length >= 10) { // Example condition
            const winner = game.players[Math.floor(Math.random() * game.players.length)];
            game.status = 'completed';
            game.winner = winner;
            game.completedAt = new Date();

            // Update winner's balance
            const winAmount = game.betAmount * 2 * 0.95; // 5% house edge
            await User.findByIdAndUpdate(winner, { 
                $inc: { balance: winAmount } 
            });

            await game.save();

            // Broadcast results
            io.to(`game_${gameId}`).emit('gameEnd', {
                winner,
                winAmount,
                game
            });
        } else {
            await game.save();
        }
    });

    // Live chat
    socket.on('sendMessage', async (messageData) => {
        const user = connectedUsers.get(socket.id);
        if (!user) return;

        const message = {
            userId: user._id,
            username: user.username,
            avatar: user.avatar,
            message: messageData.message,
            timestamp: new Date()
        };

        // Broadcast to all users in chat room
        io.to('global_chat').emit('newMessage', message);

        // Save message to database (optional)
        // await ChatMessage.create(message);
    });

    // Join global chat
    socket.on('joinChat', () => {
        socket.join('global_chat');
    });

    // Tournament events
    socket.on('joinTournament', async (tournamentId) => {
        const user = connectedUsers.get(socket.id);
        const tournament = await Tournament.findById(tournamentId);

        if (!tournament || tournament.participants.includes(user._id)) {
            socket.emit('tournamentError', { message: 'Não foi possível entrar no torneio' });
            return;
        }

        if (user.balance < tournament.entryFee) {
            socket.emit('tournamentError', { message: 'Saldo insuficiente para o torneio' });
            return;
        }

        // Add user to tournament
        tournament.participants.push(user._id);
        await tournament.save();

        // Deduct entry fee
        await User.findByIdAndUpdate(user._id, { 
            $inc: { balance: -tournament.entryFee } 
        });

        socket.join(`tournament_${tournamentId}`);
        socket.emit('joinedTournament', { tournamentId });

        // Broadcast to tournament participants
        io.to(`tournament_${tournamentId}`).emit('tournamentUpdate', {
            participants: tournament.participants.length,
            maxParticipants: tournament.maxParticipants
        });
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            connectedUsers.delete(socket.id);
            
            // Broadcast user offline status
            socket.broadcast.emit('userOffline', { 
                userId: user._id, 
                username: user.username 
            });

            // Handle active games
            const activeGames = await Game.find({
                players: user._id,
                status: { $in: ['waiting', 'playing'] }
            });

            for (const game of activeGames) {
                // Mark user as forfeited
                game.forfeitedPlayers = game.forfeitedPlayers || [];
                game.forfeitedPlayers.push(user._id);

                if (game.players.length - game.forfeitedPlayers.length <= 1) {
                    // Game ends due to forfeit
                    const remainingPlayer = game.players.find(
                        p => !game.forfeitedPlayers.includes(p)
                    );
                    
                    if (remainingPlayer) {
                        game.winner = remainingPlayer;
                        game.status = 'completed';
                        game.completedAt = new Date();

                        // Refund remaining player
                        const refundAmount = game.betAmount * 0.9; // 10% penalty
                        await User.findByIdAndUpdate(remainingPlayer, { 
                            $inc: { balance: refundAmount } 
                        });
                    }
                }

                await game.save();
            }
        }

        console.log('Usuário desconectado:', socket.id);
    });
});

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date(),
        connectedUsers: connectedUsers.size
    });
});

// Get online users count
app.get('/api/stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeGames = await Game.countDocuments({ status: 'playing' });
        const totalTransactions = await Transaction.countDocuments();
        
        res.json({
            onlineUsers: connectedUsers.size,
            totalUsers,
            activeGames,
            totalTransactions,
            serverTime: new Date()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Algo deu errado no servidor!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Socket.IO rodando para real-time features`);
});

module.exports = { app, server, io };
