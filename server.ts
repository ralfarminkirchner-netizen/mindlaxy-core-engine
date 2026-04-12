import app from './api/core.api';

const PORT = parseInt(process.env.CORE_PORT || '3001', 10);

app.listen(PORT, () => {
  console.log(`MiNDLAXY Knowledge Core — http://localhost:${PORT}`);
  console.log('Endpoints: POST /node  GET /node/:id  POST /search  GET /related/:id');
});
