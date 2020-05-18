(function () {
  // Globals
  var roomId;
  var localStream;
  var rtcPeerConnection;
  var isCaller;

  var $roomIdInput = document.getElementById("room-id");
  var $localVideo = document.getElementById("local-video");
  var iceServers = {
    iceServers: [
      { urls: "stun:stun.services.mozilla.com" },
      { urls: "stun:stun.l.google.com:19302" },
    ],
  };
  var streamConstraints = { audio: true, video: true };

  var socket = io({ transports: ["websocket"], upgrade: false });

  function init() {
    initEventListeners();
  }

  function initEventListeners() {
    document
      .getElementById("go-to-room-btn")
      .addEventListener("click", handleGoToRoom);

    document.getElementById("hang-up").addEventListener("click", handleHangUp);
  }

  // Socket message handlers
  socket.on("created", function (room) {
    navigator.mediaDevices
      .getUserMedia(streamConstraints)
      .then(function (stream) {
        localStream = stream;
        $localVideo.srcObject = stream;
        isCaller = true;
        removeError();
        addChatroomId(room);
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
        socket.emit("ready", roomId);
        removeError();
        addChatroomId(room);
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
      initSharedPeerConnectionMethods();
      rtcPeerConnection
        .createOffer()
        .then((sessionDescription) => {
          rtcPeerConnection.setLocalDescription(sessionDescription);
          socket.emit("offer", {
            type: "offer",
            sdp: sessionDescription,
            room: roomId,
          });
        })
        .catch((error) => {
          console.log("The offer couldn't be created. ", error);
        });
    }
  });

  socket.on("offer", function (event) {
    if (!isCaller) {
      initSharedPeerConnectionMethods();
      rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
      rtcPeerConnection
        .createAnswer()
        .then((sessionDescription) => {
          rtcPeerConnection.setLocalDescription(sessionDescription);
          socket.emit("answer", {
            type: "answer",
            sdp: sessionDescription,
            room: roomId,
          });
        })
        .catch((error) => {
          console.log("The answer failed. ", error);
        });
    }
  });

  socket.on("answer", function (event) {
    rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
    console.log("rtcPeerConnection answer: ", rtcPeerConnection);
  });

  socket.on("full", function (room) {
    document.body.classList.remove("on-a-call");
    document.body.classList.add("error");
  });

  socket.on("disconnect", function () {
    document.getElementById("chat-id").innerText = "";
    var remoteVideo = document.getElementById("remote-video");
    var localVideo = document.getElementById("local-video");

    if (rtcPeerConnection) {
      rtcPeerConnection.ontrack = null;
      rtcPeerConnection.onremovetrack = null;
      rtcPeerConnection.onremovestream = null;
      rtcPeerConnection.onicecandidate = null;
      rtcPeerConnection.oniceconnectionstatechange = null;
      rtcPeerConnection.onsignalingstatechange = null;
      rtcPeerConnection.onicegatheringstatechange = null;
      rtcPeerConnection.onnegotiationneeded = null;

      if (localVideo.srcObject) {
        localVideo.pause();
        localVideo.srcObject.getTracks().forEach((track) => track.stop());
      }

      if (remoteVideo.srcObject) {
        remoteVideo.pause();
        remoteVideo.srcObject.getTracks().forEach((track) => track.stop());
      }

      rtcPeerConnection.close();
      rtcPeerConnection = null;
    }

    // stop the track here, too, in case the caller enters a room then hangs up
    if (localVideo.srcObject) {
      localVideo.pause();
      localVideo.srcObject.getTracks().forEach((track) => track.stop());
    }

    remoteVideo.removeAttribute("src");
    remoteVideo.removeAttribute("srcObject");
    localVideo.removeAttribute("src");
    remoteVideo.removeAttribute("srcObject");

    document.getElementById("room-id").value = "";
    document.body.classList.remove("on-a-call");
  });

  // Handler functions
  function initSharedPeerConnectionMethods() {
    rtcPeerConnection = new RTCPeerConnection(iceServers);
    rtcPeerConnection.onicecandidate = onIceCandidate;
    rtcPeerConnection.oniceconnectionstatechange = handleICEConnectionStateChangeEvent;
    rtcPeerConnection.onsignalingstatechange = handleSignalingStateChangeEvent;
    rtcPeerConnection.ontrack = onAddStream;
    rtcPeerConnection.addTrack(localStream.getTracks()[0], localStream);
    rtcPeerConnection.addTrack(localStream.getTracks()[1], localStream);
  }

  function onIceCandidate(event) {
    if (event.candidate) {
      console.log("Sending ICE candidate.");

      socket.emit("candidate", {
        type: "candidate",
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate,
        room: roomId,
      });
    }
  }

  function handleICEConnectionStateChangeEvent() {
    console.log(
      "ICE connection state changed to " + rtcPeerConnection.iceConnectionState
    );

    switch (rtcPeerConnection.iceConnectionState) {
      case "closed":
      case "failed":
      case "disconnected":
        handleHangUp();
        break;
    }
  }

  function handleSignalingStateChangeEvent() {
    console.log(
      "WebRTC signaling state changed to: " + rtcPeerConnection.signalingState
    );

    switch (rtcPeerConnection.signalingState) {
      case "closed":
        handleHangUp();
        break;
    }
  }

  function onAddStream(event) {
    document.getElementById("remote-video").srcObject = event.streams[0];
  }

  function handleGoToRoom() {
    if ($roomIdInput.value === "") {
      alert("Please type a room ID.");
    } else {
      roomId = $roomIdInput.value;
      socket.emit("create or join", roomId);

      document.body.classList.add("on-a-call");
    }
  }

  function handleHangUp() {
    socket.emit("disconnect");
  }

  function removeError() {
    document.body.classList.remove("error");
  }

  function addChatroomId(room) {
    document.getElementById("chat-id").innerText = room;
  }

  init();
})();
