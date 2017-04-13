var express = require('express');
var compression = require('compression');
var sass = require('node-sass-middleware');
var logger = require('morgan');
var path = require('path');
var expressValidator = require('express-validator');
var bodyParser = require('body-parser');
var errorHandler = require('errorhandler');
var Moniker = require('moniker');

/**
 * Create Express server.
 */
var app = express();
var server = require('http').createServer(app); 
var socketIo = require('socket.io')(server);

/**
 * Express configuration.
 */
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(compression());
app.use(sass({
  src: path.join(__dirname, 'public'),
  dest: path.join(__dirname, 'public')
}));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressValidator());

app.use('/static', express.static(path.join(__dirname, 'static'), { maxAge: 0 }));


// Vars (better way to organize all this)
var id_counter = 0;
var fps = 2;
var update_speed = 1000 / fps;

// Server's state stuff (flags n shit)
var state = {
		running: false,
		time_started: 0
};

// State that the user needs to know about (ie. for the game)
var game_state = {
		time: 0,
		song: 'Gungam Style',
		users: {
		}
};

// io.sockets references all sockets
socketIo.sockets.on('connection', function (socket) {

		socket.on('disconnect', function() {
			console.log("Disconnection from %s", socket.id);
			delete game_state.users[socket.id];
		});

		// socket is only the newly connected socket
		socket.on('start', function(data) { // Start game loop when someone hits it
				if (!state.running) {
						state.time_started = new Date().getTime();
						state.running = true;

						var interv = setInterval(function(){game_loop(socket);}, update_speed);
						setTimeout(function(){
							console.log("End Game");
							clearInterval(interv);
							reset_all();
							socketIo.sockets.emit('endGame');
						}, 10*1000);
				}
				//return the game time
				socket.emit('startGame', {
						time: new Date().getTime() - state.time_started
				});
		});
		

		socket.on('move', function(data) {
				var user = game_state.users[socket.id];
		});

		socket.on('updateScore', function(data) {
				var user = game_state.users[socket.id];
				user.score = data.score;
		});

		// used for time synchronization
		socket.on('ping', function(data){
			socket.emit('ping');
		});
		
		console.log("Connection from %s", socket.id);
		init_player(socket.id);
		socket.emit('info',{'name':game_state.users[socket.id].name, 'started':state.running});

});

game_loop = function(socket) {
		game_state.time = new Date().getTime() - state.time_started;

		var ret_state = {};
		var users = [];
		for (var key in game_state.users) {
				users.push(game_state.users[key]);
		}
		users.sort(function(a, b) { return b.score - a.score; });
		ret_state.users = users;
		socketIo.sockets.emit('sync', ret_state);
};

init_player = function(id) {
	var rname = Moniker.choose();
	console.log("Init player %s", rname);
		game_state.users[id] = {
				score: 0,
				name: rname
		};
};

reset_all = function()
{
	state.running = false;
	state.time_started = 0;
	game_state.time = 0;
	for (var key in game_state.users) {
			game_state.users[key].score = 0;
	}
}

// Route our basic page
app.get('/dance', function (req, res) {
	var game_type = req.query['game_type'];
	console.log("Game type", game_type);
	res.render('dance', {
			game_type: game_type
	});
});

app.get('/', function(req, res, params) {
		res.render('home');
});

/**
 * Error Handler.
 */
app.use(errorHandler());

/**
 * Start Express server.
 */
server.listen(app.get('port'), function(){
  console.log('App is running at http://localhost:%d in %s mode', app.get('port'), app.get('env')); 
  console.log('Press CTRL-C to stop\n');
});

module.exports = app;
