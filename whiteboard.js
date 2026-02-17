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

// Set canvas to full window size
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - document.querySelector('.toolbar').offsetHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Draw function
function draw(e) {
  if (!drawing) return;
  ctx.strokeStyle = erasing ? '#ffffff' : color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';

  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
}

// Events
canvas.addEventListener('mousedown', e => {
  drawing = true;
  draw(e);
});
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', () => {
  drawing = false;
  ctx.beginPath();
});
canvas.addEventListener('mouseout', () => {
  drawing = false;
  ctx.beginPath();
});

// Toolbar events
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
