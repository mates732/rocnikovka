import fs from 'fs';

const form = new FormData();
const file = fs.readFileSync('test-image.jpg');
const blob = new Blob([file], { type: 'image/jpeg' });
form.append('file', blob, 'test.jpg');
form.append('plant_id', 'PLT-001');
form.append('timestamp', '2026-10-22T19:30:00');
form.append('experiment_day', '1');
form.append('image_quality_status', 'PASS');
form.append('calibration_status', 'pass');
form.append('camera_id', '');

const response = await fetch('http://127.0.0.1:8787/api/images/upload', {
  method: 'POST',
  headers: { 'Origin': 'https://rocnikovka-ashy.vercel.app' },
  body: form
});
console.log('Status:', response.status);
const json = await response.json();
console.log(json);