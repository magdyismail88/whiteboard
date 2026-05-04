const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
const ghost = document.getElementById('cursor-ghost');
const colorPicker = document.getElementById('colorPicker');
const sizePicker = document.getElementById('sizePicker');
const toolButtons = document.querySelectorAll('.tool-btn');

// --- YOUR LOCKED VALUES - DO NOT CHANGE ---
const hotspotX = 55; 
const hotspotY = 0; 
const offsetX = -2;  
const offsetY = 0;  

let drawing = false;
let erasing = false;
let currentTool = 'pencil';
let startX, startY, snapshot;

// UNDO/REDO STORAGE
let undoStack = [];
let redoStack = [];

// --- INITIALIZATION ---
function saveState() {
    undoStack.push(canvas.toDataURL());
    if (undoStack.length > 25) undoStack.shift();
    redoStack = [];
}

function resizeCanvas() {
    const container = document.querySelector('.main-container');
    const tempImage = canvas.toDataURL();
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.src = tempImage;
    saveState();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- GHOST CURSOR MOVEMENT ---
window.addEventListener('mousemove', (e) => {
    ghost.style.left = e.clientX + 'px';
    ghost.style.top = e.clientY + 'px';
    ghost.style.display = (e.target === canvas) ? "block" : "none";
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left - hotspotX + offsetX,
        y: e.clientY - rect.top - hotspotY + offsetY
    };
}

// --- MAIN MOUSE EVENTS ---
canvas.addEventListener('mousedown', (e) => {
    // TEXT TOOL START
    if (currentTool === 'text' && e.button === 0) {
        startLiveText(e);
        return;
    }

    if (e.button === 2) {
        erasing = true;
        ghost.classList.add('rotated'); 
    }

    drawing = true;
    const pos = getPointerPos(e);
    startX = pos.x;
    startY = pos.y;
    snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineWidth = sizePicker.value;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
});

canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    const pos = getPointerPos(e);
    if (currentTool !== 'pencil' && !erasing) ctx.putImageData(snapshot, 0, 0);

    ctx.strokeStyle = erasing ? '#ffffff' : colorPicker.value;

    if (erasing || currentTool === 'pencil') {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    } else {
        ctx.beginPath();
        if (currentTool === 'rect') ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
        else if (currentTool === 'circle') {
            let r = Math.sqrt(Math.pow(startX - pos.x, 2) + Math.pow(startY - pos.y, 2));
            ctx.arc(startX, startY, r, 0, 2 * Math.PI);
            ctx.stroke();
        } else if (currentTool === 'line') {
            ctx.moveTo(startX, startY); ctx.lineTo(pos.x, pos.y); ctx.stroke();
        }
    }
});

window.addEventListener('mouseup', (e) => {
    if (drawing) {
        drawing = false;
        if (e.button === 2) { erasing = false; ghost.classList.remove('rotated'); }
        saveState();
    }
});

// --- ROBUST TEXT TOOL ---
function startLiveText(e) {
    if (document.querySelector('.text-draft')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'text-draft';
    
    const fontSize = parseInt(sizePicker.value) * 4;
    
    // Position the input exactly at the mouse click
    input.style.fontSize = fontSize + 'px';
    input.style.color = colorPicker.value;
    input.style.left = e.clientX + 'px';
    input.style.top = (e.clientY - (fontSize / 2)) + 'px';
    input.style.width = '250px';
    input.style.background = 'transparent';
    input.style.border = '1px dashed #007aff';
    input.style.position = 'fixed';
    input.style.zIndex = '3000';

    document.body.appendChild(input);
    
    // Force focus so user can type immediately
    setTimeout(() => input.focus(), 10);

    const finish = () => {
        const val = input.value.trim();
        if (val) {
            const rect = canvas.getBoundingClientRect();
            // Calculate canvas position using your locked hotspots
            const canvasX = input.offsetLeft - rect.left - hotspotX + offsetX;
            const canvasY = input.offsetTop - rect.top - hotspotY + offsetY;
            
            ctx.fillStyle = colorPicker.value;
            ctx.font = `${fontSize}px Arial`;
            ctx.textBaseline = 'top';
            ctx.fillText(val, canvasX, canvasY);
            saveState();
        }
        if (input.parentNode) {
            document.body.removeChild(input);
        }
    };

    // Listen for Enter key
    input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') {
            ke.preventDefault();
            finish();
        }
        if (ke.key === 'Escape') {
            if (input.parentNode) document.body.removeChild(input);
        }
    });

    // Handle clicking away
    input.addEventListener('blur', () => {
        // Short delay to allow Enter key to finish first if that was the cause
        setTimeout(finish, 100);
    });
}

// --- CONTROLS ---
function loadCanvasState(dataURL) {
    const img = new Image();
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
    };
    img.src = dataURL;
}

document.getElementById('undo').addEventListener('click', () => {
    if (undoStack.length > 1) {
        redoStack.push(undoStack.pop());
        loadCanvasState(undoStack[undoStack.length - 1]);
    }
});

document.getElementById('redo').addEventListener('click', () => {
    if (redoStack.length > 0) {
        const state = redoStack.pop();
        undoStack.push(state);
        loadCanvasState(state);
    }
});

document.getElementById('toggleGrid').addEventListener('click', (e) => {
    canvas.classList.toggle('grid-active');
    e.target.innerText = canvas.classList.contains('grid-active') ? "Grid: On" : "Grid: Off";
});

document.getElementById('clear').addEventListener('click', () => {
    if (confirm("Clear all?")) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        saveState();
    }
});

document.getElementById('download').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'whiteboard.png';
    link.href = canvas.toDataURL();
    link.click();
});

toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const activeBtn = document.querySelector('.tool-btn.active');
        if (activeBtn) activeBtn.classList.remove('active');
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
    });
});