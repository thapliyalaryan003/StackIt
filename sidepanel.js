const loginScreen = document.getElementById('api-key-screen');
const mainScreen = document.getElementById('chat-screen');
const saveButton = document.getElementById('saveBtn');
const inputField = document.getElementById('apiKeyInput');
const changeButton = document.getElementById('changeKeyBtn');
const apiCallBtn = document.getElementById('apiCallBtn');
const promptField = document.getElementById('prompt');
const btnTop = document.getElementById('scrollTopBtn');
const btnBottom = document.getElementById('scrollBottomBtn');
const clrStackBtn = document.getElementById('clrStackBtn');

promptField.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px'; // Auto-expand
});

promptField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        apiCall(); // Sends on Enter
    }
});

chrome.storage.local.get('GEMINI_API_KEY', (result) => {
    if (result.GEMINI_API_KEY){
        loginScreen.classList.add('hidden');
        mainScreen.classList.remove('hidden');
    }
});
saveButton.addEventListener('click', () => {
    const userKey = inputField.value.trim();
    if (userKey.length < 20) { 
        alert("That doesn't look like a valid Gemini API Key.");
        return;
    }
    else{
        chrome.storage.local.set({'GEMINI_API_KEY': userKey}, () => {
            loginScreen.classList.add('hidden');
            mainScreen.classList.remove('hidden');
        });
    }
});

changeButton.addEventListener('click', () => {
    chrome.storage.local.remove('GEMINI_API_KEY');
    location.reload();
});

document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.local.get(['selectionText']);
  
  if(data.selectionText){
    updateUI(data.selectionText);
    chrome.storage.local.set({selectionText: ""},() => {console.log('Selection Text Cleared');});
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if(namespace === 'local'){
        if(changes.selectionText){
            const newText = changes.selectionText.newValue;
            if(newText && newText.trim() !== "") updateUI(newText);
        }
    }
})



function updateUI(text){
    const displayElement = document.getElementById('prompt');

    if(displayElement){
        displayElement.value = text;

        displayElement.style.backgroundColor = "#e8f0fe";
        setTimeout(() => {
            displayElement.style.backgroundColor = "transparent";
        }, 500);
    }
}

const stackContainer = document.getElementById('stack-container');
let conversationHistory = [];

chrome.storage.session.get(['chat_history'], (res) => {
    if (res.chat_history) {
        conversationHistory = res.chat_history;
        // Logic to render these would go here if you want them visible on load
        // Loop through the history and rebuild the UI
        conversationHistory.forEach((msg, index) => {
            // We only want to create a card for the AI responses (model role)
            if (msg.role === "model") {
                const userMsg = conversationHistory[index - 1]?.parts[0]?.text || "Previous Query";
                
                const historyCard = document.createElement('div');
                historyCard.className = 'stack-card';
                // NEW: Tag the card with its index in history
                historyCard.setAttribute('data-msg-index', index); 
            
                historyCard.innerHTML = `
                    <div class="card-query">${userMsg}</div>
                    <div class="card-response">${marked.parse(msg.parts[0].text)}</div>
                `;
                // Re-attach the collapse listener to historical cards
                historyCard.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                historyCard.classList.toggle('collapsed');
                window.dispatchEvent(new Event('resize'));
                });               // Re-attach the selection listener so you can branch from old chats
                historyCard.querySelector('.card-response').addEventListener('mouseup', handleSelection);
                
                stackContainer.appendChild(historyCard);
            }
        });
        // Scroll to the bottom once loaded
stackContainer.lastElementChild?.scrollIntoView({ behavior: 'smooth' });    }
});

