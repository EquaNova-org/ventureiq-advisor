import { useState, useRef, useEffect, useCallback } from "react";

const pdfjsLib = window['pdfjs-dist/build/pdf'];
if (pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const SECTIONS = [
  { id: "implementation", label: "Implementation Plan", icon: "🗺️" },
  { id: "legal", label: "Legal & Compliance", icon: "⚖️" },
  { id: "market", label: "Market Viability", icon: "📊" },
  { id: "funding", label: "Funding & Financials", icon: "💰" },
  { id: "risk", label: "Risk Assessment", icon: "🛡️" },
];

const SYSTEM_PROMPT = `You are an elite startup advisor — part venture capitalist, part corporate lawyer, part business strategist. A founder has uploaded documents about their startup idea. Your role is to conduct a rigorous, thorough analysis across five dimensions.

When analyzing, you must:
1. **Implementation Plan & Timeline**: Break down the MVP build phases, key milestones, realistic 6/12/18-month roadmap, team requirements, and technology stack recommendations.
2. **Legal & Compliance**: Evaluate legality under US federal & state law, EU regulations (GDPR, DSA, etc.), and general international business law. Flag any regulatory hurdles, licensing needs, data protection requirements, IP considerations, and give a clear LEGAL / REQUIRES ATTENTION / ILLEGAL verdict with reasoning.
3. **Market Viability & Competition**: Assess market size (TAM/SAM/SOM), identify key competitors, evaluate differentiation, and give a market opportunity score.
4. **Funding & Financial Outlook**: Recommend funding strategy (bootstrapping, angel, VC, grants), estimate burn rate, revenue model viability, and 3-year financial trajectory.
5. **Risk Assessment**: Identify top 5 business, technical, regulatory, and market risks. Rate each by probability and impact. Suggest mitigation strategies.

Structure your response with clear section headers using ### for each section. Be direct, specific, and data-driven. Do not hedge excessively — founders need actionable clarity. Always end with an OVERALL VERDICT summary.

You have access to the document content the user has uploaded. Base your analysis on the actual content of their documents.`;

function parseMarkdown(text) {
  return text
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="md-code">$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul class="md-ul">${match}</ul>`)
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p class="md-p">')
    .replace(/^(?!<[hul]|<\/[hul])(.+)$/gm, (m) =>
      m.startsWith("<") ? m : `<span>${m}</span>`
    );
}

async function readFileAsText(file) {
  if (file.type === "application/pdf") {
    try {
      const lib = window['pdfjs-dist/build/pdf'];
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item) => item.str).join(" ");
        fullText += `\n[Page ${i}]\n${pageText}`;
      }
      return `[PDF: ${file.name}]\n${fullText}`;
    } catch (err) {
      return `[PDF: ${file.name} — could not extract text: ${err.message}]`;
    }
  } else {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
}

export default function StartupAdvisor() {
  const [files, setFiles] = useState([]);
  const [fileContents, setFileContents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleFiles = useCallback(async (newFiles) => {
    const fileArray = Array.from(newFiles);
    setFiles((prev) => [...prev, ...fileArray]);
    const contents = await Promise.all(fileArray.map(readFileAsText));
    setFileContents((prev) => [
      ...prev,
      ...fileArray.map((f, i) => ({ name: f.name, content: contents[i] })),
    ]);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (index) => {
    setFiles((f) => f.filter((_, i) => i !== index));
    setFileContents((f) => f.filter((_, i) => i !== index));
  };

  const buildDocumentContext = () => {
    if (fileContents.length === 0) return "";
    return fileContents
      .map((f) => `=== DOCUMENT: ${f.name} ===\n${f.content}\n=== END: ${f.name} ===`)
      .join("\n\n");
  };

  const runAnalysis = async (sectionId = null) => {
    if (fileContents.length === 0) return;
    setLoading(true);
    setAnalysisStarted(true);
    setActiveSection(sectionId);

    const docContext = buildDocumentContext();
    const sectionPrompt = sectionId
      ? `Focus ONLY on the "${SECTIONS.find((s) => s.id === sectionId)?.label}" section. Be extremely detailed.`
      : "Provide a complete analysis across ALL five sections.";

    const userMessage = {
      role: "user",
      content: `Here are my startup documents:\n\n${docContext}\n\n${sectionPrompt}`,
    };

    const displayMessage = {
      role: "user",
      content: sectionId
        ? `🔍 Deep dive: **${SECTIONS.find((s) => s.id === sectionId)?.label}**`
        : "📋 Run full startup analysis on uploaded documents",
      display: true,
    };

    const newMessages = [...messages, displayMessage];
    setMessages(newMessages);
    setStreamingText("");

    try {
      const apiMessages = [...messages
        .filter((m) => m.role && m.content)
        .map((m) => ({ role: m.role, content: m.content })),
        userMessage,
      ];

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: apiMessages,
        }),
      });

      const data = await response.json();
      const text = data.content?.map((b) => b.text || "").join("") || "No response received.";

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: text, display: true },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}`, display: true },
      ]);
    } finally {
      setLoading(false);
      setStreamingText("");
    }
  };

  const sendChat = async () => {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput("");
    setLoading(true);

    const docContext = buildDocumentContext();
    const contextPrefix = docContext
      ? `Context from uploaded documents:\n${docContext}\n\nUser question: `
      : "";

    const apiUserMsg = {
      role: "user",
      content: `${contextPrefix}${userText}`,
    };

    const displayMsg = { role: "user", content: userText, display: true };
    const newMessages = [...messages, displayMsg];
    setMessages(newMessages);

    try {
      const apiMessages = [
        ...messages
          .filter((m) => m.role && m.content)
          .map((m) => ({ role: m.role, content: m.content })),
        apiUserMsg,
      ];

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: apiMessages,
        }),
      });

      const data = await response.json();
      const text = data.content?.map((b) => b.text || "").join("") || "No response.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: text, display: true },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}`, display: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const displayMessages = messages.filter((m) => m.display);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Cormorant+Garamond:wght@400;600;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --navy-950: #05080f;
          --navy-900: #0a0f1e;
          --navy-800: #0d1530;
          --navy-700: #132045;
          --navy-600: #1a2a5a;
          --navy-500: #1e3370;
          --gold: #c9a84c;
          --gold-light: #e2c97e;
          --gold-dim: rgba(201,168,76,0.15);
          --slate: #8a9bbf;
          --slate-light: #b0bfd8;
          --white: #f0f4ff;
          --red: #c0392b;
          --green: #1a8a4a;
          --amber: #c07820;
        }

        .app {
          min-height: 100vh;
          background: var(--navy-950);
          background-image:
            radial-gradient(ellipse at 20% 10%, rgba(26,50,112,0.4) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 90%, rgba(201,168,76,0.08) 0%, transparent 50%);
          display: flex;
          flex-direction: column;
          color: var(--white);
        }

        .header {
          border-bottom: 1px solid rgba(201,168,76,0.2);
          padding: 18px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(10,15,30,0.8);
          backdrop-filter: blur(12px);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo-mark {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 100%);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          box-shadow: 0 0 20px rgba(201,168,76,0.3);
        }

        .logo-text {
          font-family: 'Cormorant Garamond', serif;
          font-size: 22px;
          font-weight: 600;
          color: var(--white);
          letter-spacing: 0.02em;
        }

        .logo-sub {
          font-size: 10px;
          color: var(--gold);
          letter-spacing: 0.15em;
          text-transform: uppercase;
          font-weight: 500;
        }

        .header-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--slate);
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #2ecc71;
          box-shadow: 0 0 6px #2ecc71;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .main {
          display: flex;
          flex: 1;
          height: calc(100vh - 65px);
        }

        .sidebar {
          width: 280px;
          min-width: 280px;
          border-right: 1px solid rgba(201,168,76,0.12);
          background: rgba(10,15,30,0.6);
          display: flex;
          flex-direction: column;
          padding: 24px 16px;
          gap: 24px;
          overflow-y: auto;
        }

        .sidebar-section-title {
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--gold);
          font-weight: 600;
          padding: 0 8px;
          margin-bottom: 8px;
        }

        .drop-zone {
          border: 1.5px dashed rgba(201,168,76,0.35);
          border-radius: 12px;
          padding: 24px 16px;
          text-align: center;
          cursor: pointer;
          transition: all 0.25s;
          background: rgba(201,168,76,0.03);
        }

        .drop-zone:hover, .drop-zone.drag-over {
          border-color: var(--gold);
          background: var(--gold-dim);
        }

        .drop-zone-icon { font-size: 28px; margin-bottom: 8px; }

        .drop-zone-text {
          font-size: 12px;
          color: var(--slate-light);
          line-height: 1.6;
        }

        .drop-zone-hint {
          font-size: 10px;
          color: var(--slate);
          margin-top: 6px;
        }

        .file-list { display: flex; flex-direction: column; gap: 6px; }

        .file-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          background: rgba(201,168,76,0.06);
          border: 1px solid rgba(201,168,76,0.15);
          border-radius: 8px;
          font-size: 11px;
          color: var(--slate-light);
        }

        .file-icon { font-size: 14px; }

        .file-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-remove {
          background: none;
          border: none;
          color: var(--slate);
          cursor: pointer;
          font-size: 14px;
          line-height: 1;
          padding: 2px;
          transition: color 0.2s;
        }
        .file-remove:hover { color: #e74c3c; }

        .section-btns { display: flex; flex-direction: column; gap: 6px; }

        .section-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--slate-light);
          cursor: pointer;
          font-size: 12px;
          font-family: 'DM Sans', sans-serif;
          text-align: left;
          transition: all 0.2s;
          font-weight: 500;
        }

        .section-btn:hover:not(:disabled) {
          background: rgba(201,168,76,0.08);
          border-color: rgba(201,168,76,0.2);
          color: var(--white);
        }

        .section-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .section-btn.active {
          background: var(--gold-dim);
          border-color: rgba(201,168,76,0.4);
          color: var(--gold-light);
        }

        .analyze-all-btn {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, var(--gold) 0%, #a0783a 100%);
          border: none;
          border-radius: 10px;
          color: var(--navy-900);
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: 0.05em;
          transition: all 0.25s;
          box-shadow: 0 4px 20px rgba(201,168,76,0.25);
        }

        .analyze-all-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 28px rgba(201,168,76,0.4);
        }

        .analyze-all-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .chat-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          scrollbar-width: thin;
          scrollbar-color: rgba(201,168,76,0.2) transparent;
        }

        .chat-messages::-webkit-scrollbar { width: 4px; }
        .chat-messages::-webkit-scrollbar-track { background: transparent; }
        .chat-messages::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.2); border-radius: 4px; }

        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 40px;
          gap: 16px;
          color: var(--slate);
        }

        .empty-icon { font-size: 56px; opacity: 0.6; margin-bottom: 8px; }

        .empty-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 28px;
          color: var(--slate-light);
          font-weight: 600;
        }

        .empty-desc {
          font-size: 13px;
          max-width: 400px;
          line-height: 1.7;
          color: var(--slate);
        }

        .steps {
          display: flex;
          gap: 20px;
          margin-top: 16px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--slate);
          max-width: 100px;
          text-align: center;
        }

        .step-num {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 1px solid rgba(201,168,76,0.3);
          color: var(--gold);
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .message {
          display: flex;
          flex-direction: column;
          gap: 8px;
          animation: fadeUp 0.3s ease;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .message.user { align-items: flex-end; }
        .message.assistant { align-items: flex-start; }

        .message-bubble {
          max-width: 85%;
          padding: 14px 18px;
          border-radius: 14px;
          font-size: 13.5px;
          line-height: 1.7;
        }

        .message.user .message-bubble {
          background: linear-gradient(135deg, var(--navy-600) 0%, var(--navy-700) 100%);
          border: 1px solid rgba(201,168,76,0.2);
          border-radius: 14px 14px 4px 14px;
          color: var(--white);
        }

        .message.assistant .message-bubble {
          background: rgba(13,21,48,0.8);
          border: 1px solid rgba(201,168,76,0.12);
          border-radius: 14px 14px 14px 4px;
          color: var(--slate-light);
          width: 100%;
          max-width: 100%;
        }

        .message-label {
          font-size: 10px;
          color: var(--slate);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 0 4px;
        }

        .md-h1 { font-family: 'Cormorant Garamond', serif; font-size: 24px; color: var(--white); margin: 16px 0 8px; }
        .md-h2 { font-family: 'Cormorant Garamond', serif; font-size: 20px; color: var(--gold-light); margin: 14px 0 6px; border-bottom: 1px solid rgba(201,168,76,0.15); padding-bottom: 6px; }
        .md-h3 { font-size: 14px; font-weight: 600; color: var(--white); margin: 12px 0 4px; letter-spacing: 0.02em; }
        .md-p { margin: 8px 0; }
        .md-ul { padding-left: 20px; margin: 6px 0; }
        .md-ul li { margin: 4px 0; color: var(--slate-light); }
        .md-code { background: rgba(201,168,76,0.1); border: 1px solid rgba(201,168,76,0.2); border-radius: 4px; padding: 1px 5px; font-family: monospace; font-size: 12px; color: var(--gold-light); }
        strong { color: var(--white); font-weight: 600; }

        .loading-bubble {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 18px;
          background: rgba(13,21,48,0.8);
          border: 1px solid rgba(201,168,76,0.12);
          border-radius: 14px 14px 14px 4px;
          width: fit-content;
        }

        .loading-text { font-size: 12px; color: var(--slate); font-style: italic; }

        .dots span {
          display: inline-block;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--gold);
          margin: 0 2px;
          animation: dot-bounce 1.2s infinite;
        }
        .dots span:nth-child(2) { animation-delay: 0.2s; }
        .dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }

        .chat-input-area {
          padding: 20px 32px 24px;
          border-top: 1px solid rgba(201,168,76,0.1);
          background: rgba(10,15,30,0.6);
          backdrop-filter: blur(12px);
        }

        .input-row { display: flex; gap: 10px; align-items: flex-end; }

        .chat-input {
          flex: 1;
          background: rgba(13,21,48,0.8);
          border: 1px solid rgba(201,168,76,0.2);
          border-radius: 12px;
          padding: 12px 16px;
          color: var(--white);
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          resize: none;
          outline: none;
          transition: border-color 0.2s;
          line-height: 1.5;
          min-height: 46px;
          max-height: 120px;
        }

        .chat-input::placeholder { color: var(--slate); }
        .chat-input:focus { border-color: rgba(201,168,76,0.45); }

        .send-btn {
          width: 46px;
          height: 46px;
          border-radius: 10px;
          background: linear-gradient(135deg, var(--gold) 0%, #a0783a 100%);
          border: none;
          cursor: pointer;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          box-shadow: 0 2px 12px rgba(201,168,76,0.2);
          flex-shrink: 0;
        }

        .send-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(201,168,76,0.35);
        }

        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

        .input-hint {
          font-size: 10px;
          color: var(--slate);
          margin-top: 8px;
          text-align: center;
        }
      `}</style>

      <div className="app">
        <header className="header">
          <div className="logo">
            <div className="logo-mark">⚡</div>
            <div>
              <div className="logo-text">VentureIQ</div>
              <div className="logo-sub">AI Startup Advisor</div>
            </div>
          </div>
          <div className="header-status">
            <div className="status-dot" />
            AI Advisor Online · Global Legal Coverage
          </div>
        </header>

        <div className="main">
          <aside className="sidebar">
            <div>
              <div className="sidebar-section-title">Documents</div>
              <div
                className={`drop-zone ${dragOver ? "drag-over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="drop-zone-icon">📎</div>
                <div className="drop-zone-text">Drop files here<br />or click to upload</div>
                <div className="drop-zone-hint">PDF, TXT, MD, DOCX supported</div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.doc,.docx,.csv"
                multiple
                style={{ display: "none" }}
                onChange={(e) => handleFiles(e.target.files)}
              />
              {files.length > 0 && (
                <div className="file-list" style={{ marginTop: 12 }}>
                  {files.map((f, i) => (
                    <div className="file-item" key={i}>
                      <span className="file-icon">
                        {f.name.endsWith(".pdf") ? "📄" : "📝"}
                      </span>
                      <span className="file-name">{f.name}</span>
                      <button className="file-remove" onClick={() => removeFile(i)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="sidebar-section-title">Full Analysis</div>
              <button
                className="analyze-all-btn"
                disabled={files.length === 0 || loading}
                onClick={() => runAnalysis(null)}
              >
                {loading && activeSection === null ? "Analyzing…" : "⚡ Analyze My Startup"}
              </button>
            </div>

            <div>
              <div className="sidebar-section-title">Deep Dive</div>
              <div className="section-btns">
                {SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    className={`section-btn ${activeSection === s.id && loading ? "active" : ""}`}
                    disabled={files.length === 0 || loading}
                    onClick={() => runAnalysis(s.id)}
                  >
                    <span>{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="chat-area">
            <div className="chat-messages">
              {displayMessages.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🚀</div>
                  <div className="empty-title">Your Startup Advisor</div>
                  <div className="empty-desc">
                    Upload your pitch deck, business plan, or any documents about your startup idea. VentureIQ will analyze it across legal, market, financial, and execution dimensions.
                  </div>
                  <div className="steps">
                    {["Upload docs", "Run analysis", "Ask questions"].map((s, i) => (
                      <div className="step" key={i}>
                        <div className="step-num">{i + 1}</div>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {displayMessages.map((m, i) => (
                    <div key={i} className={`message ${m.role}`}>
                      <div className="message-label">
                        {m.role === "user" ? "You" : "VentureIQ Advisor"}
                      </div>
                      <div className="message-bubble">
                        {m.role === "assistant" ? (
                          <div dangerouslySetInnerHTML={{ __html: parseMarkdown(m.content) }} />
                        ) : (
                          <span dangerouslySetInnerHTML={{ __html: parseMarkdown(m.content) }} />
                        )}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="message assistant">
                      <div className="message-label">VentureIQ Advisor</div>
                      <div className="loading-bubble">
                        <div className="dots">
                          <span /><span /><span />
                        </div>
                        <span className="loading-text">Analyzing your startup…</span>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="chat-input-area">
              <div className="input-row">
                <textarea
                  ref={textareaRef}
                  className="chat-input"
                  placeholder={
                    files.length === 0
                      ? "Upload documents first, then ask anything…"
                      : "Ask a follow-up question about your startup…"
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendChat();
                    }
                  }}
                  rows={1}
                />
                <button
                  className="send-btn"
                  disabled={!input.trim() || loading}
                  onClick={sendChat}
                >
                  ↑
                </button>
              </div>
              <div className="input-hint">
                Press Enter to send · Shift+Enter for new line
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
