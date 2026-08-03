// const mqtt = require('./mqtt/');
let mqttClient = null;
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const messageArea = document.getElementById("message-textarea");
const addIceBtn = document.getElementById("add-ice");
const loginBtn = document.getElementById("login-btn");
const connectionBtn = document.getElementById("connection-button");
const peerNameInput = document.getElementById("peer-username");
const passwordInput = document.getElementById("password-input");
const usernameInput = document.getElementById("username-input");
const config = {
  iceServers: [
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};
let Username = "";
let isLoggedin = false;
let isConnected = false;
let peerName = "";
messageArea.value = "";
connectionBtn.addEventListener("click", () => {
  if (!isConnected) {
    startConnection();
  } else {
    pc.close();
    console.log("disconecting..");
  }
});

sendBtn.addEventListener("click", (e) => {
  const messageContent = messageInput.value;
  messageInput.value = "";
  dataChannel.send(messageContent);
  messageArea.value += Username + ":" + messageContent + '\n';
  // console.log("sending messgae: " + messageContent);
})

loginBtn.addEventListener("click", () => {
  if (!isLoggedin) {
    const password = passwordInput.value;
    const username = usernameInput.value;
    init(username, password);
    Username = username;
  } else {
    passwordInput.value = "";
    usernameInput.value = "";
    mqttClient.end();
    isLoggedin = false;
    loginBtn.textContent = "login";
  }
});

let pc;
let dataChannel;

function onTrack(e) {
  console.log("got track...");
  console.log(e.streams[0]);
}

function init(username, password) {
  // Setup Mqtt (for signaling)
  const options = {
    protocol: 'mqtt',
    host: 'c9c5c8b2dfc14dde8b42bc2d3d1d1ce0.s1.eu.hivemq.cloud',
    port: 8884,
    username: username,
    password: password,
  };
  if (mqttClient) mqttClient.end();
  mqttClient = mqtt.connect(
    'wss://c9c5c8b2dfc14dde8b42bc2d3d1d1ce0.s1.eu.hivemq.cloud:8884/mqtt',
    {
      username: username,
      password: password,
    }
  );
  mqttClient.subscribe('webrtc');
  // mqttClient.publish('webrtc', 'from javascript');
  mqttClient.on('message', function(topic, message) {
    // console.log(message.toString());
    handleMqttMessage(message.toString());
  });
  mqttClient.on('connect', function() {
    isLoggedin = true;
    loginBtn.textContent = "logout";
  })

  // Set RTCPeerConnection
  pc = new RTCPeerConnection(config);
  pc.onicecandidate = onCandidate;
  pc.addEventListener("connectionstatechange", setOnlineStatus);
  // dataChannel
  pc.ondatachannel = (event) => {
    dataChannel = event.channel;
    dataChannel.onopen = onDatachannelOpen;
    dataChannel.onmessage = function(event) {
      onMessageReceive(event.data);
      console.log("GOT MESSAGE: " + event.data);
    };
  };
}
function handleMqttMessage(message) {
  let objectMessage;
  try {
    objectMessage = JSON.parse(message);
  } catch (err) {
    console.log(err);
    return;
  }
  if (objectMessage.username == Username) {
    console.log("redundant message...");
    return
  };
  switch (objectMessage.type) {
    case "offer":
      console.log("Offer received from: " + objectMessage.username);
      peerName = objectMessage.username;
      acceptOffer(objectMessage.offer);
      break;
    case "candidate":
      console.log("new candidate received from: " + objectMessage.username);
      try {
        const candidate = new RTCIceCandidate(objectMessage.candidate);
        pc.addIceCandidate(candidate).then(() => {
          console.log("Successfully added ICE candidate");
        }).catch(e => console.log("Error adding ICE: ", e));
      } catch (err) {
        console.log(err);
      }
      break;
    case "answer":
      console.log("answer received from: " + objectMessage.username);
      acceptAnswer(objectMessage.answer);
      break;
    default:
      break;
  }
}

function onCandidate(event) {
  const message = { username: Username, type: "candidate", candidate: event.candidate };
  mqttClient.publish('webrtc', JSON.stringify((message)));
}
async function startConnection() {
  try {
    peerName = peerNameInput.value;
    if (peerName == "") return;
    dataChannel = pc.createDataChannel("dataChannel");
    dataChannel.onopen = onDatachannelOpen;
    dataChannel.onmessage = function(event) {
      onMessageReceive(event.data);
      console.log("GOT MESSAGE: " + event.data);
    };

    messageArea.value = "";

    await pc.setLocalDescription();
    const messageOffer = JSON.stringify({ username: Username, type: "offer", offer: pc.localDescription });
    mqttClient.publish('webrtc', messageOffer);
  } catch (err) {
    console.log(err);
  }
}
async function acceptOffer(offer) {
  try {
    pc.setRemoteDescription(new RTCSessionDescription(offer));
    // send answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    const answerMessage = JSON.stringify({ username: Username, type: "answer", answer: answer });
    mqttClient.publish("webrtc", answerMessage);
  } catch (err) {
    console.log(err);
  }
}
function acceptAnswer(answer) {
  pc.setRemoteDescription(new RTCSessionDescription(answer));
}

function onMessageReceive(message) {
  messageArea.value += peerName + ":" + message + '\n';
}

function onDatachannelOpen() {
  console.log("DATA CHANNEL OPEN!");
  peerNameInput.value = peerName;
}
function setOnlineStatus(status) {
  switch (pc.connectionState) {
    case "new":
    case "connecting":
      console.log("Connecting…");
      break;
    case "connected":
      isConnected = true;
      connectionBtn.textContent = "disconnect";
      console.log("Online");
      break;
    case "disconnected":
      console.log("Disconnecting…");
      break;
    case "closed":
      console.log("Offline");
      break;
    case "failed":
      console.log("Error");
      break;
    default:
      console.log("Unknown");
      break;
  }
}
