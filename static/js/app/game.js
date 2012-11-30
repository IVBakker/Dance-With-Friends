define([
  'jquery',
  'underscore',
  'backbone',
  'app',
  'arrow',
  'songMeta',
  'userMeta',
  'socket',
  'bufferloader',
  'soundmanager2',
], function($, _, Backbone, App, Arrow, SongMeta, UserMeta, Socket) {
    var Game = App.Game || {};

    Game.Model = Backbone.Model.extend({
        defaults: {
            startTime: undefined,
            currentTime: undefined,
            players: {}, //id to player state
            gameType: 'hands', // 'feet'
            arrows: {},
            gameFPS: 30,
            velocity: .1,
            timeToTop: 5000,
            bufferZoneTime: 3000,
            currentSong: SongMeta['Gangam Style'],
            songIndex: 0 // The current index in the song stamp list
        },
        getTimeOffset: function() {
            return new Date().getTime() - this.get('startTime') - this.get('delay');
        },
    });

    Game.ExclamationModel = Backbone.Model.extend({
        defaults: {
            score: undefined
        },
    });

    Game.loading_start = function(text) {
        var text = $('<div class="description">' + text + '</div>');
        $('#loading').html('<img src="/static/img/ajax-loader.gif"></img>');
        $('#loading').append(text);
    }

    Game.loading_end = function() {
        $('#loading').html('');
    }

    Game.scoreToWord = function(score) {
        if (!score) {
            return;
        }
        var word;
        if (score == 4) {
            word = 'perfect';
        }
        else if (score == 3) {
            word = 'great'
        } else if (score == 2) {
            word = 'good'
        } else if (score == 1) {
            word = 'bad'
        }
        return word;
    };

    Game.ExclamationView = Backbone.View.extend({
        el: $('#exclamation'),
        initialize: function() {
            this.model.on('change', this.render, this);
            this.render();
        },
        render: function() {
            var score = this.model.get('score');
            var streak = this.model.get('streak');
            var streakTest = "";
            if (streak > 2){
                streakTest = " " + streak + "X";
            }
            var word = Game.scoreToWord(score);
            if (word) {
                this.$el.removeClass();
                var div = $('<div class="text">' + word + streakTest + '!</div>');
                this.$el.html(div);
                setInterval(function() {
                    if (div.length)
                        div.addClass('fade');
                }, 500);
                this.$el.addClass(word);
            }
        },
    });

    Game.View = Backbone.View.extend({
        el: $('#game-container'),
        initialize: function(options) {
            this.interval = setInterval($.proxy(this.runGameLoop, this), 1000 / this.model.get('gameFPS'));
            $(document).on('keydown', $.proxy(this.detectMove, this))
            this.arrows = [];

            $(window).resize($.proxy(function() {
                this.model.set('gameHeight', $(this.el).height());
                this.model.set('gameWidth', $(this.el).width());
                this.model.set('timeToTop', this.model.get('gameHeight')/this.model.get('velocity'));
                this.model.set('bufferZoneTime', this.model.get('gameHeight')/this.model.get('velocity'));
            }, this));
            $(window).resize();

            this.exclamation = new Game.ExclamationModel();
            new Game.ExclamationView({
                model: this.exclamation
            });

            soundManager.createSound({
                 id:'gangamstyle',
                 url:'../static/songs/gangamstyle.mp3'
            });
            soundManager.setPosition('gangamstyle',this.model.getTimeOffset());
            soundManager.play('gangamstyle');

            // If we're using feet, position markers:
            if (this.model.get('gameType')){
                $('#arrow0').css('left', this.model.get('gameWidth') * .22 - $('#arrow0').width()/2)
                $('#arrow1').css('left', this.model.get('gameWidth') * .498 - $('#arrow1').width()/2)
                $('#arrow2').css('left', this.model.get('gameWidth') * .775 - $('#arrow2').width()/2)
                $('#arrow0').css('top', this.model.get('gameHeight') * .697 - $('#arrow0').height()/2)
                $('#arrow1').css('top', this.model.get('gameHeight') * .906 - $('#arrow1').height()/2)
                $('#arrow2').css('top', this.model.get('gameHeight') * .697 - $('#arrow2').height()/2)
            } else {
                $('#arrow0').hide();
                $('#arrow1').hide();
                $('#arrow2').hide();
            }

            this.streaks = [0, 0, 0, 0, 0];
        },
        detectMove: function(e) {
            var hit_box = '';
            if (e.which == 72) { //h
                hit_box = 'left';
            } else if (e.which == 74) { //j
                hit_box = 'down';
            } else if (e.which == 75) { //k
            } else if (e.which == 76) { //l
                hit_box = 'right';
            }

            this.processMove(hit_box, this.model.get('currentTime'));


        },
        processMove: function(move_string, currentTime) {
            move = move_string.charAt(0);
            if (move) {
                this.showMove(move, currentTime);
                _.each(this.arrows, function(arrow) {
                    if (move == arrow.model.get('direction')) {
                        //TODO: check if timestamp is based off the right vars
                        var timeDiff = Math.abs(arrow.model.get('finalTimestamp') - currentTime);

                        var score = this.scoreMove(timeDiff);
                        if (score > 0) {
                            this.updateScore(score, arrow, true);
                        }


                    }
                }, this);
            }

            var el = $('#'+move_string+'-spot-arrow');
            el.addClass(move_string+'-hit');
            var intervalPointer;
            intervalPointer = setInterval(function() {
                el.removeClass(move_string+'-hit');
                clearInterval(intervalPointer);
            }, 200);
        },
        showMove: function(move, currentTime) {
            Socket.doMove(move, currentTime + this.model.get('delay'));
        },
        scoreMove: function(timeDiff) {
            //time diff is in milliseconds
            /*
             * returns a score from 0->4
             * 0: ignore move
             * 1: bad
             * 2: good
             * 3: awesome
             * 4: perfect
             * */

            if (timeDiff < 50) {
                return 4;
            } else if (timeDiff < 100) {
                return 3;
            } else if (timeDiff < 200) {
                return 2;
            } else if (timeDiff < 300) {
                return 1;
            } else {
                return 0;
            }
        },
        updateStreak: function(score) {
            var bonus = 0;
            if(score > 1){
                for(var i = 0; i < 5; i++){
                    if(score == i){
                        this.streaks[i] += 1;
                        if(this.streaks[i] >= 3){
                            bonus = (1 << (i - 2)) * 250;
                        }
                    } else {
                        this.streaks[i] = 0;
                    }
                }
            }
            return bonus;
        },
        updateScore: function(score, arrow, shouldGlow) {
            var bonus = this.updateStreak(score);
            this.exclamation.set({
                score: score,
                streak: this.streaks[score],
                cb: new Date().getTime()
            });
            App.user.set('score', App.user.get('score') + score * 1000 + bonus);
            var scoreWord = Game.scoreToWord(score);
            App.user.set(scoreWord, App.user.get(scoreWord) + 1);
            if (shouldGlow)
                arrow.glow();
        },
        removeArrows: function(forRemoval) {
            _.each(forRemoval, function(arrow) {
                this.updateScore(1, arrow, true);
                delete this.arrows[_.indexOf(this.arrows, arrow)];
            }, this);
        },
        updateArrows: function(currentTime) {
            var forRemoval = [];
             _.each(this.arrows, function(arrow) {
                arrow.updatePosition(currentTime);
                var pos = arrow.model.get('pos');
                if (pos < -500 ) {
                    arrow.destroy();
                    forRemoval.push(arrow);
                }

            }, this);
            this.removeArrows(forRemoval);


        },
        addNewArrows: function(currentTime) {
            // Add arrows within the timestamp buffer
            var stop = false;
            var currentSong = this.model.get('currentSong');
            while(!stop) {
                var songIndex = this.model.get('songIndex');
                if (songIndex >= currentSong.length)
                    break;
                // If the timestamp for the arrow puts it on our screen
                if (currentSong[songIndex].timestamp <
                        this.model.get('timeToTop')
                         + this.model.get('bufferZoneTime')
                         + currentTime) {
                    this.arrows.push(new Arrow.View({
                        model: new Arrow.Model({
                            direction: currentSong[songIndex].type,
                            startTimestamp: currentTime,
                            finalTimestamp: currentSong[songIndex].timestamp
                        })
                    }));

                    this.model.set('songIndex', songIndex+1);

                } else { //Otherwise we stop because none past it will be true either
                    stop = true;
                }

            }
        },

        runGameLoop: function() {
            var newTime = this.model.getTimeOffset();
            var currentTime = this.model.getTimeOffset();
            this.addNewArrows(currentTime);
            this.updateArrows(currentTime);

            this.model.set('currentTime', currentTime);
        },
        render: function() {
        },
    });

    Game.initialize = function(user) {

        var sensor_hit = function(r) {
            if (r == 0) {
                App.gameView.processMove('left', App.gameInstance.get('currentTime'));
            } else if (r == 1) {
                App.gameView.processMove('down', App.gameInstance.get('currentTime'));
            } else if (r == 2) {
                App.gameView.processMove('right', App.gameInstance.get('currentTime'));
            }
        }

        var loadSoundManager = function() {
            soundManager.setup({
                url: '/',
                preferFlash: false,
                onready: initGame,
            })
        }

        var setDelay = function() {
            Game.loading_start('Compensating for lag...');
            var pingCounter = 0;
            var delay = -1;
            var requestTimes = [0,0,0,0,0]
            var responseTimes = [0,0,0,0,0]
            //TODO: start loading
            Socket.socket.on('ping', function(data){
                responseTimes[data.num] = new Date().getTime();
                pingCounter++;
                if(pingCounter >= 3) {
                    var totalDelay = 0;
                    for(var i = 0; i < 3; i++){
                        totalDelay += responseTimes[i] - requestTimes[i];
                    }
                    delay = totalDelay / (3*2);
                    //TODO: end loading
                    Socket.socket.removeListener('ping',  this);

                    console.log('dleay', delay);
                    Game.loading_end();
                    initGame(delay);
                }
            });
            var getDelay = function() {
                for(var i = 0; i < 3; i++){
                    requestTimes[i] = new Date().getTime();
                    Socket.socket.emit('ping', {num: i});
                }
            }
            getDelay();
        }

        var initGame = function(delay) {
            Game.loading_start('Loading game assets...');
            Socket.startGame();
            Socket.socket.on('startGame', function(data) {
                Game.loading_end();
                var game = new Game.Model({
                    startTime: new Date().getTime() - data.time,
                    delay: delay
                });
                var gameView = new Game.View({
                    model: game,
                });
                var user = new UserMeta.Model();
                var userView = new UserMeta.View({
                    model: user
                });
                App.gameInstance = game;
                App.gameView = gameView;
                App.user = user;


                vision.startVision($, sensor_hit);

            });
        }

        var video = $('#webcam')[0];
        if (navigator.getUserMedia) {
            navigator.getUserMedia({audio: false, video: true}, function(stream) {
                video.src = stream;
                 loadSoundManager();
            }, null);
        } else {
            navigator.getMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
            if (navigator.getMedia) {
                navigator.getMedia({audio: true, video: true}, function(stream) {
                    video.src = window.URL.createObjectURL(stream);
                    loadSoundManager();
                }, null);
            }
        }
    }

    return Game;
});
