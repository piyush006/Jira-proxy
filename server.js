// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');

const app = express();
app.use(cors()); // dev: allow all origins; lock down in production
app.use(express.json({ limit: '10mb' }));

const JIRA_BASE = process.env.JIRA_BASE || 'https://daato.atlassian.net';
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_TOKEN;
const AUTH = 'Basic ' + Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64');

const upload = multer({ dest: 'uploads/' });

// create issue (expecting Jira ADF body or same fields)
app.post('/jira/create-issue', async (req, res) => {
  try {
    const jiraResp = await axios.post(
      `${JIRA_BASE}/rest/api/3/issue`,
      req.body,
      {
        headers: {
          Authorization: AUTH,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );
    res.status(jiraResp.status).json(jiraResp.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || { error: err.message };
    res.status(status).json(data);
  }
});

// attach files to a Jira issue
app.post('/jira/attach/:issueKey', upload.array('files'), async (req, res) => {
  const issueKey = req.params.issueKey;
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  try {
    const form = new FormData();
    for (const file of req.files) {
      form.append('file', fs.createReadStream(file.path), file.originalname);
    }
    const jiraResp = await axios.post(
      `${JIRA_BASE}/rest/api/3/issue/${issueKey}/attachments`,
      form,
      {
        headers: {
          Authorization: AUTH,
          'X-Atlassian-Token': 'no-check',
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    // cleanup temp files
    for (const file of req.files) fs.unlinkSync(file.path);
    res.status(jiraResp.status).json(jiraResp.data);
  } catch (err) {
    for (const file of req.files) if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    const status = err.response?.status || 500;
    const data = err.response?.data || { error: err.message };
    res.status(status).json(data);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Jira proxy running on http://localhost:${PORT}`));
