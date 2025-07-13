/**
 * 俄罗斯方块游戏
 * 使用HTML5 Canvas实现
 */

// 游戏常量
const COLS = 10;  // 游戏区域列数
const ROWS = 20;  // 游戏区域行数
const BLOCK_SIZE = 30;  // 每个方块的大小（像素）
const COLORS = [
    null,
    '#FF0D72', // I
    '#0DC2FF', // J
    '#0DFF72', // L
    '#F538FF', // O
    '#FF8E0D', // S
    '#FFE138', // T
    '#3877FF'  // Z
];

// 方块形状定义
const SHAPES = [
    null,
    // I
    [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],
    // J
    [
        [2, 0, 0],
        [2, 2, 2],
        [0, 0, 0]
    ],
    // L
    [
        [0, 0, 3],
        [3, 3, 3],
        [0, 0, 0]
    ],
    // O
    [
        [4, 4],
        [4, 4]
    ],
    // S
    [
        [0, 5, 5],
        [5, 5, 0],
        [0, 0, 0]
    ],
    // T
    [
        [0, 6, 0],
        [6, 6, 6],
        [0, 0, 0]
    ],
    // Z
    [
        [7, 7, 0],
        [0, 7, 7],
        [0, 0, 0]
    ]
];

// 游戏状态
const gameState = {
    score: 0,
    level: 1,
    lines: 0,
    gameOver: false,
    paused: false,
    dropCounter: 0,
    dropInterval: 1000, // 初始掉落时间间隔（毫秒）
    lastTime: 0,
    grid: createMatrix(COLS, ROWS)
};

// 当前方块和下一个方块
let currentPiece = null;
let nextPiece = null;

// 获取游戏画布和上下文
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.scale(BLOCK_SIZE, BLOCK_SIZE);

// 获取预览画布和上下文
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');
const nextScale = 25; // 预览方块的大小
nextCtx.scale(nextScale, nextScale);

// 获取DOM元素
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const linesElement = document.getElementById('lines');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');

// 按钮事件监听
startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', pauseGame);
restartBtn.addEventListener('click', restartGame);

// 键盘事件监听
document.addEventListener('keydown', handleKeyPress);

/**
 * 创建指定大小的矩阵（用于游戏区域）
 * @param {number} width - 矩阵宽度
 * @param {number} height - 矩阵高度
 * @returns {Array<Array<number>>} - 初始化的矩阵
 */
function createMatrix(width, height) {
    const matrix = [];
    for (let y = 0; y < height; y++) {
        matrix.push(new Array(width).fill(0));
    }
    return matrix;
}

/**
 * 创建新的方块
 * @returns {Object} - 新创建的方块对象
 */
function createPiece() {
    // 随机选择一个方块类型（1-7）
    const type = Math.floor(Math.random() * 7) + 1;
    const matrix = SHAPES[type];
    
    return {
        matrix,
        pos: {x: Math.floor(COLS / 2) - Math.floor(matrix[0].length / 2), y: 0},
        type
    };
}

/**
 * 检查碰撞
 * @param {Object} piece - 方块对象
 * @param {Array<Array<number>>} grid - 游戏区域
 * @param {Object} offset - 位置偏移
 * @returns {boolean} - 是否发生碰撞
 */
function checkCollision(piece, grid, offset = {x: 0, y: 0}) {
    const matrix = piece.matrix;
    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
            if (matrix[y][x] !== 0 &&
                (grid[y + piece.pos.y + offset.y] === undefined ||
                 grid[y + piece.pos.y + offset.y][x + piece.pos.x + offset.x] === undefined ||
                 grid[y + piece.pos.y + offset.y][x + piece.pos.x + offset.x] !== 0)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * 将方块合并到游戏区域
 * @param {Object} piece - 方块对象
 * @param {Array<Array<number>>} grid - 游戏区域
 */
function merge(piece, grid) {
    piece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                grid[y + piece.pos.y][x + piece.pos.x] = value;
            }
        });
    });
}

/**
 * 旋转方块
 * @param {Array<Array<number>>} matrix - 方块矩阵
 * @param {number} dir - 旋转方向 (1:顺时针, -1:逆时针)
 * @returns {Array<Array<number>>} - 旋转后的矩阵
 */
