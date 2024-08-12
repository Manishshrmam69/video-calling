const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startButton = document.getElementById('startButton');
const hangupButton = document.getElementById('hangupButton');
const joinRoomButton = document.getElementById('joinRoomButton');
const roomIdInput = document.getElementById('roomIdInput');
const generatedRoomId = document.getElementById('generatedRoomId');

let localStream;
let remoteStream;
let peerConnection;
let roomId;

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

// Generate a unique room ID
function generateRoomId() {
    return Math.random().toString(36).substr(2, 9);
}

// Display the room ID
function displayRoomId(id) {
    generatedRoomId.textContent = `Your Room ID: ${id}`;
}

// Start a new room
function startNewRoom() {
    roomId = generateRoomId();
    displayRoomId(roomId);
    connectToSignalingServer(roomId);
}

// Join an existing room
function joinRoom() {
    roomId = roomIdInput.value;
    if (roomId) {
        connectToSignalingServer(roomId);
    } else {
        alert('Please enter a room ID.');
    }
}

function connectToSignalingServer(roomId) {
    signalingSocket = new WebSocket(`ws://localhost:8080?roomId=${roomId}`);

    signalingSocket.onmessage = message => {
        const data = JSON.parse(message.data);
        handleSignal(data);
    };
}

startButton.addEventListener('click', startCall);
hangupButton.addEventListener('click', hangUp);
joinRoomButton.addEventListener('click', joinRoom);

async function startCall() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        peerConnection = new RTCPeerConnection(configuration);
        peerConnection.addEventListener('icecandidate', handleIceCandidate);
        peerConnection.addEventListener('track', handleRemoteStream);

        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        sendSignal({ type: 'offer', sdp: offer.sdp });
    } catch (error) {
        console.error('Error accessing media devices.', error);
        alert('Could not access your camera or microphone. Please make sure they are connected and try again.');
    }
}

function handleIceCandidate(event) {
    if (event.candidate) {
        sendSignal({ type: 'candidate', candidate: event.candidate });
    }
}

function handleRemoteStream(event) {
    if (!remoteStream) {
        remoteStream = new MediaStream();
        remoteVideo.srcObject = remoteStream;
    }
    remoteStream.addTrack(event.track);
}

async function handleSignal(data) {
    if (data.type === 'offer') {
        if (!peerConnection) {
            startCall();  // Start call if peer connection doesn't exist
        }
        await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        sendSignal({ type: 'answer', sdp: answer.sdp });
    } else if (data.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
    } else if (data.type === 'candidate') {
        const candidate = new RTCIceCandidate(data.candidate);
        await peerConnection.addIceCandidate(candidate);
    }
}

function hangUp() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localVideo.srcObject = null;
        remoteVideo.srcObject = null;
        localStream = null;
    }
}

function sendSignal(data) {
    signalingSocket.send(JSON.stringify(data));
}

let signalingSocket;

// Start a new room when the page loads
startNewRoom();