async function apiCall() {
    const promptField = document.getElementById('prompt');
    const streamContainer = document.getElementById('stream-container');
    const streamDisplay = document.getElementById('response-stream-display');

    const userPrompt = promptField.value.trim();
    if (!userPrompt) return;

    const isFollowUp = stackContainer.dataset.nextIsChild === "true";
    const branchPoint = stackContainer.dataset.branchPoint;
    let historyToSend = [...conversationHistory];
    // NEW: If branching, cut the history to the branch point
    if (isFollowUp && branchPoint !== undefined) {
        historyToSend = historyToSend.slice(0, parseInt(branchPoint) + 1);
        delete stackContainer.dataset.branchPoint; 
    }

    // 1. Prepare UI for "Thinking"
    streamContainer.classList.remove('hidden');
    streamDisplay.innerText = "Thinking 🤔...";

    streamContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    historyToSend.push({
        role: "user",
        parts: [{ text: userPrompt }]
    });

    const result = await chrome.storage.local.get('GEMINI_API_KEY');
    const apiKey = result.GEMINI_API_KEY;
    const model = "gemini-2.5-flash"; // Recommended stable model
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:streamGenerateContent?key=${apiKey}`;

    // 2. Create the permanent card immediately so we can stream into it
    const finalCard = document.createElement('div');
    finalCard.className = isFollowUp ? 'stack-card child-card' : 'stack-card';
    finalCard.innerHTML = `
        <div class="card-query">${userPrompt}</div>
        <div class="card-response"></div>
    `;
const activePoint = document.getElementById('active-divergent-point');

    if (isFollowUp && activePoint) {
        // Insert the card EXACTLY where you were typing
        activePoint.insertAdjacentElement('afterend', finalCard);
        // Now it's safe to remove the input box
        activePoint.remove(); 
    } else {
        stackContainer.appendChild(finalCard);
    }

    setTimeout(() => {
        finalCard.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
    }, 50);

    finalCard.addEventListener('dblclick', (e) => {
    e.stopPropagation(); // Prevents child clicks from collapsing parents
    finalCard.classList.toggle('collapsed');
    
    // Instead of forceReflow, we just tell the window to check its layout
    window.dispatchEvent(new Event('resize'));
});
    const responseTarget = finalCard.querySelector('.card-response');

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: historyToSend })
        });

        const reader = response.body.getReader();
        let streamBuffer = "";
        let fullAiResponse = "";

        // Clear "Thinking" once stream starts
        streamContainer.classList.add('hidden');
        streamDisplay.innerText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            streamBuffer += new TextDecoder().decode(value);

            // Extract text from Gemini's chunked JSON format
            let startIdx;
            while ((startIdx = streamBuffer.indexOf('{')) !== -1 ) {
                let endIdx = -1;
                let bracketCount = 0;

                for (let i = startIdx; i < streamBuffer.length; i++){
                    if (streamBuffer[i] === '{') bracketCount ++;
                    else if (streamBuffer[i] === '}') bracketCount--;

                    if (bracketCount === 0) {
                        endIdx = i;
                        break;
                    }
                }

                if (endIdx === -1) break;

                const rawJson = streamBuffer.slice(startIdx, endIdx + 1);
                streamBuffer = streamBuffer.slice(endIdx + 1);

                try {
                    const json = JSON.parse(rawJson);
                    const textPart = json.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (textPart) {
                        fullAiResponse += textPart;
                        // Format on the fly and update the card
                        responseTarget.innerHTML = marked.parse(fullAiResponse);
                    }
                } catch (e) { break; }
            }
        }

        // 3. Finalize
        responseTarget.addEventListener('mouseup', handleSelection);
        if (isFollowUp) {
            stackContainer.dataset.nextIsChild = "false";
        }

        conversationHistory = [...historyToSend, {
            role: "model",
            parts: [{ text: fullAiResponse }]
        }];

        finalCard.setAttribute('data-msg-index', conversationHistory.length - 1);
        chrome.storage.session.set({ chat_history: conversationHistory });

        promptField.value = "";
        promptField.style.height = 'auto';

    } catch (error) {
        console.error("Stackit Error", error);
        streamContainer.classList.remove('hidden');
        streamDisplay.innerText = `[System Error]: ${error.message}`;
    }
}


function handleSelection(e) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    if (selectedText.length > 0) {
        const range = selection.getRangeAt(0);
        createDivergentNode(range, selectedText);
    }
}

function createDivergentNode(range, textToExplain) {
    // 1. Close any existing boxes first
   if (document.querySelector('.divergent-box')) {
        document.querySelector('.divergent-box').remove();
    }
    // 2. Create the box
    const divBox = document.createElement('div');
    divBox.className = 'divergent-box';
    divBox.innerHTML = `
        <div style="font-size: 11px; color: var(--accent); font-weight: bold; margin-bottom:5px;">FOLLOW-UP</div>
        <input type="text" class="followup-input" 
               style="width: 100%; border: none; outline: none; background: transparent; color: var(--text-primary);" 
               value='Explain "${textToExplain}"'>
        <button class="followup-go" style="float: right; background: var(--accent); color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor:pointer;">Ask</button>
        <div style="clear:both;"></div>
    `;

    // 3. KEY CHANGE: Insert EXACTLY at selection point
    range.collapse(false); 
    range.insertNode(divBox);

    // FIX: Clear the blue highlight selection so the mouse works normally
    window.getSelection().removeAllRanges();

    const input = divBox.querySelector('.followup-input');
    
    // Slight delay ensures the DOM has placed the element before focusing
    setTimeout(() => {
        input.focus();
        input.select();
    }, 10);

    // Prevent clicks inside the box from bubbling up to the card (which might trigger a dblclick)
    divBox.addEventListener('mousedown', (e) => e.stopPropagation());
    divBox.addEventListener('mouseup', (e) => e.stopPropagation());

    const triggerApi = () => {
    const query = input.value;
    promptField.value = query;
    stackContainer.dataset.nextIsChild = "true"; 
    
    // NEW: Tag the box itself so apiCall knows EXACTLY where to put the card
    divBox.id = "active-divergent-point";
    // NEW: Find the parent card and save its index
    const parentCard = divBox.closest('.stack-card');
    if (parentCard) {
        stackContainer.dataset.branchPoint = parentCard.getAttribute('data-msg-index');
    }
    apiCall();
    };

    divBox.querySelector('.followup-go').addEventListener('click', triggerApi);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') triggerApi(); });
}

// Attach listener to the initial stream display area
document.getElementById('response-stream-display').addEventListener('mouseup', handleSelection);

// Navigate to the top marker
btnTop.addEventListener('click', () => {
    document.getElementById('top-marker').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
});

// Navigate to the bottom marker
btnBottom.addEventListener('click', () => {
    document.getElementById('bottom-marker').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'end' 
    });
});

clrStackBtn.addEventListener('click',()=>{
    if(stackContainer.children.length> 0){
    chrome.storage.session.set({chat_history:[]});
    stackContainer.replaceChildren();
}})

apiCallBtn.addEventListener('click', apiCall);

