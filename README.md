# 🧠 Stackit: The Recursive AI Research Interface
> ### **"A Stack Pointer for Your Thoughts."**

---

### 🌳 The Philosophy
Standard AI chats are **linear buffers** (FIFO). Deep research is a **tree structure**.  
**Stackit** brings the two together.



### 🚀 Overview
**Stackit** is a Chrome Extension that transforms Google Gemini into a **non-linear, branching research tool**. 

Instead of losing context in long, drifting conversations, Stackit allows you to **"fork"** a discussion at any point. This creates a **nested child card** that:
* **Preserves state:** Captures the exact context of that specific moment.
* **Isolates logic:** Prevents "context pollution" from affecting the main thread.
* **Visualizes depth:** Uses a recursive UI to show exactly how your research branched.

---

## 🛠 Features

* **Recursive UI:** Infinite nesting of "child cards" within parent responses.
* **Context Slicing:** Automatically manages the `history` array to ensure the AI only "sees" the relevant branch.
* **Privacy First:** **No backend server.** Your API Key is stored locally in your browser.
* **Streaming Responses:** Real-time token streaming for instant feedback.
* **Performance Optimized:** Uses `contain: paint` and hardware-accelerated CSS to handle deep nesting without lag.

---

## ⚙️ Installation (Developer Mode)

1.  **Clone the Repo:**
    ```bash
    git clone https://github.com/thapliyalaryan003/StackIt.git
    ```
2.  **Load in Chrome:**
    * Open `chrome://extensions/`
    * Enable **Developer mode** (top right).
    * Click **Load unpacked** and select this folder.
3.  **Setup API Key:**
    * Get a key from [Google AI Studio](https://aistudio.google.com/).
    * Paste it into the Stackit setup screen.

---

## 🧠 Technical Architecture

### 1. The "Divergent Node" Logic
Built by an embedded engineer, Stackit treats conversation history like a memory stack. When a branch is created, the DOM range is captured and an injection point is created:

```javascript
// Capturing the branch point
const range = selection.getRangeAt(0);
range.collapse(false); 
range.insertNode(divBox);
