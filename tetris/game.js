// ===== CONSTANTS AND CONFIGURATION =====

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const LINES_PER_LEVEL = 10;

// Tetromino shapes - each shape is a 2D array where 1 represents a filled block
const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    O: [[1, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]]
};

// Colors for each tetromino
const COLORS = {
    I: '#00f0f0',
    J: '#0000f0',
    L: '#f0a000',
    O: '#f0f000',
    S: '#00f000',
    T: '#a000f0',
    Z: '#f00000'
};

const SHAPE_NAMES = Object.keys(SHAPES);

// Scoring system
const SCORE_VALUES = {
    1: 100,  // Single
    2: 300,  // Double
    3: 500,  // Triple
    4: 800   // Tetris
};

// ===== GAME STATE =====

let canvas, ctx, nextPieceCanvas, nextPieceCtx;
let board = [];
let currentPiece = null;
let nextPiece = null;
let score = 0;
let level = 1;
let lines = 0;
let gameOver = false;
let isPaused = false;
let dropCounter = 0;
let dropInterval = 1000; // milliseconds
let lastTime = 0;

// Input state
let keys = {};

// ===== INITIALIZATION =====

function init() {
    // Get canvas elements
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    nextPieceCanvas = document.getElementById('nextPieceCanvas');
    nextPieceCtx = nextPieceCanvas.getContext('2d');

    // Initialize board - create 2D array filled with 0s
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

    // Set up event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.getElementById('restartButton').addEventListener('click', restartGame);

    // Start the game
    resetGame();
    requestAnimationFrame(gameLoop);
}

// ===== GAME LOOP =====

function gameLoop(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;

    if (!gameOver && !isPaused) {
        dropCounter += deltaTime;

        // Auto drop piece based on level
        if (dropCounter > dropInterval) {
            movePiece(0, 1);
            dropCounter = 0;
        }

        // Handle soft drop (hold down arrow)
        if (keys['ArrowDown']) {
            movePiece(0, 1);
        }
    }

    draw();
    requestAnimationFrame(gameLoop);
}

// ===== PIECE MANAGEMENT =====

function createPiece(shapeName) {
    return {
        shape: SHAPES[shapeName],
        color: COLORS[shapeName],
        name: shapeName,
        x: Math.floor(COLS / 2) - Math.floor(SHAPES[shapeName][0].length / 2),
        y: 0
    };
}

function getRandomPiece() {
    const randomIndex = Math.floor(Math.random() * SHAPE_NAMES.length);
    return createPiece(SHAPE_NAMES[randomIndex]);
}

function spawnPiece() {
    currentPiece = nextPiece || getRandomPiece();
    nextPiece = getRandomPiece();

    // Check if new piece collides immediately (game over)
    if (checkCollision(currentPiece, currentPiece.x, currentPiece.y)) {
        endGame();
    }
}

// ===== COLLISION DETECTION =====

function checkCollision(piece, offsetX, offsetY) {
    for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
            if (piece.shape[y][x]) {
                const newX = piece.x + x + offsetX;
                const newY = piece.y + y + offsetY;

                // Check boundaries
                if (newX < 0 || newX >= COLS || newY >= ROWS) {
                    return true;
                }

                // Check if position is below board (not a collision yet)
                if (newY < 0) {
                    continue;
                }

                // Check board collision
                if (board[newY][newX]) {
                    return true;
                }
            }
        }
    }
    return false;
}

// ===== PIECE MOVEMENT =====

function movePiece(dx, dy) {
    if (!currentPiece || gameOver) return false;

    if (!checkCollision(currentPiece, dx, dy)) {
        currentPiece.x += dx;
        currentPiece.y += dy;
        return true;
    } else if (dy > 0) {
        // If moving down failed, lock the piece
        lockPiece();
    }
    return false;
}

function hardDrop() {
    if (!currentPiece || gameOver) return;

    let dropDistance = 0;
    while (movePiece(0, 1)) {
        dropDistance++;
    }

    // Bonus points for hard drop
    score += dropDistance * 2;
    updateScore();
}

