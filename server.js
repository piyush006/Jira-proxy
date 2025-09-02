// server.js
import express from "express";
import fetch from "node-fetch";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config(); // load .env locally, Render uses environment variables

const app = express();
app.use(express.json());

// Environment variables (from .env or Render)
const JIRA_BASE = process.env.JIRA_BASE_URL || "https://daato.atlassian.net";
const JIRA_EMAIL = process.env.JIRA_EMAIL || "piyush.soni@47billion.com";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "ATATT3xFfGF0yfNHhbTN4lkftc59nbMrIrMgQeUH3kDNjKu-ARucNtn5Sb0q7rlhk_FGbLrb1V9yOJQLJVGfIpL0gORu1x7NZjwuGONxj-NcfES9lvqGMKCB4hcf7A2sOMytFuEhaqeC-EIIftZEwvaU0_8PPEm9wE8nhMe47Lr6H_VYB1Dupgc=594BC611";

if (!JIRA_BASE || !JIRA_EMAIL || !JIRA_API_TOKEN) {
  console.error("❌ Missing Jira configuration. Please set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN.");
  process.exit(1); // stop app if env vars are missing
}

// Basic Auth header
const AUTH_HEADER = "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");

// Multer for file uploads
const upload = multer({ dest: "uploads/" });

// ✅ Create Jira Issue
app.post("/jira/create-issue", async (req, res) => {
  try {
    const response = await fetch(`${JIRA_BASE}/rest/api/3/issue`, {
      method: "POST",
      headers: {
        "Authorization": AUTH_HEADER,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Error creating issue:", error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Attach File to Jira Issue
app.post("/jira/attach/:issueKey", upload.array("files"), async (req, res) => {
  const issueKey = req.params.issueKey;

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }

  try {
    const formData = new FormData();
    for (const file of req.files) {
      formData.append("file", fs.createReadStream(file.path), file.originalname);
    }

    const response = await fetch(`${JIRA_BASE}/rest/api/3/issue/${issueKey}/attachments`, {
      method: "POST",
      headers: {
        "Authorization": AUTH_HEADER,
        "X-Atlassian-Token": "no-check",
        ...formData.getHeaders(),
      },
      body: formData,
    });

    const data = await response.json();

    // Cleanup temp files
    req.files.forEach(file => fs.unlinkSync(file.path));

    res.status(response.status).json(data);
  } catch (error) {
    console.error("Error attaching file:", error);
    res.status(500).json({ error: error.message });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Jira Proxy running on http://localhost:${PORT}`);
});
