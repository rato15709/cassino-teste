const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['slots', 'roulette', 'poker', 'blackjack', 'baccarat', 'craps']
    },
    status: {
        type: String,
        enum: ['waiting', 'playing', 'completed', 'cancelled', 'paused'],
        default: 'waiting'
    },
    players: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    maxPlayers: {
        type: Number,
        default: 2,
        min: 1,
        max: 10
    },
    betAmount: {
        type: Number,
        required: true,
        min: 1
    },
    totalPot: {
        type: Number,
        default: 0
    },
    houseEdge: {
        type: Number,
        default: 0.05
    },
    winner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    winnings: {
        type: Number,
        default: 0
    },
    moves: [{
        player: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        move: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        duration: Number // Time taken for this move in milliseconds
    }],
    gameState: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    settings: {
        isPrivate: { type: Boolean, default: false },
        password: String,
        allowSpectators: { type: Boolean, default: true },
        timeLimit: { type: Number, default: 300 }, // seconds per move
        minBet: Number,
        maxBet: Number,
        variant: String // e.g., 'texas-holdem', 'omaha', 'european-roulette'
    },
    spectators: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        joinedAt: { type: Date, default: Date.now }
    }],
    chat: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        message: String,
        timestamp: { type: Date, default: Date.now }
    }],
    startedAt: Date,
    completedAt: Date,
    duration: Number, // Total game duration in seconds
    forfeitedPlayers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    disconnectedPlayers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    tournament: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tournament'
    },
    statistics: {
        totalMoves: { type: Number, default: 0 },
        averageMoveTime: { type: Number, default: 0 },
        potSize: { type: Number, default: 0 },
        rake: { type: Number, default: 0 }
    },
    replay: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtuals
gameSchema.virtual('isActive').get(function() {
    return ['waiting', 'playing'].includes(this.status);
});

gameSchema.virtual('isFull').get(function() {
    return this.players.length >= this.maxPlayers;
});

gameSchema.virtual('playerCount').get(function() {
    return this.players.length;
});

gameSchema.virtual('spectatorCount').get(function() {
    return this.spectators.length;
});

// Indexes
gameSchema.index({ type: 1, status: 1 });
gameSchema.index({ players: 1 });
gameSchema.index({ winner: 1 });
gameSchema.index({ createdAt: -1 });
gameSchema.index({ startedAt: -1 });
gameSchema.index({ completedAt: -1 });
gameSchema.index({ 'tournament': 1 });

// Middleware
gameSchema.pre('save', function(next) {
    // Calculate total pot
    this.totalPot = this.betAmount * this.players.length;
    
    // Calculate winnings (minus house edge)
    if (this.winner && this.totalPot > 0) {
        this.winnings = this.totalPot * (1 - this.houseEdge);
        this.statistics.rake = this.totalPot * this.houseEdge;
    }
    
    // Calculate duration
    if (this.startedAt && this.completedAt) {
        this.duration = Math.floor((this.completedAt - this.startedAt) / 1000);
    }
    
    next();
});

// Instance methods
gameSchema.methods.addPlayer = function(userId) {
    if (this.players.length >= this.maxPlayers) {
        throw new Error('Game is full');
    }
    
    if (this.players.includes(userId)) {
        throw new Error('Player already in game');
    }
    
    this.players.push(userId);
    return this.save();
};

gameSchema.methods.removePlayer = function(userId) {
    const index = this.players.indexOf(userId);
    if (index > -1) {
        this.players.splice(index, 1);
    }
    
    // Add to disconnected players
    if (!this.disconnectedPlayers.includes(userId)) {
        this.disconnectedPlayers.push(userId);
    }
    
    // If no players left, cancel game
    if (this.players.length === 0) {
        this.status = 'cancelled';
    }
    
    return this.save();
};

gameSchema.methods.addMove = function(playerId, move) {
    this.moves.push({
        player: playerId,
        move,
        timestamp: new Date()
    });
    
    this.statistics.totalMoves = this.moves.length;
    
    // Update game state based on move
    this.updateGameState(move);
    
    return this.save();
};

gameSchema.methods.updateGameState = function(move) {
    // This would be implemented based on game type
    // For now, just store the move
    this.gameState.lastMove = move;
    this.gameState.lastMoveTime = new Date();
};

gameSchema.methods.startGame = function() {
    if (this.players.length < 2) {
        throw new Error('Not enough players to start game');
    }
    
    this.status = 'playing';
    this.startedAt = new Date();
    
    // Initialize game state
    this.gameState = {
        currentTurn: this.players[0],
        round: 1,
        moves: []
    };
    
    return this.save();
};

gameSchema.methods.endGame = function(winnerId) {
    this.status = 'completed';
    this.winner = winnerId;
    this.completedAt = new Date();
    
    // Calculate winnings
    this.winnings = this.totalPot * (1 - this.houseEdge);
    
    return this.save();
};

gameSchema.methods.addSpectator = function(userId) {
    if (!this.settings.allowSpectators) {
        throw new Error('Spectators not allowed');
    }
    
    const existingSpectator = this.spectators.find(s => s.user.toString() === userId.toString());
    if (!existingSpectator) {
        this.spectators.push({ user: userId });
    }
    
    return this.save();
};

gameSchema.methods.removeSpectator = function(userId) {
    this.spectators = this.spectators.filter(s => s.user.toString() !== userId.toString());
    return this.save();
};

gameSchema.methods.addChatMessage = function(userId, message) {
    this.chat.push({
        user: userId,
        message,
        timestamp: new Date()
    });
    
    return this.save();
};

// Static methods
gameSchema.statics.findActiveGames = function(gameType = null) {
    const query = { status: { $in: ['waiting', 'playing'] } };
    if (gameType) {
        query.type = gameType;
    }
    
    return this.find(query)
        .populate('players', 'username avatar')
        .sort({ createdAt: -1 });
};

gameSchema.statics.findAvailableGames = function(gameType = null, betRange = null) {
    const query = { 
        status: 'waiting',
        $expr: { $lt: ['$players.length', '$maxPlayers'] }
    };
    
    if (gameType) {
        query.type = gameType;
    }
    
    if (betRange) {
        query.betAmount = { $gte: betRange.min, $lte: betRange.max };
    }
    
    return this.find(query)
        .populate('players', 'username avatar')
        .sort({ betAmount: -1, createdAt: -1 });
};

gameSchema.statics.getUserGameHistory = function(userId, limit = 20) {
    return this.find({
        players: userId
    })
    .populate('players winner', 'username avatar')
    .sort({ createdAt: -1 })
    .limit(limit);
};

gameSchema.statics.getGameStatistics = function(gameType = null, dateRange = null) {
    const matchStage = {};
    
    if (gameType) {
        matchStage.type = gameType;
    }
    
    if (dateRange) {
        matchStage.createdAt = {
            $gte: dateRange.start,
            $lte: dateRange.end
        };
    }
    
    return this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$type',
                totalGames: { $sum: 1 },
                totalPot: { $sum: '$totalPot' },
                averagePot: { $avg: '$totalPot' },
                totalRake: { $sum: '$statistics.rake' },
                averageDuration: { $avg: '$duration' },
                completedGames: {
                    $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                }
            }
        },
        { $sort: { totalGames: -1 } }
    ]);
};

module.exports = mongoose.model('Game', gameSchema);
