'use strict';
const fetchJsonFile = await fetch("./api.json")
const DID_API = await fetchJsonFile.json()

if (DID_API.key == '🤫') alert('Please put your api key inside ./api.json and restart..');


const videoElement = document.getElementById('video-element');
const inputText = document.getElementById('inputText');
const loadingContainer = document.getElementById('loadingContainer');
const voiceIcon = document.getElementById('voiceIcon');
const send = document.getElementById('send');
let isRecording = false;

if ('webkitSpeechRecognition' in window) {
  const recognition = new webkitSpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  voiceIcon.addEventListener('click', () => {
    if (isRecording) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });

  recognition.onstart = () => {
    isRecording = true;
    voiceIcon.textContent = '🛑';
  };

  recognition.onresult = (event) => {
    const speechResult = event.results[0][0].transcript;
    inputText.value = speechResult;
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
  };

  recognition.onend = () => {
    isRecording = false;
    voiceIcon.textContent = '🎤';
  };
} else {
  alert('Speech recognition not supported in this browser.');
}


class LangflowClient {
  constructor(baseURL, apiKey) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
  }
  async post(endpoint, body, headers = { "Content-Type": "application/json" }) {
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    const url = `${this.baseURL}${endpoint}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Request Error:', error);
      throw error;
    }
  }

  async initiateSession(flowId, inputValue, stream = false, tweaks = {}) {
    const endpoint = `/api/v1/run/${flowId}?stream=${stream}`;
    return this.post(endpoint, { input_value: inputValue, tweaks: tweaks });
  }

  handleStream(streamUrl, onUpdate, onClose, onError) {
    const eventSource = new EventSource(streamUrl);

    eventSource.onmessage = event => {
      const data = JSON.parse(event.data);
      onUpdate(data);
    };

    eventSource.onerror = event => {
      console.error('Stream Error:', event);
      onError(event);
      eventSource.close();
    };

    eventSource.addEventListener("close", () => {
      onClose('Stream closed');
      eventSource.close();
    });

    return eventSource;
  }

  async runFlow(flowIdOrName, inputValue, tweaks, stream = false, onUpdate, onClose, onError) {
    try {
      const initResponse = await this.initiateSession(flowIdOrName, inputValue, stream, tweaks);
      console.log('Init Response:', initResponse);
      if (stream && initResponse && initResponse.outputs && initResponse.outputs[0].outputs[0].artifacts.stream_url) {
        const streamUrl = initResponse.outputs[0].outputs[0].artifacts.stream_url;
        console.log(`Streaming from: ${streamUrl}`);
        this.handleStream(streamUrl, onUpdate, onClose, onError);
      }
      return initResponse;
    } catch (error) {
      console.error('Error running flow:', error);
      onError('Error initiating session');
    }
  }
}

async function langflowAiBot(input) {
  const flowIdOrName = 'df194f7f-22d2-4d0c-9015-6e1e83ff88dc';
  const inputValue = input;
  const stream = false;
  const langflowClient = new LangflowClient('http://127.0.0.1:7860',
    'sk-8Xcpbo1_UPcC3GqOiuyQgQFiEgTdbZV7sqMxwaXTuGA');
  const tweaks = {
    "ChatInput-R7wDJ": {},
    "ParseData-4HRrs": {},
    "Prompt-javqM": {},
    "ChatOutput-2EwRr": {},
    "SplitText-QwHoa": {},
    "File-iFlaS": {},
    "AstraVectorStoreComponent-5XaCO": {},
    "OpenAIEmbeddings-c5PNd": {},
    "OpenAIEmbeddings-Nc9m4": {},
    "AstraDB-JNPiR": {},
    "Memory-FMcU2": {},
    "OpenAIModel-WuWsb": {}
  };
  const response = await langflowClient.runFlow(
    flowIdOrName,
    inputValue,
    tweaks,
    stream,
    (data) => console.log("Received:", data.chunk), // onUpdate
    (message) => console.log("Stream Closed:", message), // onClose
    (error) => console.log("Stream Error:", error) // onError
  );
  let output;
  if (!stream) {
    const flowOutputs = response.outputs[0];
    const firstComponentOutputs = flowOutputs.outputs[0];
    output = firstComponentOutputs.outputs.message;

    console.log("Final Output:", output.message.text);
  }
  return output.message.text;
}

// Function to poll the status of video generation
async function pollVideoStatus(videoId, interval = 5000) {
  const url = `https://api.d-id.com/talks/${videoId}`;
  const headers = {
    Authorization: `Basic ${DID_API.key}`,
    'Content-Type': 'application/json',
  };

  return new Promise((resolve, reject) => {
    const checkStatus = async () => {
      try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new Error(`Failed to fetch status: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Video Status:', data.status);

        if (data.status === 'done') {
          resolve(data.result_url);
        } else if (data.status === 'error') {
          reject('Error in video generation.');
        } else {
          setTimeout(checkStatus, interval);
        }
      } catch (error) {
        reject(error.message);
      }
    };

    checkStatus();
  });
}

send.onclick = async (e) => {
  e.preventDefault();  // Prevent the default button action
  await sendMessage(e);  // Call the sendMessage function
};

// Event listener for input text (to also handle Enter key submission)
inputText.addEventListener('keypress', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    await sendMessage(e);
  }
});

async function sendMessage(e) {
  // Add this line to ensure the function doesn't run if the input is empty
  if (!inputText.value.trim()) return;

  addUserMessage(inputText.value);
  addAgentMessage("Thinking...");

  const resp = await langflowAiBot(inputText.value);
  console.log(resp);

  inputText.value = "";

  if (resp) {
    try {
      const payload = {
        script: {
          type: "text",
          input: resp
        },
        source_url: "https://create-images-results.d-id.com/DefaultPresenters/Emma_f/v1_image.jpeg",
        clips: {
          presenter_id: "rian-lZC6MmWfC1",
          driver_id: "mXra4jY38i"
        }
      };

      const response = await fetch('https://api.d-id.com/talks', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${DID_API.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.id) {
          try {
            const resultUrl = await pollVideoStatus(data.id);
            videoElement.src = resultUrl;
            addAgentMessage(resp);
          } catch (error) {
            alert('Error:', error);
          }
        }
      } else {
        alert('Error:', response.statusText);
      }

    } catch (error) {
      alert('Error:', error.message);
    }
  }
}



const destroyButton = document.getElementById('destroy-button');
destroyButton.onclick = () => {
  window.location.href = 'https://nyestatelaw.ai/';
};


let messages = [];

const chatContainer = document.getElementById('chat-container');

// Function to create a message bubble
function createMessageElement(content, type) {
  const messageContainer = document.createElement('div');
  messageContainer.classList.add('message-container', type);

  const messageElement = document.createElement('div');
  messageElement.classList.add('message');
  messageElement.textContent = content;

  messageContainer.appendChild(messageElement);
  return messageContainer;
}

// Function to render messages
function renderMessages() {
  chatContainer.innerHTML = ''; // Clear existing messages
  messages.forEach(({ user, agent }) => {
    const userMessageElement = createMessageElement(user, 'user-message');
    chatContainer.appendChild(userMessageElement);

    const agentMessageElement = createMessageElement(agent, 'agent-message');
    chatContainer.appendChild(agentMessageElement);
  });
  chatContainer.scrollTop = chatContainer.scrollHeight; // Scroll to the latest message
}

// Function to add a new user message
function addUserMessage(userMessage) {
  // Add the user's message first
  messages.push({ user: userMessage, agent: 'Thinking...' });
  renderMessages();
}

// Function to add a new agent response
function addAgentMessage(agentMessage) {
  messages[messages.length - 1].agent = agentMessage;
  renderMessages();
}


// Initial render of messages
renderMessages();
