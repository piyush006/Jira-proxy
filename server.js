import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import multer from "multer";

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer(); // for file uploads

// 🔑 Environment variables (set these in Render Dashboard)
const JIRA_BASE_URL = process.env.JIRA_BASE_URL; // e.g. https://your-domain.atlassian.net
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

// Create Jira Issue
app.post("/create-issue", async (req, res) => {
  try {
    const { projectKey, summary, description, issueType, parentKey } = req.body;

    const bodyData = {
      fields: {
        project: { key: projectKey },
        summary,
        description,
        issuetype: { name: issueType || "Bug" },
      },
    };

    if (parentKey) {
      bodyData.fields.parent = { key: parentKey };
    }

    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue`, {
      method: "POST",
      headers: {
        "Authorization":
          "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64"),
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyData),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Jira error:", data);
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Health check
app.get("/", (req, res) => {
  res.send("Jira Proxy is running ✅");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Jira proxy running on port ${PORT}`));
