var express = require('express')
  , http = require('http');

var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);


// Vars (better way to organize all this)
var users = {}
var id_counter = 0;
var update_speed = 100; //100 ms

// Server's state stuff (flags n shit)
var state = {
  running: false, 
  time_started: 0
};

// State that the user needs to know about (ie. for the game)
var game_state = {
  time: 0,
  current_song: 'Gungam'
};



// Work with our socket connection:
io.sockets.on('connection', function (socket) {

  socket.on('start', function(data) { // Start game loop
    if (!state.running) {
      state.time_started = new Date().getTime();
      state.running = true;
      state.time_started

      setInterval(function(){game_loop(socket)}, update_speed);     
    }
  });

});

game_loop = function(socket){
  game_state.time = new Date().getTime() - state.time_started;

  socket.emit('sync', game_state);
};


// Route our basic page
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

server.listen(8080);
