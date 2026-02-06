const loginScreen = document.getElementById('api-key-screen');
const mainScreen = document.getElementById('chat-screen');
const saveButton = document.getElementById('saveBtn');
const inputField = document.getElementById('apiKeyInput');
const changeButton = document.getElementById('changeKeyBtn');
const apiCallBtn = document.getElementById('apiCallBtn');

chrome.storage.local.get('GEMINI_API_KEY', (result) => {
    if (result.GEMINI_API_KEY){
        loginScreen.classList.add('hidden');
        mainScreen.classList.remove('hidden');
    }
});
saveButton.addEventListener('click', () => {
    const userKey = inputField.value;
    if(userKey){
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
            updateUI(newText);
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

async function apiCall(){
    const promptField = document.getElementById('prompt');
    const streamContainer = document.getElementById('stream-container');
    const streamDisplay = document.getElementById('response-stream-display');

    const userPrompt = promptField.value;

    if (!userPrompt) return;
    
    streamContainer.classList.remove('hidden');
    streamDisplay.innerText = "Thinking 🤔...";

    conversationHistory.push({
        role: "user",
        parts: [{text: userPrompt}]
    });

    const result = await chrome.storage.local.get('GEMINI_API_KEY');
    const apiKey = result.GEMINI_API_KEY;
    const model = "gemini-3-flash-preview";


    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({
                contents: conversationHistory
            })
        });

        const reader = response.body.getReader();
        let streamBuffer = "";
        let fullAiResponse = "";
        streamDisplay.innerText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            streamBuffer += new TextDecoder().decode(value);

             // The Gemini stream returns objects wrapped in [ , , ]
            // We need to find valid JSON blocks. 
            // A simple way is to find the boundaries of the JSON objects.
            
            let boundary;
            // Look for the end of a JSON object (the closing brace of a candidate)
            while ((boundary = streamBuffer.indexOf('}\n,')) !== -1 || (boundary = streamBuffer.indexOf('}]')) !== -1) {
                
                // Adjust boundary to include the closing brace
                let endOfObj = streamBuffer.lastIndexOf('}', boundary) + 1;
                let rawJson = streamBuffer.slice(0, endOfObj).trim();
                
                // Clean up leading commas or brackets
                if (rawJson.startsWith(',')) rawJson = rawJson.slice(1).trim();
                if (rawJson.startsWith('[')) rawJson = rawJson.slice(1).trim();

                try {
                    const json = JSON.parse(rawJson);
                    const textPart = json.candidates?.[0]?.content?.parts?.[0]?.text;
                    
                    if (textPart) {
                        streamDisplay.innerText += textPart;
                        streamDisplay.scrollTop = streamDisplay.scrollHeight;
                    }
                } catch (e) {
                    // If parse fails, it might be a partial chunk; wait for more data
                    console.error("Partial JSON chunk detected, waiting...");
                    break; 
                }

                // Remove the processed part from the buffer
                streamBuffer = streamBuffer.slice(boundary + 1);
                }
            }
                const finalCard = document.createElement('div');
                finalCard.className = 'stack-card';
                finalCard.innerHTML = `
                    <div class="card-query">${userPrompt}</div>
                    <div class="card-response">${streamDisplay.innerText}</div>
                `;

                finalCard.querySelector('.card-response').addEventListener('mouseup', () => {
                    const selectedText = window.getSelection().toString().trim();
                    if (selectedText.length > 0){
                        createDivergentNode(finalCard.querySelector('.card-response'), selectedText);
                    }
                });

                stackContainer.appendChild(finalCard);

                promptField.value = "";
                streamDisplay.innerText = "";
                streamContainer.classList.add('hidden');

                conversationHistory.push({
                    role:"model",
                    parts: [{text: finalCard.querySelector('.card-response').innerText}]
                });
                }
    catch(error){
        console.error("Stackit Error", error);
        streamDisplay.innerText= `[System Error]: ${error.message}`;
    }


}

function createDivergentNode(targetElement, textToExplain){
    if (targetElement.querySelector('.divergent-box')) return;

    const divBox= document.createElement('div');
    divBox.className = 'divergent-box';
    divBox.innerHTML = `
        <div style="margin: 10px 0; padding: 10px; border-left: 3px solid #4285f4; background: #f8f9fa;">
            <input type="text" class="followup-input" value='Explain "${textToExplain}"'>
            <button class="followup-go">Ask</button>
        </div>
        <div class="followup-response hidden"></div>    
    `;

    targetElement.appendChild(divBox);

    divBox.querySelector('.followup-go').addEventListener('click', () => {
        const query = divBox.querySelector('.followup-input').value;
        document.getElementById('prompt').value = query;
        apiCall();
        divBox.remove();
    })
    
}


apiCallBtn.addEventListener('click', apiCall);

