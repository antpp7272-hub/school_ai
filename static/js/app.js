(() => {
  "use strict";

  const STORAGE_KEY = "vachiralai_school_ai_history_v1";
  const MAX_HISTORY_ITEMS = 12;

  const chatMessages = document.getElementById("chatMessages");
  const chatForm = document.getElementById("chatForm");
  const questionInput = document.getElementById("questionInput");
  const sendButton = document.getElementById("sendButton");
  const clearChatButton = document.getElementById("clearChatButton");
  const quickQuestionButtons = document.querySelectorAll("[data-question]");
  const currentYear = document.getElementById("currentYear");

  let history = loadHistory();
  let isSending = false;
  let typingElement = null;

  const welcomeMessage =
    "สวัสดีครับ 👋\n\n" +
    "ผมคือ Vachiralai School AI ผู้ช่วยข้อมูลโรงเรียนวชิราลัยยะมะกะตะ\n\n" +
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
      // The interface still works when localStorage is unavailable.
    }
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
    bubble.textContent = text;

    content.appendChild(bubble);

    if (role === "assistant" && !options.hideActions) {
      const actions = document.createElement("div");
      actions.className = "message-actions";

      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "message-action";
      copyButton.textContent = "คัดลอก";
      copyButton.addEventListener("click", async () => {
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

      actions.appendChild(copyButton);
      content.appendChild(actions);
    }

    wrapper.append(avatar, content);
    return wrapper;
  }

  function addMessage(role, text, persist = true) {
    const element = createMessageElement(role, text);
    chatMessages.appendChild(element);

    if (persist) {
      history.push({ role, text });
      history = history.slice(-MAX_HISTORY_ITEMS);
      saveHistory();
    }

    scrollToLatest();
  }

  function renderConversation() {
    chatMessages.replaceChildren();

    if (history.length === 0) {
      chatMessages.appendChild(
        createMessageElement("assistant", welcomeMessage)
      );
      return;
    }

    history.forEach((item) => {
      chatMessages.appendChild(
        createMessageElement(item.role, item.text)
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

      hideTyping();
      addMessage("assistant", answer);
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
      const question = button.dataset.question || "";
      sendQuestion(question);
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
