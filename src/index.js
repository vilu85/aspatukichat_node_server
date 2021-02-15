const serverProtocolVersion = "1.3.0";
// Setup basic express server
var express = require('express');
var fs = require('fs');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3001;
var registry = new Map();
var helpers = require('./helpers');
var commandRegistry = require('./commandRegistry');

var users = [],
    users_connected = [],
    sessions = [];
const messageCache = new Set();
const messageCacheSize = 5;
class cachedMessage {
  constructor(userIn, contentIn, imageIn = undefined) {
    this.user = userIn;
    this.content = contentIn;
    this.time = new Date();
    this.image = imageIn;
  }
}
class chatUser {
  constructor(username, token, id) {
    this.username = username;
    this.token = token;
    this.id = id;
  }
}

const activeUsers = new Set();
server.listen(port, () => {
  console.log('AspaTukiChat Server listening at port %d', port);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));

// Chatroom

io.on('connection', (socket) => {
  var isConnected = true;
  //var uid = null;
  var cookie = socket.handshake.headers.cookie;
  var match = cookie.match(/\buser_id=([a-zA-Z0-9]{32})/);  //parse cookie header
  var userId = match ? match[1] : null;

  const token = userId;//socket.handshake.query.token;
  const id = socket.id;  

  // Connected
  onConnect(id, token, (data) => {
    //This is run only if the session does not already exists
    console.log('New user connected: id = %s, token = %s', data.id, data.token);
    isConnected = false;
  });

  socket.on('disconnect', () => {
      // Disconnected
      onDisconnect(id, token, 5000, (data) => {
        var disconnectedUser = getChatUser(data.token);
        activeUsers.delete(disconnectedUser);
        // echo globally that this client has left
        socket.broadcast.emit('user left', {
          username: disconnectedUser.username,
          numUsers: activeUsers.size
        });
        console.log('User disconnected: id = %s, token = %s, chatUser = %s', data.id, data.token, disconnectedUser);
      });
  });

  // when the client emits 'new message', this listens and executes
  socket.on('new message', (data) => {
    console.log('socket.on: new message, data = %s', data);
    // we tell the client to execute 'new message'
    if(data.length > 1 && data.charAt(0) == "/") {
      parseCommand(data);
      commandRegistry.parseCommand(socket, data);
    } else {
      addMessageCache(new cachedMessage(socket.username, data));
      socket.broadcast.emit('new message', {
        username: socket.username,
        message: data
      });
    }
  });

  // when the client emits 'new image message', this listens and executes
  socket.on('new image message', (data) => {
    addMessageCache(new cachedMessage(socket.username, data.message, data.image));
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data.message,
      image: data.image
    });  
  });

  socket.on('join', (data) => {
    console.log('socket.on: join, data = %s', data);
    socket.username = data.username;
    socket.userId = userId;

    if(!helpers.checkCompatibility(serverProtocolVersion, data.clientVersion)) {
      console.log('Server and client protocol version mismatch!');
      //TODO: emit error to client and disconnect
    }

    if(getChatUser(token) == undefined) {
      console.log('socket.on: join, getChatUser(%s) returned undefined, adding new active user', token);
      activeUsers.add(new chatUser(data.username, token, id));
    }

    socket.emit('login', {
      numUsers: activeUsers.size,
      username: socket.username,
      userId: userId,
      activeUsers: [...activeUsers],
      messageCache: [...messageCache],
      serverProtocolVersion: serverProtocolVersion
    });

    if (isConnected) return;
    console.log('socket.on: join, new user connected so broadcasting it to all clients.');
    
      // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      userId: userId,
      numUsers: activeUsers.size,
      activeUsers: [...activeUsers]
    });

    isConnected = true;
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', (username) => {
    console.log('socket.on: add user, username = %s', username);
    socket.username = username;
    socket.userId = userId;

    if(getChatUser(token) == undefined) {
      console.log('socket.on: add user, getChatUser(%s) returned undefined, adding new active user', token);
      activeUsers.add(new chatUser(username, token, id));
    }

    socket.emit('login', {
      numUsers: activeUsers.size,
      username: socket.username,
      userId: userId,
      activeUsers: [...activeUsers],
      messageCache: [...messageCache],
      serverProtocolVersion: serverProtocolVersion
    });

    if (isConnected) return;
    console.log('socket.on: add user, new user connected so broadcasting it to all clients.');
    // if ( users_connected.indexOf(userId) < 0 ) {
    //   users_connected.push(userId);
    // }

    //uid = userId;
    // we store the username in the socket session for this client
    
    
    
    
    //isConnected = true;
    // // echo globally (all clients) that a person has connected
    // socket.broadcast.emit('user joined', {
    //   username: socket.username,
    //   numUsers: numUsers,
    //   activeUsers: [...activeUsers]
    // });
    // if ( users.indexOf(userId) < 0 ) {
    //   console.log('New user connected: ' + userId);
    //   users.push(userId);

      // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      userId: userId,
      numUsers: activeUsers.size,
      activeUsers: [...activeUsers]
    });

    isConnected = true;
    // }
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
  // socket.on('disconnect', () => {
  //   if (isConnected) {
  //     users_connected.splice( users_connected.indexOf(uid), 1);

  //     setTimeout(function () {
  //       if ( users_connected.indexOf(uid) < 0 ) {
  //         activeUsers.delete(socket.username);
  //         // echo globally that this client has left
  //         socket.broadcast.emit('user left', {
  //           username: socket.username,
  //           userId: uid,
  //           numUsers: activeUsers.size
  //         });

  //         var index = users.indexOf(uid);
  //         users.splice(index, 1);
  //       }
  //     }, 8000);
  //   }
  // });

  // when the client emits 'image', we broadcast it to others
  socket.on('image', async image => {
    console.log('socket.on image called, creating and writing image to the buffer');
    const buffer = Buffer.from(image, 'base64');
    //TODO: Try buffer
    socket.broadcast.emit('image', {
      username: socket.username,
      image: image
    });
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

function pushToken(id, token) {
  if (getSession(token)) {
      sessions.forEach((session) => {
          if (session.token === token) {
              session.connections.push(id);
          }
      });
  } else {
      sessions.push({ token, connections: [id] });
  }
}

function getSession(token) {
  return sessions.filter((session) => session.token === token)[0];
}

function disconnectConnection(id, token) {
  sessions.forEach((session, index) => {
      if (session.token === token) {
          session.connections.splice(session.connections.indexOf(id), 1);
          if (session.connections.length == 0) {
              sessions.splice(index, 1);
          }
      }
  });
}

function onConnect(id, token, callback) {
  if (!getSession(token)) {
      pushToken(id, token);
      callback({ id, token });
  } else {
      pushToken(id, token);
  }
}

function getChatUser(token) {
  return [...activeUsers].filter(usr => usr.token == token )[0];
}

function onDisconnect(id, token, timeout, callback) {
  setTimeout(() => {
      disconnectConnection(id, token);
      if (!getSession(token)) callback({ id, token });
  }, timeout);
}

function onLogout() {
  sessions.forEach((session) => {
      if (session.token === token) {
          session.connections.forEach((connection) => {
              io.to(connection).emit('logout');
          });
      }
  });
}

/**
 * Sends message to all connections user has
 */
function pushMessage(token, data) {
  let session = getSession(token);
  if (session) {
      let connections = session.connections;
      connections.forEach((connection) => {
          io.to(connection).emit('push_message', data);
      });
  }
  return session != undefined;
}

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

//commandRegistry.registerCommands(["users", "whoisin"], () => { return "Users: " + [...activeUsers].map(x => x.username).toString(); });

registerCommand("users", function(cmd) {
    var helpContext = "Users: " + [...activeUsers].map(x => x.username).toString();
    return helpContext;
});

//registerCommand2("chat", ["enable", ["disable", "message"]], function(cmd) {
//  var helpContext = "Users: " + [...activeUsers];
//  return helpContext;
//});

registerCommands(["quit", "exit", "disconnect", "logout"], function(cmd) {
    activeUsers.delete(socket.userId);
    
    // echo globally that this client has left
    socket.broadcast.emit('user left', {
      username: socket.username,
      numUsers: activeUsers.size
    });
    return "Disconnected.";
});

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
        for (var j = 0; j < outputs.length; j++) {
            if (outputs[j] === "") {
                outputs.splice(j, 1);
            }
        }
    }

    return outputs;
}