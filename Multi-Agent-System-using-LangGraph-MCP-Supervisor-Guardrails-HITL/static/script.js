let currentThreadId = localStorage.getItem("travel_thread_id") || null;
let latestAnswerMarkdown = "";
let waitingForApproval = false;

const AGENT_LABELS = {
  flight_agent: "✈️ Flight Agent",
  hotel_agent: "🏨 Hotel Agent",
  weather_agent: "🌦️ Weather Agent",
  budget_agent: "💰 Budget Agent",
  itinerary_agent: "🗓️ Itinerary Agent"
};

function setPrompt(text) {
  const input = document.getElementById("userInput");
  input.value = text;
  scrollToPlanner();
  input.focus();
}

function scrollToPlanner() {
  const plannerCard = document.getElementById("plannerCard");
  if (plannerCard) {
    plannerCard.scrollIntoView({ behavior: "smooth", block: "start" });
    const input = document.getElementById("userInput");
    if (input) {
      setTimeout(() => input.focus(), 400);
    }
  }
}

function setLoading(isLoading, mode = "draft") {
  const sendBtn = document.getElementById("sendBtn");
  const btnText = document.getElementById("btnText");
  const btnLoader = document.getElementById("btnLoader");
  const approveBtn = document.getElementById("approveBtn");
  const reviseBtn = document.getElementById("reviseBtn");

  if (sendBtn) sendBtn.disabled = isLoading;
  if (approveBtn) approveBtn.disabled = isLoading;
  if (reviseBtn) reviseBtn.disabled = isLoading;

  if (btnText && btnLoader) {
    if (isLoading && mode === "draft") {
      btnText.classList.add("hidden");
      btnLoader.classList.remove("hidden");
    } else {
      btnText.classList.remove("hidden");
      btnLoader.classList.add("hidden");
    }
  }
}

