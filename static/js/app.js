(() => {
  "use strict";

  const STORAGE_KEY = "vachiralai_school_ai_history_v2";
  const MAX_HISTORY_ITEMS = 12;

  const chatMessages = document.getElementById("chatMessages");
  const chatForm = document.getElementById("chatForm");
  const questionInput = document.getElementById("questionInput");
  const sendButton = document.getElementById("sendButton");
  const clearChatButton = document.getElementById("clearChatButton");
  const quickQuestionButtons = document.querySelectorAll("[data-question]");
  const currentYear = document.getElementById("currentYear");
  const contactSection = document.getElementById("contact");
  const pageUpdatedAt = document.body.dataset.updatedAt || "";

  let history = loadHistory();
  let isSending = false;
  let typingElement = null;

  const welcomeMessage =
    "สวัสดีครับ 👋\n\n" +
    "ผมคือ **Vachiralai School AI** ผู้ช่วยข้อมูลโรงเรียนวชิราลัยยะมะกะตะ\n\n" +
    "ลองถามเรื่องเวลาเรียน การสมัครเรียน อาคารสถานที่ ชมรม " +
    "เครื่องแบบ หรือข้อมูลติดต่อได้เลยครับ";

  function loadHistory() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

      if (!Array.isArray(saved)) {
        return [];
      }

      return saved
        .filter(
          (item) =>
            item &&
            ["user", "assistant"].includes(item.role) &&
            typeof item.text === "string"
        )
        .map((item) => ({
          role: item.role,
          text: item.text,
          updatedAt:
            typeof item.updatedAt === "string" ? item.updatedAt : "",
        }))
        .slice(-MAX_HISTORY_ITEMS);
    } catch {
      return [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(history.slice(-MAX_HISTORY_ITEMS))
      );
    } catch {
      // Chat still works when localStorage is unavailable.
    }
  }

  function isSafeLink(url) {
    try {
      const parsed = new URL(url, window.location.origin);
      return ["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  function appendTextWithAutoLinks(parent, rawText) {
    const pattern =
      /(https?:\/\/[^\s<]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:0\d{1,2}[-\s]?\d{3}[-\s]?\d{3,4}))/g;

    let cursor = 0;
    let match;

    while ((match = pattern.exec(rawText)) !== null) {
      if (match.index > cursor) {
        parent.appendChild(
          document.createTextNode(rawText.slice(cursor, match.index))
        );
      }

      let value = match[0];
      let trailing = "";

      while (/[.,;:!?)]$/.test(value)) {
        trailing = value.slice(-1) + trailing;
        value = value.slice(0, -1);
      }

      const link = document.createElement("a");
      link.textContent = value;

      if (/^https?:\/\//i.test(value)) {
        link.href = value;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      } else if (value.includes("@")) {
        link.href = `mailto:${value}`;
      } else {
        link.href = `tel:${value.replace(/[^\d+]/g, "")}`;
      }

      parent.appendChild(link);

      if (trailing) {
        parent.appendChild(document.createTextNode(trailing));
      }

      cursor = match.index + match[0].length;
    }

    if (cursor < rawText.length) {
      parent.appendChild(document.createTextNode(rawText.slice(cursor)));
    }
  }

  function appendInlineMarkdown(parent, text) {
    const tokenPattern =
      /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\((?:https?:\/\/|mailto:|tel:)[^)]+\))/g;

    let cursor = 0;
    let match;

    while ((match = tokenPattern.exec(text)) !== null) {
      if (match.index > cursor) {
        appendTextWithAutoLinks(
          parent,
          text.slice(cursor, match.index)
        );
      }

      const token = match[0];

      if (token.startsWith("**") && token.endsWith("**")) {
        const strong = document.createElement("strong");
        appendTextWithAutoLinks(strong, token.slice(2, -2));
        parent.appendChild(strong);
      } else if (token.startsWith("`") && token.endsWith("`")) {
        const code = document.createElement("code");
        code.textContent = token.slice(1, -1);
        parent.appendChild(code);
      } else {
        const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);

        if (linkMatch && isSafeLink(linkMatch[2])) {
          const link = document.createElement("a");
          link.textContent = linkMatch[1];
          link.href = linkMatch[2];

          if (/^https?:\/\//i.test(linkMatch[2])) {
            link.target = "_blank";
            link.rel = "noopener noreferrer";
          }

          parent.appendChild(link);
        } else {
          appendTextWithAutoLinks(parent, token);
        }
      }

      cursor = match.index + token.length;
    }

    if (cursor < text.length) {
      appendTextWithAutoLinks(parent, text.slice(cursor));
    }
  }

  function appendParagraph(container, lines) {
    if (lines.length === 0) {
      return;
    }

    const paragraph = document.createElement("p");

    lines.forEach((line, index) => {
      appendInlineMarkdown(paragraph, line);

      if (index < lines.length - 1) {
        paragraph.appendChild(document.createElement("br"));
      }
    });

    container.appendChild(paragraph);
  }

  function renderMarkdown(container, rawText) {
    container.replaceChildren();

    const lines = rawText.replace(/\r\n?/g, "\n").split("\n");
    let paragraphLines = [];
    let activeList = null;
    let activeListType = "";

    function flushParagraph() {
      appendParagraph(container, paragraphLines);
      paragraphLines = [];
    }

    function flushList() {
      activeList = null;
      activeListType = "";
    }

    lines.forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        flushParagraph();
        flushList();
        return;
      }

      const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
      const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);
      const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
      const quoteMatch = trimmed.match(/^>\s+(.+)$/);

      if (headingMatch) {
        flushParagraph();
        flushList();

        const level = Math.min(headingMatch[1].length + 2, 5);
        const heading = document.createElement(`h${level}`);
        appendInlineMarkdown(heading, headingMatch[2]);
        container.appendChild(heading);
        return;
      }

      if (unorderedMatch || orderedMatch) {
        flushParagraph();

        const listType = unorderedMatch ? "ul" : "ol";
        const itemText = unorderedMatch
          ? unorderedMatch[1]
          : orderedMatch[1];

        if (!activeList || activeListType !== listType) {
          flushList();
          activeList = document.createElement(listType);
          activeListType = listType;
          container.appendChild(activeList);
        }

        const item = document.createElement("li");
        appendInlineMarkdown(item, itemText);
        activeList.appendChild(item);
        return;
      }

      if (quoteMatch) {
        flushParagraph();
        flushList();

        const quote = document.createElement("blockquote");
        appendInlineMarkdown(quote, quoteMatch[1]);
        container.appendChild(quote);
        return;
      }

      flushList();
      paragraphLines.push(trimmed);
    });

    flushParagraph();
  }

  function formatUpdatedDate(dateString) {
    if (!dateString) {
      return "";
    }

    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    try {
      return new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date);
    } catch {
      return dateString;
    }
  }

  function createActionButton(label, handler, extraClass = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `message-action ${extraClass}`.trim();
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
  }

  function createMessageElement(role, text, options = {}) {
    const wrapper = document.createElement("article");
    wrapper.className = `message ${role}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = role === "assistant" ? "AI" : "คุณ";

    const content = document.createElement("div");
    content.className = "message-content";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    if (role === "assistant") {
      renderMarkdown(bubble, text);
    } else {
      bubble.textContent = text;
    }

    content.appendChild(bubble);

    if (role === "assistant" && options.updatedAt) {
      const meta = document.createElement("div");
      meta.className = "message-meta";
      meta.textContent =
        `ข้อมูลอัปเดตล่าสุด: ${formatUpdatedDate(options.updatedAt)}`;
      content.appendChild(meta);
    }

    if (role === "assistant" && !options.hideActions) {
      const actions = document.createElement("div");
      actions.className = "message-actions";

      const copyButton = createActionButton("คัดลอก", async () => {
        try {
          await navigator.clipboard.writeText(text);
          copyButton.textContent = "คัดลอกแล้ว";

          window.setTimeout(() => {
            copyButton.textContent = "คัดลอก";
          }, 1300);
        } catch {
          copyButton.textContent = "คัดลอกไม่สำเร็จ";
        }
      });

      const followUpButton = createActionButton("ถามต่อ", () => {
        if (!questionInput.value.trim()) {
          questionInput.value =
            "ขอรายละเอียดเพิ่มเติมเกี่ยวกับคำตอบนี้ครับ";
        }

        autoResizeTextarea();
        questionInput.focus();
        questionInput.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });

      const contactButton = createActionButton(
        "ติดต่อโรงเรียน",
        () => {
          contactSection?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        },
        "message-action-primary"
      );

      actions.append(copyButton, followUpButton, contactButton);
      content.appendChild(actions);
    }

    wrapper.append(avatar, content);
    return wrapper;
  }

  function addMessage(role, text, persist = true, options = {}) {
    const element = createMessageElement(role, text, options);
    chatMessages.appendChild(element);

    if (persist) {
      history.push({
        role,
        text,
        updatedAt: options.updatedAt || "",
      });

      history = history.slice(-MAX_HISTORY_ITEMS);
      saveHistory();
    }

    scrollToLatest();
  }

  function renderConversation() {
    chatMessages.replaceChildren();

    if (history.length === 0) {
      chatMessages.appendChild(
        createMessageElement("assistant", welcomeMessage, {
          hideActions: false,
        })
      );
      return;
    }

    history.forEach((item) => {
      chatMessages.appendChild(
        createMessageElement(item.role, item.text, {
          updatedAt: item.updatedAt,
        })
      );
    });

    scrollToLatest();
  }

  function showTyping() {
    const wrapper = document.createElement("article");
    wrapper.className = "message assistant";
    wrapper.setAttribute("aria-label", "AI กำลังพิมพ์");

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "AI";

    const content = document.createElement("div");
    content.className = "message-content";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble typing";

    for (let index = 0; index < 3; index += 1) {
      bubble.appendChild(document.createElement("span"));
    }

    content.appendChild(bubble);
    wrapper.append(avatar, content);
    chatMessages.appendChild(wrapper);

    typingElement = wrapper;
    scrollToLatest();
  }

  function hideTyping() {
    typingElement?.remove();
    typingElement = null;
  }

  function scrollToLatest() {
    window.requestAnimationFrame(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  function setSendingState(active) {
    isSending = active;
    sendButton.disabled = active;
    questionInput.disabled = active;
    sendButton.setAttribute("aria-busy", String(active));
  }

  function autoResizeTextarea() {
    questionInput.style.height = "auto";
    questionInput.style.height =
      `${Math.min(questionInput.scrollHeight, 130)}px`;
  }

  async function sendQuestion(rawQuestion) {
    const question = rawQuestion.trim();

    if (!question || isSending) {
      return;
    }

    const previousHistory = history.slice(-8);

    addMessage("user", question);
    questionInput.value = "";
    autoResizeTextarea();
    setSendingState(true);
    showTyping();

    try {
      const response = await fetch("/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          question,
          history: previousHistory,
        }),
      });

      let data;

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      const answer =
        typeof data.answer === "string" && data.answer.trim()
          ? data.answer.trim()
          : "ขออภัย ระบบไม่ได้รับคำตอบ กรุณาลองใหม่อีกครั้งครับ";

      const updatedAt =
        typeof data.updated_at === "string" && data.updated_at
          ? data.updated_at
          : pageUpdatedAt;

      hideTyping();
      addMessage("assistant", answer, true, { updatedAt });
    } catch {
      hideTyping();
      addMessage(
        "assistant",
        "ไม่สามารถเชื่อมต่อระบบได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้งครับ"
      );
    } finally {
      setSendingState(false);
      questionInput.focus();
    }
  }

  chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    sendQuestion(questionInput.value);
  });

  questionInput.addEventListener("input", autoResizeTextarea);

  questionInput.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.isComposing
    ) {
      event.preventDefault();
      sendQuestion(questionInput.value);
    }
  });

  quickQuestionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      sendQuestion(button.dataset.question || "");
    });
  });

  clearChatButton.addEventListener("click", () => {
    history = [];
    saveHistory();
    renderConversation();
    questionInput.focus();
  });

  if (currentYear) {
    currentYear.textContent = String(new Date().getFullYear());
  }

  renderConversation();
  autoResizeTextarea();
})();
