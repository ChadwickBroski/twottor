import { notification } from "./notification.js";

const macaqueView = document.getElementById("macaque-view");

if (macaqueView && !window.matchMedia("(max-width: 640px)").matches) {
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
				padding-top: 12px;
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
			body.dark-mode #macaque-view .macaque-assistant code {
				color: #f5f5f5;
				background: #263746;
			}

			body.dark-mode #macaque-view .macaque-composer {
				border-color: #38444d;
			}

			body.dark-mode #macaque-view .macaque-prompt,
			body.dark-mode #macaque-view .macaque-model {
				border-color: #536471;
				color: #f5f5f5;
				background: #15202b;
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
				<select class="macaque-model" id="macaque-model" aria-label="Choose an AI model" disabled>
					<option disabled>Macaque 4</option>
					<option disabled>Macaque 3</option>
					<option disabled>Macaque 2</option>
					<option disabled>Macaque 1.5</option>
					<option>Macaque Mini</option>
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
	const models = {
		// SmolLM2-360M-Instruct-q4f16_1-MLC
		"Macaque Mini": {
			fullName: "Macaque2:360m",
			webllmId: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
		},
		"Macaque 1.5": {
			fullName: "Macaque2:0.5b",
			webllmId: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
		},
		"Macaque 2": {
			fullName: "Macaque2:1.5b",
			webllmId: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
		},
		"Macaque 3": {
			fullName: "Macaque3:3.2b",
			webllmId: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
		},
		"Macaque 4": {
			fullName: "Macaque3:4.0b",
			webllmId: "Qwen3-4B-Instruct-q4f16_1-MLC",
		},
	};
	const memory = navigator.deviceMemory ?? 8;
	let activeModel = memory <= 4 ? "Macaque Mini" : "Macaque Mini";
	let engine;
	let isBusy = false;
	let messages = [];

	modelSelect.value = activeModel;

	function setSystemPrompt(modelName) {
		messages = [{
			role: "system",
			content: `You are ${modelName}, a friendly and truthful AI trained by Monkey Corp. Your full name is ${models[modelName].fullName}. You are helpful, creative, clever, and friendly. If you don't know the answer to something, say so honestly.`,
		}];
	}

	function setBusy(busy) {
		isBusy = busy;
		sendButton.disabled = busy;
		modelSelect.disabled = busy;
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
		let formatted = withCodeBlocks
			.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
			.replace(/\*(.*?)\*/g, "<em>$1</em>")
			.replace(/`(.*?)`/g, "<code>$1</code>")
			.replace(/\n/g, "<br>");
		codeBlocks.forEach((block, index) => {
			formatted = formatted.replace(`__macaque_CODE_${index}__`, block);
		});
		return formatted;
	}

	async function sendMessage() {
		const text = prompt.value.trim();
		if (!text || isBusy || !engine) return;

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
			const stream = await engine.chat.completions.create({
				messages,
				stream: true,
				temperature: 0.7,
				max_tokens: 1000,
			});
			let answer = "";
			for await (const chunk of stream) {
				answer += chunk.choices?.[0]?.delta?.content || "";
				assistantMessage.innerHTML = formatMarkdown(answer);
				chat.scrollTop = chat.scrollHeight;
			}
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

	modelSelect.addEventListener("change", async () => {
		const requestedModel = modelSelect.value;
		if (!engine || !models[requestedModel]) return;

		setBusy(true);
		status.textContent = `Switching to ${requestedModel}...`;
		setMacaqueLoading(true);
		try {
			await engine.reload(models[requestedModel].webllmId);
			activeModel = requestedModel;
			setSystemPrompt(activeModel);
			resetConversation();
			status.textContent = `${activeModel} is ready.`;
			notification("Macaque Mini is ready", "success");
		} catch (error) {
			console.error(error);
			modelSelect.value = activeModel;
			status.textContent = `Couldn't load ${requestedModel}. The current model is still ${activeModel}.`;
			notification(`Couldn't load ${requestedModel}. The current model is still ${activeModel}.`, "failure");
		} finally {
			setMacaqueLoading(false);
			setBusy(false);
		}
	});

	form.addEventListener("submit", (event) => {
		event.preventDefault();
		sendMessage();
	});

	setBusy(true);
	import("https://esm.run/@mlc-ai/web-llm")
		.then(async (webllm) => {
			engine = new webllm.MLCEngine({
				initProgressCallback(progress) {
					status.textContent = progress.progress !== undefined
						? `${progress.text} ${Math.round(progress.progress * 100)}%`
						: progress.text;
				},
			});
			status.textContent = `Loading ${activeModel}...`;
			await engine.reload(models[activeModel].webllmId);
			setSystemPrompt(activeModel);
			status.textContent = `${activeModel} is ready.`;
			notification("Macaque Mini is ready", "success");
			setMacaqueLoading(false);
			setBusy(false);
		})
		.catch((error) => {
			console.error(error);
			status.textContent = "Couldn't load the AI model. Use a WebGPU-compatible browser and try again.";
			notification("Couldn't load the AI model. Use a WebGPU-compatible browser and try again.", "failure");
			setMacaqueLoading(false);
		});
}