function showError(message) {
  const errorBox = document.getElementById("errorBox");
  if (errorBox) {
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
    errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function hideError() {
  const errorBox = document.getElementById("errorBox");
  if (errorBox) {
    errorBox.classList.add("hidden");
    errorBox.textContent = "";
  }
}

function renderMarkdown(element, markdown) {
  if (typeof marked !== "undefined") {
    element.innerHTML = marked.parse(markdown || "");
  } else {
    element.innerText = markdown || "";
  }
}

function showWorkflow(data) {
  const section = document.getElementById("workflowSection");
  const reasoning = document.getElementById("supervisorReasoning");
  const chips = document.getElementById("agentChips");
  const guardrailBadge = document.getElementById("guardrailBadge");

  if (reasoning) {
    reasoning.textContent = data.supervisor_reasoning || "Supervisor routing completed.";
  }
  
  if (chips) {
    chips.innerHTML = "";
    (data.selected_agents || []).forEach((agent) => {
      const chip = document.createElement("span");
      chip.className = "agent-chip";
      chip.textContent = AGENT_LABELS[agent] || agent;
      chips.appendChild(chip);
    });
  }

  if (guardrailBadge) {
    if (data.guardrail_allowed === false) {
      guardrailBadge.textContent = "Guardrail blocked";
      guardrailBadge.classList.add("blocked");
    } else {
      guardrailBadge.textContent = "Guardrail passed";
      guardrailBadge.classList.remove("blocked");
    }
  }

  if (section) {
    section.classList.remove("hidden");
  }
}

function showResult(answer, threadId, isDraft = false) {
  latestAnswerMarkdown = answer || "";

  const resultSection = document.getElementById("resultSection");
  const resultBox = document.getElementById("resultBox");
  const threadInfo = document.getElementById("threadInfo");
  const resultTitle = document.getElementById("resultTitle");

  if (resultBox) {
    renderMarkdown(resultBox, latestAnswerMarkdown);
  }
  if (threadInfo) {
    threadInfo.textContent = `Thread ID: ${threadId}`;
  }
  if (resultTitle) {
    resultTitle.textContent = isDraft ? "Draft Travel Plan" : "Your Final AI Travel Plan";
  }
  if (resultSection) {
    resultSection.classList.remove("hidden");
    resultSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

function showApproval(data) {
  waitingForApproval = true;
  const section = document.getElementById("approvalSection");
  const approvalRequest = document.getElementById("approvalRequest");
  if (approvalRequest) {
    approvalRequest.textContent = data.approval_request ||
      "Approve the draft or provide feedback before the final plan is generated.";
  }
  if (section) {
    section.classList.remove("hidden");
  }
}

function hideApproval() {
  waitingForApproval = false;
  const section = document.getElementById("approvalSection");
  const feedback = document.getElementById("approvalFeedback");
  if (section) section.classList.add("hidden");
  if (feedback) feedback.value = "";
}

async function sendMessage() {
  hideError();

  if (waitingForApproval) {
    showError("Please approve or revise the current draft before starting another plan.");
    return;
  }

  const input = document.getElementById("userInput");
  const message = input ? input.value.trim() : "";

  if (!message) {
    showError("Please enter your travel request first.");
    return;
  }

  setLoading(true, "draft");

  try {
    const response = await fetch("/api/travel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: message,
        thread_id: currentThreadId
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Something went wrong.");
    }

    currentThreadId = data.thread_id;
    localStorage.setItem("travel_thread_id", currentThreadId);

    showWorkflow(data);

    if (data.requires_approval) {
      showResult(data.itinerary || data.answer, data.thread_id, true);
      showApproval(data);
    } else {
      hideApproval();
      showResult(data.answer, data.thread_id, false);
    }
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false, "draft");
  }
}

async function submitApproval(approved) {
  hideError();

  if (!currentThreadId || !waitingForApproval) {
    showError("There is no draft waiting for approval.");
    return;
  }

  const feedbackInput = document.getElementById("approvalFeedback");
  const feedback = feedbackInput ? feedbackInput.value.trim() : "";

  if (!approved && !feedback) {
    showError("Please enter revision feedback before requesting changes.");
    if (feedbackInput) feedbackInput.focus();
    return;
  }

  setLoading(true, "approval");

  try {
    const response = await fetch("/api/travel/approve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        thread_id: currentThreadId,
        approved: approved,
        feedback: feedback
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Could not resume the travel workflow.");
    }

    showWorkflow(data);
    hideApproval();
    showResult(data.answer, data.thread_id, false);
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false, "approval");
  }
}

function copyResult() {
  const resultBox = document.getElementById("resultBox");
  const text = resultBox ? resultBox.innerText : "";

  if (!text) {
    return;
  }

  navigator.clipboard.writeText(text)
    .then(() => {
      const copyBtn = document.querySelector(".copy-btn span");
      if (copyBtn) {
        const oldText = copyBtn.textContent;
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
          copyBtn.textContent = oldText;
        }, 1400);
      }
      showToast("Itinerary copied to clipboard!");
    })
    .catch(() => {
      showError("Could not copy result.");
    });
}

