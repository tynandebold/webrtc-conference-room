var express = require("express");
var app = express();

var http = require("http").Server(app);
var io = require("socket.io")(http);

var port = process.env.PORT || 3000;

// Serve static files from the public directory
app.use(express.static("public"));

// Signaling
io.on("connection", function (socket) {
  var currentRoomId;
  console.log("A user connected.");

  socket.on("create or join", function (roomId) {
    currentRoomId = roomId;
    console.log(`Create or join to room with id: ${roomId}.`);

    var myRoom = io.sockets.adapter.rooms[roomId] || { length: 0 };
    var numClients = myRoom.length;

    console.log(`Room ${roomId} has ${numClients} clients.`);

    if (numClients === 0) {
      socket.join(roomId);
      socket.emit("created", roomId);
    } else if (numClients === 1) {
      socket.join(roomId);
      socket.emit("joined", roomId);
    } else {
      socket.emit("full", roomId);
      socket.broadcast.to(roomId).emit("full");

      console.log(`Room ${roomId} is full.`);
    }
  });

  socket.on("ready", function (roomId) {
    socket.broadcast.to(roomId).emit("ready");
  });

  socket.on("candidate", function (event) {
    socket.broadcast.to(event.room).emit("candidate", event);
  });

  socket.on("offer", function (event) {
    socket.broadcast.to(event.room).emit("offer", event.sdp);
  });

  socket.on("answer", function (event) {
    socket.broadcast.to(event.room).emit("answer", event.sdp);
  });

  socket.on("disconnect", function () {
    console.log(
      currentRoomId
        ? `${socket.id} in room ${currentRoomId} is now disconnected.`
        : `${socket.id} is now disconnected.`
    );
  });
});

http.listen(port || 3000, function () {
  console.log(`Listening on http://localhost:${port}`);
});
