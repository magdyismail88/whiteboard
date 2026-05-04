const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
const ghost = document.getElementById('cursor-ghost');
const colorPicker = document.getElementById('colorPicker');
const sizePicker = document.getElementById('sizePicker');
const toolButtons = document.querySelectorAll('.tool-btn');

// --- YOUR LOCKED VALUES (DO NOT CHANGE) ---
const hotspotX = 55; const hotspotY = 0; const offsetX = -2; const offsetY = 0;

let currentTool = 'pencil';
let isDrawing = false;
let objects = []; 
let currentObject = null;
let undoStack = [];

// Selection & Features
let selectedObject = null;
let clipboard = null;
let selectionBox = null;

// --- RENDERING ENGINE ---
function saveState() {
    undoStack.push(JSON.stringify(objects));
    if (undoStack.length > 30) undoStack.shift();
}

function drawObject(obj) {
    ctx.strokeStyle = obj.color;
    ctx.fillStyle = obj.color;
    ctx.lineWidth = obj.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Highlight selected object
    if (obj === selectedObject) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0, 122, 255, 0.5)';
    } else {
        ctx.shadowBlur = 0;
    }

    if (obj.type === 'group') {
        obj.children.forEach(child => drawObject(child));
    } else if (obj.type === 'pencil' || obj.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(obj.points[0].x, obj.points[0].y);
        obj.points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
    } else if (obj.type === 'rect') {
        ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
    } else if (obj.type === 'circle') {
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.r, 0, Math.PI * 2);
        ctx.stroke();
    } else if (obj.type === 'text') {
        ctx.font = `${obj.size * 4}px Arial`;
        ctx.textBaseline = 'top';
        ctx.fillText(obj.text, obj.x, obj.y);
    }
    ctx.shadowBlur = 0;
}

function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    objects.forEach(obj => drawObject(obj));
    
    if (selectionBox) {
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#007aff';
        ctx.lineWidth = 1;
        ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.w, selectionBox.h);
        ctx.setLineDash([]);
    }
}

// --- LOGIC HELPERS ---
function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left - hotspotX + offsetX,
        y: e.clientY - rect.top - hotspotY + offsetY
    };
}

function moveObject(obj, dx, dy) {
    if (obj.type === 'group') obj.children.forEach(c => moveObject(c, dx, dy));
    else if (obj.points) obj.points.forEach(p => { p.x += dx; p.y += dy; });
    else { obj.x += dx; obj.y += dy; }
}

function scaleObject(obj, factor) {
    if (obj.type === 'group') obj.children.forEach(c => scaleObject(c, factor));
    else if (obj.type === 'rect') { obj.w *= factor; obj.h *= factor; }
    else if (obj.type === 'circle') { obj.r *= factor; }
    else if (obj.type === 'text') { obj.size = Math.max(1, obj.size * factor); }
    else if (obj.points) {
        const pivot = obj.points[0];
        obj.points.forEach((p, i) => {
            if (i === 0) return;
            p.x = pivot.x + (p.x - pivot.x) * factor;
            p.y = pivot.y + (p.y - pivot.y) * factor;
        });
        obj.size *= factor;
    }
}