function downloadPDF() {
  const resultBox = document.getElementById("resultBox");

  if (!latestAnswerMarkdown || !resultBox) {
    showError("No travel plan available to download.");
    return;
  }

  const downloadBtn = document.querySelector(".download-btn span");
  const oldText = downloadBtn ? downloadBtn.textContent : "Download PDF";
  if (downloadBtn) downloadBtn.textContent = "Preparing PDF...";
  const btnEl = document.querySelector(".download-btn");
  if (btnEl) btnEl.disabled = true;

  // Build a dedicated off-screen printable container to guarantee zero scroll offsets and clean page breaks
  const exportContainer = document.createElement("div");
  exportContainer.className = "pdf-export-container";
  exportContainer.style.position = "absolute";
  exportContainer.style.left = "-9999px";
  exportContainer.style.top = "0";
  exportContainer.style.width = "750px";

  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  exportContainer.innerHTML = `
    <div class="pdf-export-header">
      <div class="pdf-export-brand">
        <svg class="pdf-logo-icon" viewBox="0 0 36 36" fill="none" width="28" height="28">
          <circle cx="18" cy="18" r="15" stroke="#F06435" stroke-width="2.5" stroke-dasharray="72 20"/>
          <ellipse cx="18" cy="18" rx="14.5" ry="6.5" transform="rotate(-30 18 18)" stroke="#F06435" stroke-width="1.8"/>
          <path d="M12.5 12.5L23.5 23.5M23.5 12.5L12.5 23.5" stroke="#111827" stroke-width="2.8" stroke-linecap="round"/>
          <circle cx="28" cy="11" r="3" fill="#F06435"/>
        </svg>
        <span class="pdf-brand-name">Orbit<strong>X</strong></span>
        <span class="pdf-brand-badge">Official Travel Plan</span>
      </div>
      <div class="pdf-export-meta">
        <span>Generated: ${today}</span>
      </div>
    </div>
    <div class="pdf-export-body">
      ${resultBox.innerHTML}
    </div>
    <div class="pdf-export-footer">
      <span>OrbitX Multi-Agent Travel Intelligence</span>
      <span>Itinerary &amp; Cost Estimation Report</span>
    </div>
  `;

  document.body.appendChild(exportContainer);

  const options = {
    margin: [0.4, 0.4, 0.4, 0.4],
    filename: "orbitx-travel-plan.pdf",
    image: {
      type: "jpeg",
      quality: 0.98
    },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      scrollY: 0,
      scrollX: 0,
      windowWidth: 800
    },
    jsPDF: {
      unit: "in",
      format: "a4",
      orientation: "portrait"
    },
    pagebreak: {
      mode: ["css", "legacy"],
      avoid: ["tr", "h1", "h2", "h3", ".pdf-export-header", ".pdf-export-footer"]
    }
  };

  html2pdf()
    .set(options)
    .from(exportContainer)
    .save()
    .then(() => {
      if (exportContainer.parentNode) {
        document.body.removeChild(exportContainer);
      }
      if (downloadBtn) downloadBtn.textContent = oldText;
      if (btnEl) btnEl.disabled = false;
      showToast("PDF downloaded successfully!");
    })
    .catch((err) => {
      console.error(err);
      if (exportContainer.parentNode) {
        document.body.removeChild(exportContainer);
      }
      if (downloadBtn) downloadBtn.textContent = oldText;
      if (btnEl) btnEl.disabled = false;
      showError("Could not download PDF.");
    });
}

/* ==========================================================================
   UI Helpers: Language, Modal & Toast
   ========================================================================== */
function setLanguage(lang) {
  const selectedLang = document.getElementById("selectedLang");
  if (selectedLang) {
    selectedLang.textContent = lang;
  }
  document.querySelectorAll(".lang-item").forEach(item => {
    item.classList.toggle("active", item.textContent.trim() === lang);
  });
  showToast(`Language switched to ${lang}`);
}

function openRegisterModal() {
  const modal = document.getElementById("registerModal");
  if (modal) {
    modal.classList.remove("hidden");
    const firstInput = modal.querySelector("input");
    if (firstInput) setTimeout(() => firstInput.focus(), 150);
  }
}

function closeRegisterModal() {
  const modal = document.getElementById("registerModal");
  if (modal) {
    modal.classList.add("hidden");
  }
}

function handleRegisterSubmit() {
  const nameInput = document.getElementById("regName");
  const name = nameInput ? nameInput.value.trim() : "Traveler";
  closeRegisterModal();
  showToast(`Welcome to OrbitX, ${name}! Your account is ready.`);
}

function showToast(message) {
  const toast = document.getElementById("toastMessage");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 2600);
}

// Mobile navigation toggle
document.addEventListener("DOMContentLoaded", () => {
  const mobileBtn = document.getElementById("mobileMenuBtn");
  const navMenu = document.getElementById("navMenu");
  if (mobileBtn && navMenu) {
    mobileBtn.addEventListener("click", () => {
      navMenu.classList.toggle("open");
    });
  }
});

// Shortcut: Ctrl+Enter to submit
document.addEventListener("keydown", function(event) {
  if (event.ctrlKey && event.key === "Enter") {
    sendMessage();
  }
});