function rotate(matrix, dir) {
    // 转置矩阵
    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < y; x++) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    
    // 根据方向翻转行
    if (dir > 0) {
        matrix.forEach(row => row.reverse());
    } else {
        matrix.reverse();
    }
    
    return matrix;
}

/**
 * 方块旋转
 * @param {number} dir - 旋转方向
 */
function rotatePiece(dir) {
    if (gameState.gameOver || gameState.paused) return;
    
    const originalPos = {...currentPiece.pos};
    const originalMatrix = currentPiece.matrix.map(row => [...row]);
    
    rotate(currentPiece.matrix, dir);
    
    // 检查旋转后是否有碰撞，如果有，尝试调整位置
    let offset = 1;
    while (checkCollision(currentPiece, gameState.grid)) {
        currentPiece.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        
        // 如果尝试调整位置后仍有碰撞，还原旋转
        if (offset > currentPiece.matrix[0].length) {
            currentPiece.matrix = originalMatrix;
            currentPiece.pos = originalPos;
            break;
        }
    }
    
    draw();
}

/**
 * 移动方块
 * @param {number} dir - 移动方向 (-1:左, 1:右)
 */
function movePiece(dir) {
    if (gameState.gameOver || gameState.paused) return;
    
    currentPiece.pos.x += dir;
    if (checkCollision(currentPiece, gameState.grid)) {
        currentPiece.pos.x -= dir;
    }
    
    draw();
}

/**
 * 下落方块
 */
function dropPiece() {
    if (gameState.gameOver || gameState.paused) return;
    
    currentPiece.pos.y++;
    if (checkCollision(currentPiece, gameState.grid)) {
        currentPiece.pos.y--;
        merge(currentPiece, gameState.grid);
        resetPiece();
        clearRows();
        updateScore();
        draw();
    }
    
    gameState.dropCounter = 0;
}

/**
 * 硬下落（直接落到底部）
 */
function hardDrop() {
    if (gameState.gameOver || gameState.paused) return;
    
    while (!checkCollision(currentPiece, gameState.grid, {x: 0, y: 1})) {
        currentPiece.pos.y++;
        gameState.score += 1;  // 硬下落每下落一格加1分
    }
    
    dropPiece();
    draw();
}

/**
 * 重置方块（创建新方块）
 */
function resetPiece() {
    currentPiece = nextPiece || createPiece();
    nextPiece = createPiece();
    
    // 检查游戏是否结束
    if (checkCollision(currentPiece, gameState.grid)) {
        gameState.gameOver = true;
        pauseBtn.disabled = true;
        startBtn.disabled = false;
    }
}

/**
 * 清除已填满的行
 */
function clearRows() {
    let linesCleared = 0;
    
    outer: for (let y = gameState.grid.length - 1; y >= 0; y--) {
        for (let x = 0; x < gameState.grid[y].length; x++) {
            if (gameState.grid[y][x] === 0) {
                continue outer;
            }
        }
        
        // 移除填满的行
        const row = gameState.grid.splice(y, 1)[0].fill(0);
        gameState.grid.unshift(row);
        y++;
        linesCleared++;
    }
    
    // 更新统计
    if (linesCleared > 0) {
        gameState.lines += linesCleared;
        
        // 根据消除的行数计算得分
        // 1行=100分，2行=300分，3行=500分，4行=800分
        const points = [0, 100, 300, 500, 800];
        gameState.score += points[linesCleared] * gameState.level;
        
        // 每清除10行升一级
        gameState.level = Math.floor(gameState.lines / 10) + 1;
        
        // 更新下落速度
        gameState.dropInterval = Math.max(1000 - (gameState.level - 1) * 100, 100);
    }
}

/**
 * 更新分数显示
 */
function updateScore() {
    scoreElement.textContent = gameState.score;
    levelElement.textContent = gameState.level;
    linesElement.textContent = gameState.lines;
}

/**
 * 绘制方块
 * @param {Array<Array<number>>} matrix - 方块矩阵
 * @param {Object} offset - 位置偏移
 * @param {CanvasRenderingContext2D} context - 绘图上下文
 */
