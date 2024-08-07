const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startButton = document.getElementById('startButton');
const hangupButton = document.getElementById('hangupButton');

let localStream;
let remoteStream;
let peerConnection;

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

startButton.addEventListener('click', startCall);
hangupButton.addEventListener('click', hangUp);

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

const signalingServerUrl = 'ws://localhost:8080';
const signalingSocket = new WebSocket(signalingServerUrl);

signalingSocket.onmessage = message => {
    const data = JSON.parse(message.data);
    handleSignal(data);
};

function sendSignal(data) {
    signalingSocket.send(JSON.stringify(data));
}
