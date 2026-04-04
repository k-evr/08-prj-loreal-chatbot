// =============================================
//  L'ORÉAL BEAUTY ASSISTANT — script.js
//  Features:
//   • System prompt scoped to L'Oréal topics
//   • Conversation history (multi-turn memory)
//   • Chat bubble UI (user + assistant)
//   • Typing indicator
//   • Sends via Cloudflare Worker endpoint
// =============================================

// ── CONFIG ────────────────────────────────────
// Replace with your deployed Cloudflare Worker URL
const WORKER_URL = "https://your-worker.your-subdomain.workers.dev";

// ── SYSTEM PROMPT ─────────────────────────────
const SYSTEM_PROMPT = `You are an expert L'Oréal beauty consultant named "Lumière." You work exclusively for L'Oréal Paris and have deep knowledge of all L'Oréal product lines, including skincare (Revitalift, Hydra Genius, Age Perfect), makeup (Infallible, True Match, Voluminous), hair care and color (Excellence, EverPure, Elvive/Total Repair), and men's grooming (Men Expert).

Your role:
- Recommend L'Oréal products tailored to the user's skin type, concerns, hair type, or beauty goals.
- Explain how to use products and build effective routines.
- Share tips on application techniques, ingredient benefits, and complementary products.
- Personalize recommendations when users share details about themselves (name, skin type, concerns, etc.).
- Remember context from earlier in the conversation — if a user has shared their name or skin type, use that information naturally.

Rules:
- ONLY answer questions about L'Oréal products, beauty routines, skincare, haircare, makeup, and closely related beauty topics.
- If asked about competitor brands, politely redirect to the equivalent L'Oréal offering.
- If asked anything unrelated to beauty or L'Oréal (e.g., politics, coding, geography, etc.), respond warmly: "I'm your dedicated L'Oréal beauty expert, so I can only help with beauty, skincare, haircare, and L'Oréal product questions. Is there something beauty-related I can assist you with?"
- Keep responses warm, elegant, and on-brand with L'Oréal's "Because You're Worth It" philosophy.
- Do NOT use markdown headings like #, ##, or ### in your responses. Use plain text with short paragraphs or bullet points only.
- Format answers clearly — use short paragraphs or bullet points when listing products or steps.`;

// ── STATE ─────────────────────────────────────
// Full conversation history for multi-turn context
const conversationHistory = [];

// ── DOM REFS ──────────────────────────────────
const chatArea  = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendBtn   = document.getElementById("sendBtn");

// ── AUTO-RESIZE TEXTAREA ───────────────────────
userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
});

// ── KEYBOARD SHORTCUT ─────────────────────────
function handleKeydown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

// ── INJECT SUGGESTED QUESTION ─────────────────
function injectQuestion(text) {
  userInput.value = text;
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
  userInput.focus();
}

// ── RENDER A MESSAGE BUBBLE ───────────────────
function appendMessage(role, text) {
  const row = document.createElement("div");
  row.className = `msg-row msg-row--${role}`;

  const avatar = document.createElement("div");
  avatar.className = `avatar avatar--${role}`;
  avatar.textContent = role === "assistant" ? "L" : "You";

  const bubble = document.createElement("div");
  bubble.className = `bubble bubble--${role}`;

  // Convert plain newlines / markdown-lite to HTML
  bubble.innerHTML = formatText(text);

  row.appendChild(avatar);
  row.appendChild(bubble);
  chatArea.appendChild(row);
  scrollToBottom();
  return bubble;
}

// ── TEXT FORMATTER ────────────────────────────
function formatText(text) {
  // Remove markdown headings (###, ##, #)
  text = text.replace(/^#{1,6}\s+/gm, "");

  // Bold **text**
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Split into lines and build HTML
  const lines = text.split("\n");
  let inList = false;
  let html = "";

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (/^[-•*]\s/.test(line)) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${line.replace(/^[-•*]\s/, "")}</li>`;
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p>${line}</p>`;
    }
  }

  if (inList) html += "</ul>";
  return html || `<p>${text}</p>`;
}

// ── TYPING INDICATOR ──────────────────────────
function showTyping() {
  const row = document.createElement("div");
  row.className = "msg-row msg-row--assistant";
  row.id = "typingRow";

  const avatar = document.createElement("div");
  avatar.className = "avatar avatar--assistant";
  avatar.textContent = "L";

  const indicator = document.createElement("div");
  indicator.className = "typing-indicator";
  indicator.innerHTML = "<span></span><span></span><span></span>";

  row.appendChild(avatar);
  row.appendChild(indicator);
  chatArea.appendChild(row);
  scrollToBottom();
}

function hideTyping() {
  const row = document.getElementById("typingRow");
  if (row) row.remove();
}

// ── SCROLL TO BOTTOM ──────────────────────────
function scrollToBottom() {
  chatArea.scrollTop = chatArea.scrollHeight;
}

// ── MAIN SEND FUNCTION ────────────────────────
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  // Clear input
  userInput.value = "";
  userInput.style.height = "auto";
  sendBtn.disabled = true;

  // Display user bubble
  appendMessage("user", text);

  // Add to history
  conversationHistory.push({ role: "user", content: text });

  // Show typing
  showTyping();

  try {
    const reply = await fetchAIResponse(conversationHistory);
    hideTyping();

    // Display assistant bubble
    appendMessage("assistant", reply);

    // Save to history
    conversationHistory.push({ role: "assistant", content: reply });

  } catch (err) {
    hideTyping();
    appendMessage("assistant", "I'm sorry, something went wrong. Please try again in a moment. 💛");
    console.error("API error:", err);
  } finally {
    sendBtn.disabled = false;
    userInput.focus();
  }
}

// ── API CALL VIA CLOUDFLARE WORKER ────────────
async function fetchAIResponse(messages) {
  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages
      ],
      max_tokens: 600,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`Worker responded with ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}