function distToSegment(p, v, w) {
    const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = Math.max(0, Math.min(1, ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

function isPointInObj(pos, obj) {
    if (obj.type === 'group') return obj.children.some(c => isPointInObj(pos, c));
    if (obj.type === 'rect') return pos.x >= obj.x && pos.x <= obj.x + obj.w && pos.y >= obj.y && pos.y <= obj.y + obj.h;
    if (obj.type === 'circle') return Math.hypot(pos.x - obj.x, pos.y - obj.y) <= obj.r;
    if (obj.type === 'text') {
        ctx.font = `${obj.size * 4}px Arial`;
        return pos.x >= obj.x && pos.x <= obj.x + ctx.measureText(obj.text).width && pos.y >= obj.y && pos.y <= obj.y + (obj.size * 4);
    }
    if (obj.points) return obj.points.some((p, j) => j < obj.points.length - 1 && distToSegment(pos, p, obj.points[j+1]) < Math.max(15, obj.size));
    return false;
}

function getObjectAt(pos) {
    for (let i = objects.length - 1; i >= 0; i--) {
        if (isPointInObj(pos, objects[i])) return {obj: objects[i], index: i};
    }
    return null;
}

// --- MOUSE EVENTS ---
canvas.addEventListener('mousedown', (e) => {
    const pos = getPointerPos(e);

    // MOVE LOGIC (Right click OR Move tool)
    if (e.button === 2 || currentTool === 'move') { 
        if (e.button === 2) e.preventDefault();
        const target = getObjectAt(pos);
        if (target) {
            isDrawing = true; currentObject = target.obj; selectedObject = target.obj;
            currentObject.lastPos = pos; redraw();
        }
        return;
    }

    if (currentTool === 'text') { startLiveText(e); return; }
    isDrawing = true;

    if (currentTool === 'group') { selectionBox = { x: pos.x, y: pos.y, w: 0, h: 0 }; return; }

    if (currentTool === 'erase') {
        const target = getObjectAt(pos);
        if (target) { objects.splice(target.index, 1); saveState(); redraw(); }
        isDrawing = false; return;
    }

    const cfg = { color: colorPicker.value, size: sizePicker.value };
    if (currentTool === 'pencil') currentObject = { type: 'pencil', ...cfg, points: [pos] };
    else if (currentTool === 'rect') currentObject = { type: 'rect', ...cfg, x: pos.x, y: pos.y, w: 0, h: 0 };
    else if (currentTool === 'circle') currentObject = { type: 'circle', ...cfg, x: pos.x, y: pos.y, r: 0 };
    else if (currentTool === 'line') currentObject = { type: 'line', ...cfg, points: [pos, pos] };
    if (currentObject) { objects.push(currentObject); selectedObject = currentObject; }
});

canvas.addEventListener('mousemove', (e) => {
    const pos = getPointerPos(e);
    ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
    ghost.style.display = (e.target === canvas) ? "block" : "none";
    if (currentTool === 'erase') ghost.classList.add('rotated'); else ghost.classList.remove('rotated');

    if (!isDrawing) return;

    if (currentTool === 'group' && selectionBox) {
        selectionBox.w = pos.x - selectionBox.x; selectionBox.h = pos.y - selectionBox.y;
    } else if (currentObject && currentObject.lastPos) {
        moveObject(currentObject, pos.x - currentObject.lastPos.x, pos.y - currentObject.lastPos.y);
        currentObject.lastPos = pos;
    } else if (currentObject) {
        if (currentTool === 'pencil') currentObject.points.push(pos);
        else if (currentTool === 'rect') { currentObject.w = pos.x - currentObject.x; currentObject.h = pos.y - currentObject.y; }
        else if (currentTool === 'circle') currentObject.r = Math.hypot(pos.x - currentObject.x, pos.y - currentObject.y);
        else if (currentTool === 'line') currentObject.points[1] = pos;
    }
    redraw();
});

window.addEventListener('mouseup', () => {
    if (currentTool === 'group' && selectionBox) {
        const x1 = Math.min(selectionBox.x, selectionBox.x + selectionBox.w), x2 = Math.max(selectionBox.x, selectionBox.x + selectionBox.w);
        const y1 = Math.min(selectionBox.y, selectionBox.y + selectionBox.h), y2 = Math.max(selectionBox.y, selectionBox.y + selectionBox.h);
        const inside = objects.filter(obj => {
            const ox = obj.x !== undefined ? obj.x : (obj.points ? obj.points[0].x : 0);
            const oy = obj.y !== undefined ? obj.y : (obj.points ? obj.points[0].y : 0);
            return ox >= x1 && ox <= x2 && oy >= y1 && oy <= y2;
        });
        if (inside.length > 1) { const g = { type: 'group', children: inside }; objects = objects.filter(o => !inside.includes(o)); objects.push(g); selectedObject = g; }
        selectionBox = null;
    }
    if (isDrawing) { if (currentObject) delete currentObject.lastPos; isDrawing = false; currentObject = null; saveState(); redraw(); }
});

// --- WHEEL SCALE ---
canvas.addEventListener('wheel', (e) => {
    if (selectedObject) { e.preventDefault(); scaleObject(selectedObject, e.deltaY < 0 ? 1.1 : 0.9); redraw(); }
}, { passive: false });

// --- KEYBOARD ---
window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedObject) clipboard = JSON.stringify(selectedObject);
    if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard) {
        const newObj = JSON.parse(clipboard); moveObject(newObj, 20, 20);
        objects.push(newObj); selectedObject = newObj; saveState(); redraw();
    }
});

// --- UI SETUP ---
document.querySelector('.action-btn.download').onclick = () => {
    const exportCanvas = document.createElement('canvas'); exportCanvas.width = canvas.width; exportCanvas.height = canvas.height;
    const exCtx = exportCanvas.getContext('2d'); exCtx.fillStyle = "#ffffff"; exCtx.fillRect(0, 0, canvas.width, canvas.height);
    exCtx.drawImage(canvas, 0, 0); const link = document.createElement('a'); link.download = 'whiteboard.png'; link.href = exportCanvas.toDataURL(); link.click();
};

function startLiveText(e) {
    if (document.querySelector('.text-draft')) return;
    const pos = getPointerPos(e);
    const input = document.createElement('input'); input.className = 'text-draft';
    const fontSize = parseInt(sizePicker.value) * 4;
    Object.assign(input.style, { fontSize: fontSize+'px', color: colorPicker.value, left: e.clientX+'px', top: (e.clientY - fontSize/2)+'px', position: 'fixed' });
    document.body.appendChild(input); setTimeout(() => input.focus(), 10);
    const finish = () => {
        if (input.value.trim()) {
            const obj = { type: 'text', x: pos.x, y: pos.y, text: input.value, color: colorPicker.value, size: sizePicker.value };
            objects.push(obj); selectedObject = obj; saveState(); redraw();
        }
        input.remove();
    };
    input.onkeydown = k => { if (k.key === 'Enter') finish(); }; input.onblur = finish;
}

function resizeCanvas() {
    const container = document.querySelector('.main-container');
    canvas.width = container.clientWidth - 20; canvas.height = container.clientHeight - 20;
    redraw();
}
window.addEventListener('resize', resizeCanvas); resizeCanvas();

document.getElementById('undo').onclick = () => { if (undoStack.length > 1) { undoStack.pop(); objects = JSON.parse(undoStack[undoStack.length - 1]); redraw(); } };
document.getElementById('clear').onclick = () => { objects = []; saveState(); redraw(); };

toolButtons.forEach(btn => btn.onclick = () => {
    document.querySelector('.tool-btn.active').classList.remove('active'); btn.classList.add('active'); currentTool = btn.dataset.tool;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
saveState();

const themeToggle = document.getElementById('theme-toggle');
let isDarkMode = false;

if (localStorage.getItem('theme') === 'dark') {
    isDarkMode = true;
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.innerText = '☀️';
}

themeToggle.onclick = () => {
    isDarkMode = !isDarkMode;
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    themeToggle.innerText = isDarkMode ? '☀️' : '🌙';
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    
    const el = document.getElementById("whiteboard");

    if (el.style.filter === "invert(1)") {
        el.style.filter = "invert(0)";
    } else {
        el.style.filter = "invert(1)";
    }
};