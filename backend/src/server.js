require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { initSocket } = require('./lib/socket');

// Soporta múltiples orígenes separados por coma en FRONTEND_URL
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Permitir peticiones sin origen: ESP32, Postman, health checks
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true,
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
});

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

initSocket(io);
app.set('io', io);

app.use('/api/v1/auth',       require('./routes/auth'));
app.use('/api/v1/grades',     require('./routes/grades'));
app.use('/api/v1/students',   require('./routes/students'));
app.use('/api/v1/attendance', require('./routes/attendance'));
app.use('/api/v1/excuses',    require('./routes/excuses'));
app.use('/api/v1/readers',    require('./routes/readers'));
app.use('/api/v1/reports',    require('./routes/reports'));
app.use('/api/v1/settings',   require('./routes/settings'));

app.get('/api/v1/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Servidor Beehive RFID corriendo en puerto ${PORT}`));
