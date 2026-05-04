const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const sizePicker = document.getElementById('sizePicker');
const eraserBtn = document.getElementById('eraser');
const clearBtn = document.getElementById('clear');
const downloadBtn = document.getElementById('download');

let drawing = false;
let erasing = false;
let color = colorPicker.value;
let size = sizePicker.value;

// PNG cursor tip offset
const hotspotX = 50; // horizontal offset to pencil tip
const hotspotY = 0; // vertical offset to pencil tip
const offsetX = -2;  // fine-tune horizontal shift
const offsetY = 0;   // fine-tune vertical shift

let lastX = 0, lastY = 0;
let points = [];

// Resize canvas to full window
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - document.querySelector('.toolbar').offsetHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Start drawing
function startDrawing(e) {
  drawing = true;
  const { x, y } = getPointerPos(e);
  lastX = x;
  lastY = y;
  points.push({ x, y, time: Date.now() });
  e.preventDefault();
}

// Stop drawing
function stopDrawing() {
  drawing = false;
  points = [];
}

// Get pointer position aligned with pencil tip
function getPointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left - hotspotX + offsetX;
  const y = e.clientY - rect.top - hotspotY + offsetY;
  return { x, y };
}

// Smooth rendering with optional dynamic thickness
function render() {
  if (points.length > 1) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];

      // dynamic thickness based on speed (optional)
      const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const time = p1.time - p0.time;
      let speed = time > 0 ? dist / time : 0;
      ctx.lineWidth = Math.max(1, size - speed * 10);

      ctx.strokeStyle = erasing ? '#ffffff' : color;
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    points = [points[points.length - 1]]; // keep last point for continuity
  }
  requestAnimationFrame(render);
}
render();

// Pointer events (mouse + touch)
canvas.addEventListener('pointerdown', startDrawing);
canvas.addEventListener('pointermove', e => {
  if (!drawing) return;
  const { x, y } = getPointerPos(e);
  points.push({ x, y, time: Date.now() });
});
canvas.addEventListener('pointerup', stopDrawing);
canvas.addEventListener('pointerout', stopDrawing);

// Toolbar actions
colorPicker.addEventListener('input', e => { color = e.target.value; erasing = false; });
sizePicker.addEventListener('input', e => size = e.target.value);
eraserBtn.addEventListener('click', () => { erasing = true; });
clearBtn.addEventListener('click', () => { ctx.clearRect(0, 0, canvas.width, canvas.height); });
downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'whiteboard.png';
  link.href = canvas.toDataURL();
  link.click();
});
