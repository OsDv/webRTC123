// const mqtt = require('./mqtt/');
let mqttClient;
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const messageArea = document.getElementById("message-textarea");
const offerArea = document.getElementById("offer-area");
const createOfferBtn = document.getElementById("create-offer");
const receiveOfferBtn = document.getElementById("receive-offer");
const responseArea = document.getElementById("response-area");
const createresponseBtn = document.getElementById("create-response");
const receiveresponseBtn = document.getElementById("receive-response");
const iceArea = document.getElementById("ice-area");
const addIceBtn = document.getElementById("add-ice");
const startConnectionBtn = document.getElementById("start-connection-button");

let username;

responseArea.value = "";
offerArea.value = "";
iceArea.value = "";
startConnectionBtn.addEventListener("click", startConnection);
const config = {
  iceServers: [
    { urls: "stun:stun1.l.google.com:19302" }
  ]
}; // Send message function
sendBtn.addEventListener("click", (e) => {
  const messageContent = messageInput.value;
  messageInput.value = "";
  dataChannel.send(messageContent);
  console.log("sending messgae: " + messageContent);
})
addIceBtn.addEventListener("click", () => {
  const candidate = new RTCIceCandidate(JSON.parse(iceArea.value));
  pc.addIceCandidate(candidate).then(() => {
    console.log("Successfully added ICE candidate");
  }).catch(e => console.log("Error adding ICE: ", e));
  iceArea.value = ""; // clear after adding;
})


let pc;
let dataChannel;
function onCandidate(e) {
  if (e.candidate != null) {
    console.log(JSON.stringify(e.candidate));
  }
}
function onTrack(e) {
  console.log("got track...");
  console.log(e.streams[0]);
}

function init() {
  const options = {
    protocol: 'mqtt',
    host: 'c9c5c8b2dfc14dde8b42bc2d3d1d1ce0.s1.eu.hivemq.cloud',
    port: 8884,
    username: 'webrtc',
    password: 'webrtc123'
  };
  mqttClient = mqtt.connect(
    'wss://c9c5c8b2dfc14dde8b42bc2d3d1d1ce0.s1.eu.hivemq.cloud:8884/mqtt',
    {
      username: 'webrtc',
      password: 'webrtc123'
    }
  );
  mqttClient.subscribe('webrtc');
  mqttClient.publish('webrtc', 'from javascript');
  mqttClient.on('message', function(topic, message) {
    console.log(message.toString());
    handleMqttMessage(message.toString());
  })
}
function handleMqttMessage(message) {
  let objectMessage;
  try {
    objectMessage = JSON.parse(message);
  } catch (err) {
    console.log(err);
    return;
  }
  if (objectMessage.username == username) {
    console.log("redundant message...");
    return
  };
  switch (objectMessage.type) {
    case "offer":
      console.log("Offer received");
      acceptOffer(objectMessage.offer);
      break;
    case "candidate":
      console.log("new candidate received");
      const candidate = new RTCIceCandidate(objectMessage.candidate);
      pc.addIceCandidate(candidate).then(() => {
        console.log("Successfully added ICE candidate");
      }).catch(e => console.log("Error adding ICE: ", e));
      break;
    case "answer":
      console.log("answer received");
      acceptAnswer(objectMessage.answer);
      break;
    default:
      break;
  }
}
init();
function onCandidate1(event) {
  const message = { username: username, type: "candidate", candidate: event.candidate };
  mqttClient.publish('webrtc', JSON.stringify((message)));
}
async function startConnection() {
  try {
    pc = new RTCPeerConnection(config);
    pc.onicecandidate = onCandidate1;
    dataChannel = pc.createDataChannel("dataChannel");
    dataChannel.onopen = () => console.log("DATA CHANNEL OPEN!");
    dataChannel.onmessage = function(event) {
      console.log("GOT MESSAGE: " + event.data);
    };

    await pc.setLocalDescription();
    const messageOffer = JSON.stringify({ username: username, type: "offer", offer: pc.localDescription });
    mqttClient.publish('webrtc', messageOffer);
  } catch (err) {
    console.log(err);
  }
}
async function acceptOffer(offer) {
  try {
    pc = new RTCPeerConnection(config);
    pc.onicecandidate = onCandidate1;

    pc.ondatachannel = (event) => {
      dataChannel = event.channel;
      dataChannel.onopen = () => console.log("DATA CHANNEL OPEN!");
      dataChannel.onmessage = function(event) {
        console.log("GOT MESSAGE: " + event.data);
      };
    };

    pc.setRemoteDescription(new RTCSessionDescription(offer));
    // send answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    const answerMessage = JSON.stringify({ username: username, type: "answer", answer: answer });
    mqttClient.publish("webrtc", answerMessage);

  } catch (err) {
    console.log(err);
  }
}
function acceptAnswer(answer) {
  pc.setRemoteDescription(new RTCSessionDescription(answer));
}

async function createOffer() {
  try {
    pc = new RTCPeerConnection(config);
    pc.onicecandidate = onCandidate;
    pc.onTrack = onTrack;

    dataChannel = pc.createDataChannel("dataChannel");
    // pc.onicecandidate = (e) =>
    //   !e.candidate ||
    //   pc.addIceCandidate(e.candidate).catch(console.log(e.candidate));
    // const offer = await pc.createOffer();
    await pc.setLocalDescription();

    // pc.onicegatheringstatechange = () => {
    //   if (pc.iceGatheringState === "complete") {
    //     offerArea.value = JSON.stringify(pc.localDescription);
    //     console.log("Offer ready to copy!");
    //   }
    // };


    const stringOffer = JSON.stringify(pc.localDescription);
    offerArea.value = stringOffer;
    // console.log(stringOffer);
    console.log(pc);
  } catch (err) {
    console.log(err);
  }
}
function readOffer() {
  pc = new RTCPeerConnection(config);
  pc.onicecandidate = onCandidate;
  pc.onTrack = onTrack;
  // pc.onicecandidate = (e) => {
  //   !e.candidate ||
  //     pc.addIceCandidate(e.candidate).catch(console.log("error"));
  //   console.log(e.candidate);
  // }

  // dataChannel = pc.createDataChannel("dataChannel");
  pc.ondatachannel = (event) => {
    dataChannel = event.channel;
    dataChannel.onopen = () => console.log("DATA CHANNEL OPEN ON TAB 2!");
    dataChannel.onmessage = function(event) {
      console.log("GOT MESSAGE: " + event.data);
    };
  };

  const offer = JSON.parse(offerArea.value);
  pc.setRemoteDescription(new RTCSessionDescription(offer));

  console.log(pc);
}
async function createAnswer() {
  try {
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);


    // pc.onicegatheringstatechange = () => {
    //   if (pc.iceGatheringState === "complete") {
    //     responseArea.value = JSON.stringify(pc.localDescription);
    //     console.log("Answer ready to copy!");
    //   }
    // };
    //

    const stringAnswer = JSON.stringify(answer);
    responseArea.value = stringAnswer;
    // console.log(stringOffer);
    //
    console.log(pc);
  } catch (err) {
    console.log(err);
  }
}
function readAnswer() {
  const answer = JSON.parse(responseArea.value);
  pc.setRemoteDescription(new RTCSessionDescription(answer));

  console.log(pc);
}
createOfferBtn.addEventListener("click", () => {
  createOffer();
});
createresponseBtn.addEventListener("click", () => {
  createAnswer();
});
receiveOfferBtn.addEventListener("click", () => {
  readOffer();
});
receiveresponseBtn.addEventListener("click", () => {
  readAnswer();
});
