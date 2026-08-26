const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_TYPE = (process.env.DB_TYPE || 'postgres').toLowerCase();
const uploadDir = path.join(__dirname, 'uploads'); // solo compatibilidad con audios antiguos
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

let db;
if (DB_TYPE === 'mysql') {
  db = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost', port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root', password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'emoti', waitForConnections: true, connectionLimit: 10
  });
} else {
  db = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/emoti' });
}

async function query(sql, params=[]) {
  if (DB_TYPE === 'mysql') {
    const [rows] = await db.execute(sql.replace(/\$(\d+)/g, '?'), params);
    return rows;
  }
  const r = await db.query(sql, params); return r.rows;
}
async function initDb() {
  const file = path.join(__dirname, DB_TYPE === 'mysql' ? 'schema-mysql.sql' : 'schema-postgres.sql');
  const sql = fs.readFileSync(file, 'utf8');
  // Demo setup: schemas can also be executed manually. For PostgreSQL, multi-statement is supported.
  if (DB_TYPE === 'postgres') await db.query(sql);
  else {
    for (const statement of sql.split(';').map(s=>s.trim()).filter(Boolean)) await db.query(statement);
  }
}

app.use(express.json({limit:'1mb'}));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

app.get('/api/health', async (req,res)=>{
  try { await query('SELECT 1'); res.json({ok:true,db:DB_TYPE}); }
  catch(e){ res.status(500).json({ok:false,error:e.message}); }
});

