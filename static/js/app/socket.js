define([
		'app',
		'socketio'
], function(App, SocketIO) {
		var Socket = App.Socket || {};
		var socketpath = location.protocol+'//'+location.hostname+(location.port ? ':'+location.port: '');
		Socket.socket = Socket.socket || SocketIO(socketpath);

		Socket.startGame = function() {
				Socket.socket.emit('start', {});
		};

		Socket.updateScore = function(score) {
				Socket.socket.emit('updateScore', {
						score: score
				});
		};

		Socket.setUser = function(user) {
				Socket.socket.emit('setUser', user);
		};

		return Socket;
});
