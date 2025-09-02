// server.js (CommonJS)
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors()); // Allow all origins for dev; lock to origins in prod.
app.use(express.json({ limit: '10mb' }));

const upload = multer({ dest: path.join(__dirname, 'uploads/') });

// Env (set these in Render Environment or local .env — NO HARDCODED FALLBACKS)
const JIRA_BASE = process.env.JIRA_BASE_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

if (!JIRA_BASE || !JIRA_EMAIL || !JIRA_API_TOKEN) {
  console.error('❌ Missing JIRA_BASE_URL, JIRA_EMAIL or JIRA_API_TOKEN in env vars.');
  process.exit(1);
}

const AUTH = 'Basic ' + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');

// --------------- Create issue (handles parent issue for subtask when parentKey provided) ---------------
app.post('/jira/create-issue', async (req, res) => {
  try {
    const {
      projectKey,
      summary,
      description,
      issueType = 'Bug',
      priority = 'Medium',
      parentIssueKey,
      labels,
    } = req.body;

    const jiraBody = {
      fields: {
        project: { key: projectKey },
        summary,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: description ?? '' }],
            },
          ],
        },
        issuetype: { name: issueType },
        priority: { name: priority },
      },
    };

    if (labels && Array.isArray(labels) && labels.length) {
      jiraBody.fields.labels = labels;
    }
    if (parentIssueKey && parentIssueKey.toString().trim().length) {
      jiraBody.fields.parent = { key: parentIssueKey };
    }

    const jiraResp = await axios.post(`${JIRA_BASE}/rest/api/3/issue`, jiraBody, {
      headers: {
        Authorization: AUTH,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    return res.status(jiraResp.status).json(jiraResp.data);
  } catch (err) {
    console.error('Error creating Jira issue:', err.response?.data ?? err.message);
    const status = err.response?.status || 500;
    const data = err.response?.data || { error: err.message };
    return res.status(status).json(data);
  }
});

// --------------- Attach files to issue ---------------
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
    for (const file of req.files) {
      try { fs.unlinkSync(file.path); } catch (_) {}
    }

    return res.status(jiraResp.status).json(jiraResp.data);
  } catch (err) {
    for (const file of req.files || []) {
      try { fs.unlinkSync(file.path); } catch (_) {}
    }
    console.error('Error attaching files:', err.response?.data ?? err.message);
    const status = err.response?.status || 500;
    const data = err.response?.data || { error: err.message };
    return res.status(status).json(data);
  }
});

// health
app.get('/', (req, res) => res.send('Jira proxy OK'));

// start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Jira proxy running on port ${PORT}`));