app.get('/api/families', async (req,res)=>{
  try { res.json(await query('SELECT id,name,parent_name,parent_email,created_at FROM families ORDER BY id DESC')); }
  catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/families', async (req,res)=>{
  const {name,parentName,parentEmail,pin='1234'}=req.body;
  if(!name||!parentName) return res.status(400).json({error:'name y parentName son obligatorios'});
  try {
    const rows = await query(DB_TYPE==='mysql'
      ? 'INSERT INTO families(name,parent_name,parent_email,pin) VALUES(?,?,?,?)'
      : 'INSERT INTO families(name,parent_name,parent_email,pin) VALUES($1,$2,$3,$4) RETURNING id,name,parent_name,parent_email,created_at',
      [name,parentName,parentEmail||null,pin]);
    if(DB_TYPE==='mysql') return res.json({id:rows.insertId,name,parent_name:parentName,parent_email:parentEmail||null});
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

app.get('/api/families/:familyId/children', async (req,res)=>{
  try { res.json(await query('SELECT id,family_id,name,birth_year,avatar,created_at FROM children WHERE family_id=$1 ORDER BY id DESC',[req.params.familyId])); }
  catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/children', async (req,res)=>{
  const {familyId,name,birthYear,avatar='🧒'}=req.body;
  if(!familyId||!name) return res.status(400).json({error:'familyId y name son obligatorios'});
  try {
    const safeRegisteredBy = registeredBy === 'adult' ? 'adult' : 'child';
    const safeRegisteredByName = safeRegisteredBy === 'adult'
      ? (registeredByName || 'Adulto responsable')
      : null;

    const rows=await query(DB_TYPE==='mysql'
      ? 'INSERT INTO emotion_records(child_id,emotion,intensity,story,audio_path,registered_by,registered_by_name) VALUES(?,?,?,?,?,?,?)'
      : 'INSERT INTO emotion_records(child_id,emotion,intensity,story,audio_path,audio_data,audio_mime,registered_by,registered_by_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,child_id,emotion,intensity,story,audio_path,audio_mime,registered_by,registered_by_name,created_at',
      DB_TYPE==='mysql'
        ? [childId,emotion,Number(intensity),story,audioPath,safeRegisteredBy,safeRegisteredByName]
        : [childId,emotion,Number(intensity),story,audioPath,audioData,audioMime,safeRegisteredBy,safeRegisteredByName]);

    if(DB_TYPE==='mysql') return res.json({
      id:rows.insertId,
      child_id:childId,
      emotion,
      intensity:Number(intensity),
      story,
      audio_path:audioPath,
      registered_by:safeRegisteredBy,
      registered_by_name:safeRegisteredByName
    });

    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/emotions', upload.single('audio'), async (req,res)=>{
  const {childId,emotion,intensity,story='',registeredBy='child',registeredByName=''}=req.body;
  if(!childId||!emotion||!intensity) return res.status(400).json({error:'childId, emotion e intensity son obligatorios'});
  const audioPath=null; // los audios nuevos se guardan en PostgreSQL
  const audioData=req.file ? req.file.buffer : null;
  const audioMime=req.file ? (req.file.mimetype || 'application/octet-stream') : null;
  try {
    const rows=await query(DB_TYPE==='mysql'
      ? 'INSERT INTO emotion_records(child_id,emotion,intensity,story,audio_path) VALUES(?,?,?,?,?)'
      : 'INSERT INTO emotion_records(child_id,emotion,intensity,story,audio_path,audio_data,audio_mime) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,child_id,emotion,intensity,story,audio_path,audio_mime,created_at',
      DB_TYPE==='mysql'
        ? [childId,emotion,Number(intensity),story,audioPath]
        : [childId,emotion,Number(intensity),story,audioPath,audioData,audioMime]);
    if(DB_TYPE==='mysql') return res.json({id:rows.insertId,child_id:childId,emotion,intensity:Number(intensity),story,audio_path:audioPath});
    res.json(rows[0]);
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.get('/api/children/:childId/emotions', async (req,res)=>{
  try { res.json(await query('SELECT r.id,r.child_id,r.emotion,r.intensity,r.story,r.audio_path,r.registered_by,r.registered_by_name,r.created_at,c.name AS child_name, CASE WHEN r.audio_data IS NOT NULL THEN TRUE ELSE FALSE END AS has_audio FROM emotion_records r JOIN children c ON c.id=r.child_id WHERE r.child_id=$1 ORDER BY r.created_at DESC',[req.params.childId])); }
  catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/families/:familyId/emotions', async (req,res)=>{
  try { res.json(await query('SELECT r.id,r.child_id,r.emotion,r.intensity,r.story,r.audio_path,r.registered_by,r.registered_by_name,r.created_at,c.name AS child_name, CASE WHEN r.audio_data IS NOT NULL THEN TRUE ELSE FALSE END AS has_audio FROM emotion_records r JOIN children c ON c.id=r.child_id WHERE c.family_id=$1 ORDER BY r.created_at DESC',[req.params.familyId])); }
  catch(e){res.status(500).json({error:e.message});}
});

app.get('/api/emotions/:id/audio', async (req, res) => {
  if (DB_TYPE !== 'postgres') {
    return res.status(404).send('Audio no disponible');
  }

  try {
    const rows = await query(
      'SELECT audio_data, audio_mime FROM emotion_records WHERE id=$1',
      [req.params.id]
    );

    if (!rows.length || !rows[0].audio_data) {
      return res.status(404).send('Audio no encontrado');
    }

    const audioBuffer = rows[0].audio_data;
    const mimeType = rows[0].audio_mime || 'audio/mp4';
    const fileSize = audioBuffer.length;
    const range = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const requestedEnd = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const end = Math.min(requestedEnd, fileSize - 1);

      if (
        Number.isNaN(start) ||
        Number.isNaN(end) ||
        start >= fileSize ||
        start > end
      ) {
        res.status(416);
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.end();
      }

      const chunkSize = end - start + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunkSize);

      return res.end(audioBuffer.subarray(start, end + 1));
    }

    res.status(200);
    res.setHeader('Content-Length', fileSize);
    return res.end(audioBuffer);

  } catch (error) {
    console.error('Error reproduciendo audio:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/demo/status', async (req,res)=>{
  try {
    const families=await query('SELECT COUNT(*) AS n FROM families');
    const children=await query('SELECT COUNT(*) AS n FROM children');
    const records=await query('SELECT COUNT(*) AS n FROM emotion_records');
    res.json({db:DB_TYPE,families:families[0].n,children:children[0].n,records:records[0].n});
  } catch(e){res.status(500).json({error:e.message});}
});
app.use((req,res)=>res.sendFile(path.join(__dirname, 'public','index.html')));

initDb().then(()=>app.listen(PORT,'0.0.0.0',()=>console.log(`EMOTI en http://localhost:${PORT} usando ${DB_TYPE}`)))
.catch(err=>{console.error('No se pudo iniciar la base de datos:',err.message);process.exit(1)});
