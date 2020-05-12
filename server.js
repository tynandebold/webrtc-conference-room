var express = require("express");
var app = express();

var http = require("http").Server(app);
var io = require("socket.io")(http);

var port = process.env.PORT || 3000;

// Serve static files from the public directory
app.use(express.static("public"));

// Signaling
io.on("connection", function (socket) {
  console.log("A user connected.");

  socket.on("create or join", function (room) {
    console.log(`Create or join to room ${room}.`);

    var myRoom = io.sockets.adapter.rooms[room] || { length: 0 };
    var numClients = myRoom.length;

    console.log(`${room} has ${numClients} clients.`);

    if (numClients == 0) {
      socket.join(room);
      socket.emit("created", room);
    } else if (numClients == 1) {
      socket.join(room);
      socket.emit("joined", room);
    } else {
      socket.emit("full", room);
      socket.broadcast.to(room).emit("full");
    }
  });

  socket.on("ready", function (room) {
    socket.broadcast.to(room).emit("ready");
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
});

http.listen(port || 3000, function () {
  console.log(`Listening on http://localhost:${port}`);
});
