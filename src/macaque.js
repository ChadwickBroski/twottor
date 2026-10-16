import { notification } from "./notification.js";
import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCoUU_nUvDyM_m9tcGuYj-qYcmyPFWGTI",
  authDomain: "twottor.firebaseapp.com",
  projectId: "twottor",
  storageBucket: "twottor.firebasestorage.app",
  messagingSenderId: "927372546363",
  appId: "1:927372546363:web:9e28e525b643c507c8a71e",
	measurementId: "G-9LS15S9KYW",
};

const macaqueView = document.getElementById("macaque-view");

if (macaqueView) {
	const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
	const auth = getAuth(app);
	const workerUrl = "https://macaqueai.aditg0209.workers.dev/";
	macaqueView.innerHTML = `
		<style>
			#macaque-view .macaque-shell {
				display: flex;
				width: min(100%, 960px);
				height: 100vh;
				min-height: 520px;
				flex-direction: column;
				box-sizing: border-box;
				margin: 0 auto;
				overflow: hidden;
				padding: 24px;
				color: #17202a;
			}

			#macaque-view .macaque-header {
				text-align: center;
			}

			#macaque-view .macaque-header h1 {
				margin: 0;
				font-size: 30px;
			}

			#macaque-view .macaque-status {
				min-height: 24px;
				margin: 6px 0 16px;
				color: #657786;
				font-size: 14px;
			}

			#macaque-view .macaque-chat {
				flex: 1 1 0;
				min-height: 0;
				overflow-y: auto;
				padding: 12px 4px;
			}

			#macaque-view .macaque-welcome {
				display: grid;
				min-height: 100%;
				place-items: center;
				color: #657786;
				font-size: clamp(24px, 4vw, 34px);
				text-align: center;
			}

			#macaque-view .macaque-user {
				margin: 16px 0;
				text-align: right;
			}

			#macaque-view .macaque-user span {
				display: inline-block;
				max-width: 75%;
				padding: 12px 16px;
				border-radius: 18px;
				color: #17202a;
				background: #e8f5fe;
				text-align: left;
				overflow-wrap: anywhere;
				white-space: pre-wrap;
			}

			#macaque-view .macaque-assistant {
				max-width: 90%;
				margin: 16px 0;
				line-height: 1.7;
				overflow-wrap: anywhere;
				white-space: pre-wrap;
			}

			#macaque-view .macaque-composer {
				display: flex;
				flex-shrink: 0;
				align-items: center;
				gap: 10px;
				padding-top: 36px;
				border-top: 1px solid #e1e8ed;
			}

			#macaque-view .macaque-prompt,
			#macaque-view .macaque-model {
				min-height: 46px;
				box-sizing: border-box;
				border: 1px solid #c5d0d9;
				border-radius: 999px;
				color: inherit;
				background: #ffffff;
				font: inherit;
			}

			#macaque-view .macaque-prompt {
				min-width: 0;
				flex: 1;
				padding: 10px 16px;
			}

			#macaque-view .macaque-model {
				max-width: 150px;
				padding: 8px 12px;
			}

			#macaque-view .macaque-model-picker {
				position: relative;
				flex: 0 0 210px;
			}

			#macaque-view .macaque-model-trigger {
				display: flex;
				width: 100%;
				min-height: 46px;
				align-items: center;
				gap: 8px;
				padding: 6px 10px;
				border: 1px solid #c5d0d9;
				border-radius: 999px;
				color: inherit;
				background: #ffffff;
				font: inherit;
				text-align: left;
				cursor: pointer;
			}

			#macaque-view .macaque-model-trigger img,
			#macaque-view .macaque-model-option img {
				width: 24px;
				height: 24px;
				flex: 0 0 24px;
				object-fit: contain;
			}

			#macaque-view .macaque-model-trigger span {
				flex: 1;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			#macaque-view .macaque-model-trigger i {
				font-size: 12px;
			}

			#macaque-view .macaque-model-menu {
				position: absolute;
				right: 0;
				bottom: calc(100% + 8px);
				z-index: 5;
				display: grid;
				width: 280px;
				padding: 6px;
				border: 1px solid #c5d0d9;
				border-radius: 12px;
				background: #ffffff;
				box-shadow: 0 8px 24px rgba(23, 32, 42, 0.16);
			}

			#macaque-view .macaque-model-menu[hidden] {
				display: none;
			}

			#macaque-view .macaque-model-option {
				display: flex;
				align-items: center;
				gap: 10px;
				padding: 8px;
				border: 0;
				border-radius: 8px;
				color: inherit;
				background: transparent;
				font: inherit;
				text-align: left;
				cursor: pointer;
			}

			#macaque-view .macaque-model-option:hover,
			#macaque-view .macaque-model-option[aria-selected="true"] {
				background: #e8f5fe;
			}

			#macaque-view .macaque-send {
				display: grid;
				width: 46px;
				height: 46px;
				flex: 0 0 46px;
				place-items: center;
				border: 0;
				border-radius: 50%;
				color: #ffffff;
				background: #17202a;
				cursor: pointer;
			}

			#macaque-view .macaque-send:disabled {
				background: #9aa8b2;
				cursor: not-allowed;
			}

			#macaque-view .macaque-prompt:focus-visible,
			#macaque-view .macaque-model:focus-visible,
			#macaque-view .macaque-model-trigger:focus-visible,
			#macaque-view .macaque-send:focus-visible {
				outline: 2px solid #1da1f2;
				outline-offset: 2px;
			}

			#macaque-view .macaque-assistant pre {
				overflow-x: auto;
				padding: 12px;
				border-radius: 8px;
				background: #e8edf0;
			}

			#macaque-view .macaque-assistant code {
				padding: 2px 5px;
				border-radius: 4px;
				background: #e8edf0;
				font-family: Consolas, monospace;
			}

			#macaque-view .macaque-assistant h2,
			#macaque-view .macaque-assistant h3,
			#macaque-view .macaque-assistant h4 {
				margin: 18px 0 8px;
				line-height: 1.25;
			}

			#macaque-view .macaque-assistant h2 { font-size: 1.65em; }
			#macaque-view .macaque-assistant h3 { font-size: 1.35em; }
			#macaque-view .macaque-assistant h4 { font-size: 1.15em; }
			#macaque-view .macaque-assistant mjx-container[display="true"] {
				margin: 14px 0 !important;
				overflow-x: auto;
				overflow-y: hidden;
			}

			#macaque-view .macaque-assistant blockquote {
				margin: 0 0 16px;
				padding: 0 1em;
				display: block;
				border-left: 4px solid #8c959f;
				color: #656d76;
			}

			#macaque-view .macaque-assistant ul {
				margin: 8px 0;
				padding-left: 22px;
			}

			#macaque-view .macaque-assistant table {
				width: 100%;
				margin: 12px 0;
				border-collapse: collapse;
				font-size: 0.94em;
			}

			#macaque-view .macaque-assistant th,
			#macaque-view .macaque-assistant td {
				padding: 8px 10px;
				border: 1px solid #d5dde3;
				text-align: left;
			}

			#macaque-view .macaque-assistant th {
				background: #e8edf0;
				font-weight: 700;
			}

			#macaque-view .macaque-assistant pre code {
				padding: 0;
				background: transparent;
			}

			body.dark-mode #macaque-view .macaque-shell {
				color: #f5f5f5;
			}

			body.dark-mode #macaque-view .macaque-status,
			body.dark-mode #macaque-view .macaque-welcome {
				color: #c5d0d9;
			}

			body.dark-mode #macaque-view .macaque-user span,
			body.dark-mode #macaque-view .macaque-assistant pre,
			body.dark-mode #macaque-view .macaque-assistant code,
			body.dark-mode #macaque-view .macaque-assistant th {
				color: #f5f5f5;
				background: #263746;
			}

			body.dark-mode #macaque-view .macaque-assistant th,
			body.dark-mode #macaque-view .macaque-assistant td {
				border-color: #536471;
			}

			body.dark-mode #macaque-view .macaque-assistant blockquote {
				border-left-color: #3d444d;
				color: #8b949e;
			}

			body.dark-mode #macaque-view .macaque-composer {
				border-color: #38444d;
			}

			body.dark-mode #macaque-view .macaque-prompt,
			body.dark-mode #macaque-view .macaque-model,
			body.dark-mode #macaque-view .macaque-model-trigger,
			body.dark-mode #macaque-view .macaque-model-menu {
				border-color: #536471;
				color: #f5f5f5;
				background: #15202b;
			}

			body.dark-mode #macaque-view .macaque-model-option:hover,
			body.dark-mode #macaque-view .macaque-model-option[aria-selected="true"] {
				background: #22303c;
			}

			body.dark-mode #macaque-view .macaque-model-size {
				color: #17202a;
				background: #ffffff;
			}

			@media (max-width: 640px) {
				#macaque-view .macaque-model-picker {
					flex-basis: 46px;
				}

				#macaque-view .macaque-model-trigger {
					width: 46px;
					justify-content: center;
					padding: 0;
				}

				#macaque-view .macaque-model-trigger span {
					display: none;
				}

				#macaque-view .macaque-model-trigger i {
					display: none;
				}

				#macaque-view .macaque-model-menu {
					right: 0;
					width: min(280px, calc(100vw - 32px));
				}
			}

			body.dark-mode #macaque-view .macaque-send {
				color: #17202a;
				background: #ffffff;
			}

		</style>
		<section class="macaque-shell" aria-labelledby="macaque-title">
			<header class="macaque-header">
				<h1 id="macaque-title">Macaque AI</h1>
				<p class="macaque-status" id="macaque-status" role="status" aria-live="polite">Preparing Macaque...</p>
			</header>
			<div class="macaque-chat" id="macaque-chat" aria-live="polite">
				<div class="macaque-welcome">What's on your mind?</div>
			</div>
			<form class="macaque-composer" id="macaque-form">
				<input class="macaque-prompt" id="macaque-prompt" placeholder="Message MacaqueAI..." autocomplete="off" aria-label="Message macaque AI" />
				<div class="macaque-model-picker">
					<button class="macaque-model-trigger" id="macaque-model-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="Choose an AI model" disabled>
						<img id="macaque-model-logo" src="https://www.google.com/s2/favicons?domain=cohere.com&sz=64" alt="" />
						<span id="macaque-model-label">Cohere North Mini Code</span>
						<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
					</button>
					<div class="macaque-model-menu" id="macaque-model-menu" role="listbox" aria-label="Choose an AI model" hidden>
						<button class="macaque-model-option" type="button" role="option" data-model="Cohere North Mini Code" aria-selected="true"><img src="https://www.google.com/s2/favicons?domain=cohere.com&sz=64" alt="" /><span>Cohere North Mini Code</span></button>
						<button class="macaque-model-option" type="button" role="option" data-model="LiquidAI LFM2.5 2.6B" aria-selected="false"><img src="https://www.google.com/s2/favicons?domain=liquid.ai&sz=64" alt="" /><span>LiquidAI LFM2.5 2.6B</span></button>
					</div>
				</div>
				<select id="macaque-model" hidden aria-hidden="true">
					<option value="Cohere North Mini Code">Cohere North Mini Code</option>
					<option value="LiquidAI LFM2.5 2.6B">LiquidAI LFM2.5 2.6B</option>
				</select>
				<button class="macaque-send" id="macaque-send" type="submit" aria-label="Send message" title="Send message" disabled>
					<i class="fa-solid fa-arrow-up" aria-hidden="true"></i>
				</button>
			</form>
		</section>
	`;

	const macaqueSideBar = document.getElementById("macaqueSideBar");
	function setMacaqueLoading(isLoading) {
		macaqueSideBar?.setAttribute("aria-busy", String(isLoading));
	}

	const status = macaqueView.querySelector("#macaque-status");
	const chat = macaqueView.querySelector("#macaque-chat");
	const prompt = macaqueView.querySelector("#macaque-prompt");
	const form = macaqueView.querySelector("#macaque-form");
	const sendButton = macaqueView.querySelector("#macaque-send");
	const modelSelect = macaqueView.querySelector("#macaque-model");
	const modelTrigger = macaqueView.querySelector("#macaque-model-trigger");
	const modelMenu = macaqueView.querySelector("#macaque-model-menu");
	const modelLabel = macaqueView.querySelector("#macaque-model-label");
	const modelLogo = macaqueView.querySelector("#macaque-model-logo");
	const modelOptions = [...macaqueView.querySelectorAll(".macaque-model-option")];
	const models = {
		"Cohere North Mini Code": {
			fullName: "Cohere North Mini Code",
			openrouterModel: "cohere/north-mini-code:free",
			logo: "https://www.google.com/s2/favicons?domain=cohere.com&sz=64",
			tooltip: "Cohere North Mini Code: coding, software engineering, and agentic terminal tasks.",
		},
		"LiquidAI LFM2.5 2.6B": {
			fullName: "LiquidAI LFM2.5 2.6B",
			openrouterModel: "liquid/lfm-2.5-2.6b:free",
			logo: "https://www.google.com/s2/favicons?domain=liquid.ai&sz=64",
			tooltip: "Liquid LFM 2.6B: lightweight chat, short reasoning, extraction, and RAG; not for coding-heavy tasks.",
		},
	};
	const memory = navigator.deviceMemory ?? 8;
	let activeModel = memory <= 4 ? "Cohere North Mini Code" : "Cohere North Mini Code";
	let isBusy = false;
	let messages = [];

	modelSelect.value = activeModel;
	modelSelect.title = models[activeModel].tooltip;

	function setSystemPrompt(modelName) {
		messages = [{
			role: "system",
			content: `You are ${modelName}, a friendly and truthful AI chatbot. You are helpful, creative, clever, and friendly. If you don't know the answer to something, answer and say that you are not sure about the answer and the user should double-check.`,
		}];
	}

	function setBusy(busy) {
		isBusy = busy;
		sendButton.disabled = busy;
		modelTrigger.disabled = busy;
	}

	function selectModel(modelName) {
		if (isBusy || !models[modelName]) return;

		activeModel = modelName;
		modelSelect.value = modelName;
		modelSelect.title = models[modelName].tooltip;
		modelLabel.textContent = modelName;
		modelLogo.src = models[modelName].logo;
		modelOptions.forEach((option) => {
			option.setAttribute("aria-selected", String(option.dataset.model === modelName));
		});
		modelMenu.hidden = true;
		modelTrigger.setAttribute("aria-expanded", "false");
		setSystemPrompt(activeModel);
		resetConversation();
		status.textContent = `${activeModel} is ready.`;
	}

	function resetConversation() {
		chat.replaceChildren();
		const welcome = document.createElement("div");
		welcome.className = "macaque-welcome";
		welcome.textContent = "What's on your mind?";
		chat.appendChild(welcome);
	}

	function appendUserMessage(text) {
		const message = document.createElement("div");
		const bubble = document.createElement("span");
		message.className = "macaque-user";
		bubble.textContent = text;
		message.appendChild(bubble);
		chat.appendChild(message);
	}

	function formatMarkdown(text) {
		const escaped = text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
		const codeBlocks = [];
		const withCodeBlocks = escaped.replace(/```([\s\S]*?)```/g, (_, code) => {
			codeBlocks.push(`<pre><code>${code}</code></pre>`);
			return `__macaque_CODE_${codeBlocks.length - 1}__`;
		});
		const mathBlocks = [];
		const withMath = withCodeBlocks.replace(/\\\[([\s\S]*?)\\\]|\\\((.*?)\\\)/g, (_, display, inline) => {
			mathBlocks.push({ display, inline });
			return `__macaque_MATH_${mathBlocks.length - 1}__`;
		});
		const withBlockquotes = withMath.replace(/^\s*\\?(?:>|&gt;)/gm, ">");
		const lines = withBlockquotes.split("\n");
		const renderedLines = [];
		for (let index = 0; index < lines.length; index += 1) {
			const line = lines[index];
			const nextLine = lines[index + 1] || "";
			if (/^\s*\\?>/.test(line)) {
				const quoteLines = [];
				while (index < lines.length && /^\s*\\?>/.test(lines[index])) {
					quoteLines.push(lines[index].replace(/^\s*\\?>\s?/, "").replace(/\\\s*$/, ""));
					index += 1;
				}
				renderedLines.push(`<blockquote>${quoteLines.join("\n")}</blockquote>`);
				index -= 1;
				continue;
			}
			if (/^\s*\|?.+\|.+\|?\s*$/.test(line) && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(nextLine)) {
				const tableRows = [line, ...lines.slice(index + 2).filter((row) => /^\s*\|?.+\|.+\|?\s*$/.test(row))];
				const cells = (row) => row.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
				const header = cells(tableRows[0]);
				const body = tableRows.slice(1).map(cells);
				renderedLines.push(`<table><thead><tr>${header.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
				index += tableRows.length - 1;
				continue;
			}
			renderedLines.push(line);
		}
		let formatted = renderedLines.join("\n")
			.replace(/^###\s+(.+)$/gm, "<h4>$1</h4>")
			.replace(/^##\s+(.+)$/gm, "<h3>$1</h3>")
			.replace(/^#\s+(.+)$/gm, "<h2>$1</h2>")
			.replace(/^\\?>\s?(.+)$/gm, "<blockquote>$1</blockquote>")
			.replace(/^\s*([-*_])(?:\s*\1){2,}\s*$/gm, "<hr>")
			.replace(/^\s*[-*+]\s+(.+)$/gm, "<li>$1</li>")
			.replace(/^\s*\d+[.)]\s+(.+)$/gm, "<li>$1</li>")
			.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>")
			.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
			.replace(/~~(.*?)~~/g, "<del>$1</del>")
			.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
			.replace(/\*(.*?)\*/g, "<em>$1</em>")
			.replace(/`(.*?)`/g, "<code>$1</code>")
			.replace(/\n/g, "<br>");
		codeBlocks.forEach((block, index) => {
			formatted = formatted.replace(`__macaque_CODE_${index}__`, block);
		});
		mathBlocks.forEach(({ display, inline }, index) => {
			const math = display !== undefined ? `\\[${display}\\]` : `\\(${inline}\\)`;
			formatted = formatted.replace(`__macaque_MATH_${index}__`, math);
		});
		return formatted;
	}

	let mathJaxPromise;
	function typesetMath(element) {
		if (!mathJaxPromise) {
			window.MathJax = window.MathJax || {
				tex: { inlineMath: [["\\(", "\\)"]], displayMath: [["\\[", "\\]"]] },
				options: { skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"] },
			};
			mathJaxPromise = new Promise((resolve, reject) => {
				if (window.MathJax.typesetPromise) {
					resolve(window.MathJax);
					return;
				}
				const script = document.createElement("script");
				script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
				script.async = true;
				script.onload = () => resolve(window.MathJax);
				script.onerror = reject;
				document.head.appendChild(script);
			});
		}
		return mathJaxPromise.then((mathJax) => mathJax.typesetPromise?.([element])).catch(() => undefined);
	}

	function renderAssistantMessage(element, content, typeset = false) {
		element.innerHTML = formatMarkdown(content);
		if (typeset && /\\(?:\[|\()/.test(content)) typesetMath(element);
	}

	async function readAssistantResponse(response, onUpdate) {
		const contentType = response.headers.get("Content-Type") || "";
		if (!contentType.includes("text/event-stream")) {
			const result = await response.json();
			if (typeof result.content !== "string") {
				throw new Error("Macaque returned an invalid response.");
			}
			onUpdate(result.content);
			return result.content;
		}

		const reader = response.body?.getReader();
		if (!reader) throw new Error("Macaque returned an empty response.");

		const decoder = new TextDecoder();
		let buffer = "";
		let answer = "";
		let finished = false;

		function consumeEvent(event) {
			const data = event.split(/\r?\n/)
				.filter((line) => line.startsWith("data:"))
				.map((line) => line.slice(5).trim())
				.join("\n");
			if (!data) return false;
			if (data === "[DONE]") return true;

			const chunk = JSON.parse(data);
			if (chunk.error) throw new Error(chunk.error.message || "Macaque stream failed.");
			const content = chunk.choices?.[0]?.delta?.content || "";
			if (content) {
				answer += content;
				onUpdate(answer);
			}
			return false;
		}

		while (!finished) {
			const { done, value } = await reader.read();
			buffer += decoder.decode(value, { stream: !done });
			const events = buffer.split(/\r?\n\r?\n/);
			buffer = events.pop() || "";
			for (const event of events) {
				if (consumeEvent(event)) {
					finished = true;
					break;
				}
			}
			if (done) finished = true;
		}

		if (buffer.trim()) consumeEvent(buffer);
		return answer;
	}

	async function sendMessage() {
		const text = prompt.value.trim();
		if (!text || isBusy || !auth.currentUser) return;

		chat.querySelector(".macaque-welcome")?.remove();
		appendUserMessage(text);
		prompt.value = "";
		const assistantMessage = document.createElement("div");
		assistantMessage.className = "macaque-assistant";
		chat.appendChild(assistantMessage);
		messages.push({ role: "user", content: text });
		const maxMessages = 11;
		if (messages.length > maxMessages) {
			messages.splice(1, messages.length - maxMessages);
		}
		chat.scrollTop = chat.scrollHeight;
		setBusy(true);

		try {
			setMacaqueLoading(true);
			const idToken = await auth.currentUser.getIdToken();
			const response = await fetch(workerUrl, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${idToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					messages,
					model: models[activeModel].openrouterModel,
				}),
			});
			if (!response.ok) {
				const errorResult = await response.json().catch(() => null);
				throw new Error(errorResult?.error || `Macaque request failed (${response.status}).`);
			}
			const answer = await readAssistantResponse(response, (content) => {
				renderAssistantMessage(assistantMessage, content);
				chat.scrollTop = chat.scrollHeight;
			});
			renderAssistantMessage(assistantMessage, answer, true);
			messages.push({ role: "assistant", content: answer });
			if (window.location.hash !== "#macaque") {
				notification("Macaque has finished it's response");		
			}
		} catch (error) {
			console.error(error);
			assistantMessage.textContent = `Error: ${error.message}`;
			notification(`Error: ${error.message}`, "failure");
		} finally {
			setMacaqueLoading(false);
			setBusy(false);
			prompt.focus();
		}
	}

	modelSelect.addEventListener("change", () => selectModel(modelSelect.value));
	modelTrigger.addEventListener("click", () => {
		if (isBusy) return;
		modelMenu.hidden = !modelMenu.hidden;
		modelTrigger.setAttribute("aria-expanded", String(!modelMenu.hidden));
	});
	modelOptions.forEach((option) => {
		option.addEventListener("click", () => selectModel(option.dataset.model));
	});
	document.addEventListener("click", (event) => {
		if (!modelMenu.contains(event.target) && !modelTrigger.contains(event.target)) {
			modelMenu.hidden = true;
			modelTrigger.setAttribute("aria-expanded", "false");
		}
	});

	form.addEventListener("submit", (event) => {
		event.preventDefault();
		sendMessage();
	});

	setBusy(true);
	status.textContent = "Checking sign-in...";
	setMacaqueLoading(true);
	onAuthStateChanged(auth, (user) => {
		if (!user) {
			status.textContent = "Sign in to use Macaque.";
			setMacaqueLoading(false);
			setBusy(true);
			return;
		}

		setSystemPrompt(activeModel);
		status.textContent = `${activeModel} is ready.`;
		setMacaqueLoading(false);
		setBusy(false);
	});
}
