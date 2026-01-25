/**
 * Cloudflare Worker for handling bug reports from consent.sw.foundation
 *
 * This worker receives bug reports and creates GitHub issues.
 *
 * Environment variables (set in Cloudflare dashboard):
 * - GITHUB_TOKEN: Personal access token with repo scope
 * - GITHUB_REPO: Repository in format "owner/repo" (e.g., "structured-world/consent")
 *
 * Deploy: wrangler deploy
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://consent.sw.foundation",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Only allow POST
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json();

      // Honeypot check - if filled, it's a bot
      if (body.honeypot) {
        // Silently accept to not alert bots
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // Validate required fields
      if (!body.description || body.description.trim().length < 10) {
        return new Response(
          JSON.stringify({ error: "Description must be at least 10 characters" }),
          {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );
      }

      // Rate limiting via CF (optional - can be configured in dashboard)
      const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";

      // Build GitHub issue body
      const issueBody = buildIssueBody(body, clientIP, request);

      // Create GitHub issue
      const issueUrl = await createGitHubIssue(env, body, issueBody);

      return new Response(JSON.stringify({ success: true, issue: issueUrl }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Bug report error:", error);
      return new Response(JSON.stringify({ error: "Failed to submit report" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  },
};

function buildIssueBody(body, clientIP, request) {
  const sections = [];

  sections.push("## Description");
  sections.push(body.description.trim());

  if (body.expected && body.expected.trim()) {
    sections.push("");
    sections.push("## Expected Behavior");
    sections.push(body.expected.trim());
  }

  sections.push("");
  sections.push("## Details");
  sections.push(`- **Page:** ${body.page || "unknown"}`);
  if (body.category) {
    sections.push(`- **Category:** ${body.category}`);
  }

  sections.push("");
  sections.push("## Reporter Info");
  sections.push(`- **IP:** \`${clientIP}\``);
  sections.push(`- **User-Agent:** ${request.headers.get("User-Agent") || "unknown"}`);
  sections.push(`- **Timestamp:** ${new Date().toISOString()}`);

  sections.push("");
  sections.push("---");
  sections.push("*This issue was automatically created from the documentation bug report widget.*");

  return sections.join("\n");
}

async function createGitHubIssue(env, body, issueBody) {
  const repo = env.GITHUB_REPO || "structured-world/consent";
  const token = env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("GITHUB_TOKEN not configured");
  }

  // Determine title from category or use default
  const categoryPrefix = body.category ? `[${body.category}]` : "[Bug Report]";
  const pageShort = body.page
    ? body.page.replace(/^\//, "").replace(/\//g, " > ") || "home"
    : "docs";
  const title = `${categoryPrefix} ${pageShort}: ${body.description.trim().slice(0, 50)}${body.description.length > 50 ? "..." : ""}`;

  const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "consent-bug-report-worker",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      title,
      body: issueBody,
      labels: ["bug", "documentation", "from-widget"],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("GitHub API error:", error);
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const issue = await response.json();
  return issue.html_url;
}