function drawMatrix(matrix, offset, context) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillStyle = COLORS[value];
                context.fillRect(x + offset.x, y + offset.y, 1, 1);
                
                // 绘制边框
                context.strokeStyle = '#FFF';
                context.lineWidth = 0.05;
                context.strokeRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

/**
 * 绘制预览方块
 */
function drawNextPiece() {
    nextCtx.clearRect(0, 0, nextCanvas.width / nextScale, nextCanvas.height / nextScale);
    
    if (nextPiece) {
        // 计算居中位置
        const offset = {
            x: (4 - nextPiece.matrix[0].length) / 2,
            y: (4 - nextPiece.matrix.length) / 2
        };
        
        drawMatrix(nextPiece.matrix, offset, nextCtx);
    }
}

/**
 * 绘制游戏区域
 */
function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawMatrix(gameState.grid, {x: 0, y: 0}, ctx);
    
    if (currentPiece) {
        // 绘制影子（预测落点）
        const ghostPiece = {
            matrix: currentPiece.matrix,
            pos: {...currentPiece.pos},
            type: currentPiece.type
        };
        
        while (!checkCollision(ghostPiece, gameState.grid, {x: 0, y: 1})) {
            ghostPiece.pos.y++;
        }
        
        // 绘制影子
        ctx.globalAlpha = 0.3;
        drawMatrix(ghostPiece.matrix, ghostPiece.pos, ctx);
        ctx.globalAlpha = 1;
        
        // 绘制当前方块
        drawMatrix(currentPiece.matrix, currentPiece.pos, ctx);
    }
}

/**
 * 绘制所有元素
 */
function draw() {
    drawGrid();
    drawNextPiece();
}

/**
 * 游戏主循环
 * @param {number} time - 当前时间戳
 */
function update(time = 0) {
    const deltaTime = time - gameState.lastTime;
    gameState.lastTime = time;
    
    if (!gameState.gameOver && !gameState.paused) {
        gameState.dropCounter += deltaTime;
        if (gameState.dropCounter > gameState.dropInterval) {
            dropPiece();
        }
    }
    
    draw();
    requestAnimationFrame(update);
}

/**
 * 处理键盘按键
 * @param {KeyboardEvent} event - 键盘事件
 */
function handleKeyPress(event) {
    if (gameState.gameOver) return;
    
    switch (event.keyCode) {
        case 37: // 左箭头
            movePiece(-1);
            break;
        case 39: // 右箭头
            movePiece(1);
            break;
        case 40: // 下箭头
            dropPiece();
            break;
        case 38: // 上箭头
            rotatePiece(1);
            break;
        case 32: // 空格
            hardDrop();
            break;
        case 80: // P键
            pauseGame();
            break;
    }
}

/**
 * 开始游戏
 */
function startGame() {
    if (!gameState.gameOver && gameState.paused) {
        // 如果游戏已暂停，则继续游戏
        gameState.paused = false;
        pauseBtn.textContent = '暂停';
        startBtn.disabled = true;
        requestAnimationFrame(update);
        return;
    }
    
    // 重置游戏状态
    gameState.score = 0;
    gameState.level = 1;
    gameState.lines = 0;
    gameState.gameOver = false;
    gameState.paused = false;
    gameState.dropCounter = 0;
    gameState.dropInterval = 1000;
    gameState.grid = createMatrix(COLS, ROWS);
    
    // 创建初始方块
    currentPiece = createPiece();
    nextPiece = createPiece();
    
    // 更新UI
    updateScore();
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    pauseBtn.textContent = '暂停';
    
    // 开始游戏循环
    gameState.lastTime = 0;
    requestAnimationFrame(update);
}

/**
 * 暂停游戏
 */
function pauseGame() {
    if (gameState.gameOver) return;
    
    gameState.paused = !gameState.paused;
    
    if (gameState.paused) {
        pauseBtn.textContent = '继续';
        startBtn.disabled = false;
    } else {
        pauseBtn.textContent = '暂停';
        startBtn.disabled = true;
        requestAnimationFrame(update);
    }
}

/**
 * 重新开始游戏
 */
function restartGame() {
    startGame();
}

// 初始化显示
draw();