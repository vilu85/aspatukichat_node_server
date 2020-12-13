// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3001;
var registry = new Map();
const activeUsers = new Set();
var users = [],
    users_connected = [];
const messageCache = new Set();
const messageCacheSize = 5;
class cachedMessage {
  constructor(userIn, contentIn) {
    this.user = userIn;
    this.content = contentIn;
    this.time = new Date();
  }
}

server.listen(port, () => {
  console.log('AspaTukiChat Server listening at port %d', port);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));

// Chatroom

var numUsers = 0;

io.on('connection', (socket) => {
  var addedUser = false;
  var uid = null;

  var cookie = socket.handshake.headers.cookie;
  var match = cookie.match(/\buser_id=([a-zA-Z0-9]{32})/);  //parse cookie header
  var userId = match ? match[1] : null;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', (data) => {
    addMessageCache(new cachedMessage(socket.username, data));
    // we tell the client to execute 'new message'
    if(data.length > 1 && data.charAt(0) == "/") {
      parseCommand(data);
    } else {
      socket.broadcast.emit('new message', {
        username: socket.username,
        message: data
      });
    }
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', (username) => {
    if (addedUser) return;
    
    if ( users_connected.indexOf(userId) < 0 ) {
      users_connected.push(userId);
    }

    if ( users.indexOf(userId) < 0 ) {
      console.log('New user connected: ' + userId);
      users.push(userId);

      // echo globally (all clients) that a person has connected
      socket.broadcast.emit('user joined', {
        username: socket.username,
        userId: userId,
        numUsers: numUsers,
        activeUsers: [...activeUsers]
      });
    }

    uid = userId;
    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    socket.userId = username;
    activeUsers.add(username);
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers,
      username: socket.username,
      userId: userId,
      activeUsers: [...activeUsers],
      messageCache: [...messageCache]
    });
    // // echo globally (all clients) that a person has connected
    // socket.broadcast.emit('user joined', {
    //   username: socket.username,
    //   numUsers: numUsers,
    //   activeUsers: [...activeUsers]
    // });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', () => {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', () => {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', () => {
    if (addedUser) {
      users_connected.splice( users_connected.indexOf(uid), 1);

      setTimeout(function () {
        if ( users_connected.indexOf(uid) < 0 ) {
          --numUsers;
          activeUsers.delete(socket.userId);
          // echo globally that this client has left
          socket.broadcast.emit('user left', {
            username: socket.username,
            userId: uid,
            numUsers: numUsers
          });

          var index = users.indexOf(uid);
          users.splice(index, 1);
        }
      }, 3000);
      
      
      // // echo globally that this client has left
      // socket.broadcast.emit('user left', {
      //   username: socket.username,
      //   numUsers: numUsers
      // });
    }
  });
  
  function replyClient(data) {
    socket.emit('new server message', {
        data: data
      });
  }

  function parseCommand(data) {
    data = data.substring(1);
    var cmd = data.split(" ")[0].toLowerCase();
    var args = data.split(" ").slice(1);
    console.log('parsing: data = %s, cmd = %s, args = %s', data, cmd, args);
    
    if (registry.has(cmd)) {
      var result = registry.get(cmd)(data);
      console.log("result = %s", result);
      
      if(result != null) {
        replyClient(result);
      }
    }
  }
});

registerCommand("help", function(cmd) {
    var parameters = smart_split(cmd, " ", false).slice(1);
    console.log(parameters);
    if (parameters.length === 0) {
        var helpText = "Commands: ";

        for (var registeredCmd of registry.keys()) {
          helpText += "/" + registeredCmd;
        }
        return "Commands: /users, /chat disable|enable [message] " + helpText;
    }

    if (parameters[0].toString().toLowerCase() === "chat") {
        //if (parameters.length === 1) {
        //    return "Please Specify title you would like to update the User Title!";
        //}
        var helpContext = "Usage: /chat disable [message]" +
                          "       /chat enable";
        return helpContext;
    }

});

registerCommand("users", function(cmd) {
    var helpContext = "Users: " + [...activeUsers];
    return helpContext;
});

//registerCommand2("chat", ["enable", ["disable", "message"]], function(cmd) {
//  var helpContext = "Users: " + [...activeUsers];
//  return helpContext;
//});

// registerCommands(["quit", "exit", "disconnect", "logout"], function(cmd) {
//     --numUsers;
//     activeUsers.delete(socket.userId);
    
//     // echo globally that this client has left
//     socket.broadcast.emit('user left', {
//       username: socket.username,
//       numUsers: numUsers
//     });
//   return "Disconnected.";
// });

function addMessageCache(msgData) {
  messageCache.add(msgData);
  if(messageCache.size > messageCacheSize) {
    console.log("messageCache.size exceeds limit, deleting the oldest entry: " + [...messageCache][0]);
    messageCache.delete([...messageCache][0]);
  }
}

function registerCommands([...commands], func) {
  [...commands].forEach(cmd => {
    console.log("registering alias " + cmd);
    registerCommand(cmd, func);
  });
}

function registerCommand(command, func) {
    registry.set(command.toString().toLowerCase(), func);
}

//function registerCommand2(command, args, func) {
//  registry.set(command.toString().toLowerCase(), func);
//}

function smart_split(input, del, empty_space) {
    if (input.length === 0) return input;
    var outputs = [""];

    var compare = function(base, insert, position) {
        if ((position + insert.length) > base.length) return false;
        for (var i = 0; i < insert.length; i++) {
            if (!(base.charAt(position + i) === insert.charAt(i))) return false;
        }
        return true;
    };

    var quotes = false;
    for (var i = 0; i < input.length; i++) {
        var char = input.charAt(i);
        if (char === '"') {
            quotes = !quotes;
            continue;
        }

        if (!quotes && compare(input, del, i)) {
            outputs.push("");
            i += del.length - 1;
            continue;
        }

        outputs[outputs.length - 1] += char;
    }

    if (!empty_space) {
        for (var i = 0; i < outputs.length; i++) {
            if (outputs[i] === "") {
                outputs.splice(i, 1);
            }
        }
    }

    return outputs;
}