// ===== ROTATION =====

function rotatePiece() {
    if (!currentPiece || gameOver || currentPiece.name === 'O') return;

    const rotated = rotateMatrix(currentPiece.shape);
    const originalShape = currentPiece.shape;

    currentPiece.shape = rotated;

    // Try wall kicks if rotation causes collision
    const kicks = [
        [0, 0],  // No kick
        [-1, 0], // Left
        [1, 0],  // Right
        [0, -1], // Up
        [-1, -1],// Left-Up
        [1, -1]  // Right-Up
    ];

    for (let [dx, dy] of kicks) {
        if (!checkCollision(currentPiece, dx, dy)) {
            currentPiece.x += dx;
            currentPiece.y += dy;
            return;
        }
    }

    // If all kicks failed, revert rotation
    currentPiece.shape = originalShape;
}

function rotateMatrix(matrix) {
    const N = matrix.length;
    const rotated = Array.from({ length: N }, () => Array(N).fill(0));

    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            rotated[x][N - 1 - y] = matrix[y][x];
        }
    }

    return rotated;
}

// ===== LOCKING AND LINE CLEARING =====

function lockPiece() {
    if (!currentPiece) return;

    // Add piece to board
    for (let y = 0; y < currentPiece.shape.length; y++) {
        for (let x = 0; x < currentPiece.shape[y].length; x++) {
            if (currentPiece.shape[y][x]) {
                const boardY = currentPiece.y + y;
                const boardX = currentPiece.x + x;
                if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
                    board[boardY][boardX] = currentPiece.color;
                }
            }
        }
    }

    // Check for cleared lines
    clearLines();

    // Spawn next piece
    spawnPiece();
    dropCounter = 0;
}

function clearLines() {
    let linesCleared = 0;

    for (let y = ROWS - 1; y >= 0; y--) {
        if (board[y].every(cell => cell !== 0)) {
            // Remove the line
            board.splice(y, 1);
            // Add empty line at top
            board.unshift(Array(COLS).fill(0));
            linesCleared++;
            y++; // Check same row again
        }
    }

    if (linesCleared > 0) {
        // Update score
        score += SCORE_VALUES[linesCleared] * level;
        lines += linesCleared;

        // Level up every LINES_PER_LEVEL lines
        const newLevel = Math.floor(lines / LINES_PER_LEVEL) + 1;
        if (newLevel > level) {
            level = newLevel;
            dropInterval = Math.max(100, 1000 - (level - 1) * 100);
        }

        updateScore();
    }
}

// ===== GHOST PIECE (shows where piece will land) =====

function getGhostPieceY() {
    if (!currentPiece) return 0;

    let ghostY = currentPiece.y;
    while (!checkCollision(currentPiece, 0, ghostY - currentPiece.y + 1)) {
        ghostY++;
    }
    return ghostY;
}

// ===== RENDERING =====

function draw() {
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    ctx.strokeStyle = '#2a2a3e';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * BLOCK_SIZE, 0);
        ctx.lineTo(x * BLOCK_SIZE, ROWS * BLOCK_SIZE);
        ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * BLOCK_SIZE);
        ctx.lineTo(COLS * BLOCK_SIZE, y * BLOCK_SIZE);
        ctx.stroke();
    }

    // Draw locked blocks
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x]) {
                drawBlock(ctx, x, y, board[y][x]);
            }
        }
    }

    // Draw ghost piece
    if (currentPiece && !gameOver) {
        const ghostY = getGhostPieceY();
        for (let y = 0; y < currentPiece.shape.length; y++) {
            for (let x = 0; x < currentPiece.shape[y].length; x++) {
                if (currentPiece.shape[y][x]) {
                    drawBlock(ctx, currentPiece.x + x, ghostY + y, currentPiece.color, 0.3);
                }
            }
        }
    }

    // Draw current piece
    if (currentPiece && !gameOver) {
        for (let y = 0; y < currentPiece.shape.length; y++) {
            for (let x = 0; x < currentPiece.shape[y].length; x++) {
                if (currentPiece.shape[y][x]) {
                    drawBlock(ctx, currentPiece.x + x, currentPiece.y + y, currentPiece.color);
                }
            }
        }
    }

    // Draw next piece
    drawNextPiece();
}

