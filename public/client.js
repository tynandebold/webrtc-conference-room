(function () {
  // Globals
  var roomNumber;
  var localStream;
  var rtcPeerConnection;
  var isCaller;

  var $roomNumInput = document.getElementById("roomNumber");
  var $localVideo = document.getElementById("localVideo");
  var $warningWrapper = document.getElementById("warningWrapper");
  var iceServers = {
    iceServers: [
      { urls: "stun:stun.services.mozilla.com" },
      { urls: "stun:stun.l.google.com:19302" },
    ],
  };
  var streamConstraints = { audio: true, video: true };

  var socket = io();

  function init() {
    initEventListeners();
  }

  function initEventListeners() {
    document
      .getElementById("goToRoomBtn")
      .addEventListener("click", handleGoToRoom);
  }

  function handleGoToRoom() {
    if ($roomNumInput.value === "") {
      alert("Please type a room number");
    } else {
      roomNumber = $roomNumInput.value;
      socket.emit("create or join", roomNumber);
      document.getElementById("roomSelectionWrapper").style = "display: none;";
      document.getElementById("videosWrapper").style = "display: block;";
      $warningWrapper.style = "display: none;";
    }
  }

  // Socket message handlers
  socket.on("created", function (room) {
    navigator.mediaDevices
      .getUserMedia(streamConstraints)
      .then(function (stream) {
        localStream = stream;
        $localVideo.srcObject = stream;
        isCaller = true;
      })
      .catch(function (err) {
        console.log("An error ocurred when accessing media devices", err);
      });
  });

  socket.on("joined", function (room) {
    navigator.mediaDevices
      .getUserMedia(streamConstraints)
      .then(function (stream) {
        localStream = stream;
        $localVideo.srcObject = stream;
        socket.emit("ready", roomNumber);
      })
      .catch(function (err) {
        console.log("An error ocurred when accessing media devices", err);
      });
  });

  socket.on("candidate", function (event) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: event.label,
      candidate: event.candidate,
    });
    rtcPeerConnection.addIceCandidate(candidate);
  });

  socket.on("ready", function () {
    if (isCaller) {
      rtcPeerConnection = new RTCPeerConnection(iceServers);
      rtcPeerConnection.onicecandidate = onIceCandidate;
      rtcPeerConnection.ontrack = onAddStream;
      rtcPeerConnection.addTrack(localStream.getTracks()[0], localStream);
      rtcPeerConnection.addTrack(localStream.getTracks()[1], localStream);
      rtcPeerConnection
        .createOffer()
        .then((sessionDescription) => {
          rtcPeerConnection.setLocalDescription(sessionDescription);
          socket.emit("offer", {
            type: "offer",
            sdp: sessionDescription,
            room: roomNumber,
          });
        })
        .catch((error) => {
          console.log("The offer couldn't be created. ", error);
        });
    }
  });

  socket.on("offer", function (event) {
    if (!isCaller) {
      rtcPeerConnection = new RTCPeerConnection(iceServers);
      rtcPeerConnection.onicecandidate = onIceCandidate;
      rtcPeerConnection.ontrack = onAddStream;
      rtcPeerConnection.addTrack(localStream.getTracks()[0], localStream);
      rtcPeerConnection.addTrack(localStream.getTracks()[1], localStream);
      rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
      rtcPeerConnection
        .createAnswer()
        .then((sessionDescription) => {
          rtcPeerConnection.setLocalDescription(sessionDescription);
          socket.emit("answer", {
            type: "answer",
            sdp: sessionDescription,
            room: roomNumber,
          });
        })
        .catch((error) => {
          console.log("The answer failed. ", error);
        });
    }
  });

  socket.on("answer", function (event) {
    rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
  });

  // Handler functions
  function onIceCandidate(event) {
    if (event.candidate) {
      console.log("Sending ICE candidate.");

      socket.emit("candidate", {
        type: "candidate",
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate,
        room: roomNumber,
      });
    }
  }

  function onAddStream(event) {
    document.getElementById("remoteVideo").srcObject = event.streams[0];
  }

  init();
})();