function drawBlock(context, x, y, color, alpha = 1) {
    const pixelX = x * BLOCK_SIZE;
    const pixelY = y * BLOCK_SIZE;

    // Main block
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.fillRect(pixelX, pixelY, BLOCK_SIZE, BLOCK_SIZE);

    // Highlight (top-left)
    context.fillStyle = 'rgba(255, 255, 255, 0.3)';
    context.fillRect(pixelX, pixelY, BLOCK_SIZE, 2);
    context.fillRect(pixelX, pixelY, 2, BLOCK_SIZE);

    // Shadow (bottom-right)
    context.fillStyle = 'rgba(0, 0, 0, 0.3)';
    context.fillRect(pixelX, pixelY + BLOCK_SIZE - 2, BLOCK_SIZE, 2);
    context.fillRect(pixelX + BLOCK_SIZE - 2, pixelY, 2, BLOCK_SIZE);

    context.globalAlpha = 1;
}

function drawNextPiece() {
    if (!nextPiece) return;

    // Clear canvas
    nextPieceCtx.fillStyle = '#1a1a2e';
    nextPieceCtx.fillRect(0, 0, nextPieceCanvas.width, nextPieceCanvas.height);

    const smallBlockSize = 25;
    const shape = nextPiece.shape;

    // Calculate offset to center the piece
    const offsetX = (nextPieceCanvas.width - shape[0].length * smallBlockSize) / 2;
    const offsetY = (nextPieceCanvas.height - shape.length * smallBlockSize) / 2;

    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            if (shape[y][x]) {
                const pixelX = offsetX + x * smallBlockSize;
                const pixelY = offsetY + y * smallBlockSize;

                nextPieceCtx.fillStyle = nextPiece.color;
                nextPieceCtx.fillRect(pixelX, pixelY, smallBlockSize, smallBlockSize);

                // Add highlights
                nextPieceCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                nextPieceCtx.fillRect(pixelX, pixelY, smallBlockSize, 2);
                nextPieceCtx.fillRect(pixelX, pixelY, 2, smallBlockSize);
            }
        }
    }
}

// ===== INPUT HANDLING =====

function handleKeyDown(e) {
    if (gameOver && e.key.toLowerCase() === 'r') {
        restartGame();
        return;
    }

    if (gameOver) return;

    keys[e.key] = true;

    switch (e.key) {
        case 'ArrowLeft':
            movePiece(-1, 0);
            e.preventDefault();
            break;
        case 'ArrowRight':
            movePiece(1, 0);
            e.preventDefault();
            break;
        case 'ArrowUp':
            rotatePiece();
            e.preventDefault();
            break;
        case 'ArrowDown':
            e.preventDefault();
            break;
        case ' ':
            hardDrop();
            e.preventDefault();
            break;
        case 'r':
        case 'R':
            restartGame();
            e.preventDefault();
            break;
    }
}

function handleKeyUp(e) {
    keys[e.key] = false;
}

// ===== GAME STATE MANAGEMENT =====

function updateScore() {
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
    document.getElementById('lines').textContent = lines;
}

function resetGame() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    currentPiece = null;
    nextPiece = null;
    score = 0;
    level = 1;
    lines = 0;
    gameOver = false;
    dropInterval = 1000;
    dropCounter = 0;

    updateScore();
    spawnPiece();

    // Hide game over screen
    document.getElementById('gameOverScreen').classList.add('hidden');
}

function restartGame() {
    resetGame();
}

function endGame() {
    gameOver = true;

    // Show game over screen
    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalLines').textContent = lines;
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

// ===== START THE GAME =====

window.addEventListener('DOMContentLoaded', init);
