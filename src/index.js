// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;
var registry = new Map();
const activeUsers = new Set();

server.listen(port, () => {
  console.log('AspaTukiChat Server listening at port %d', port);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));

// Chatroom

var numUsers = 0;

io.on('connection', (socket) => {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', (data) => {
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

    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    socket.userId = username;
    activeUsers.add(username);
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers,
      username: socket.username,
      activeUsers: [...activeUsers]
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers,
      activeUsers: [...activeUsers]
    });
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
      --numUsers;
      activeUsers.delete(socket.userId);
      
      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
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

        registry.keys.forEach(registeredCmd => {
          helpText += "/" + registeredCmd;
        });
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

function registerCommands([...commands], func) {
  [...commands].forEach(cmd => {
    console.log("registering alias " + cmd);
    registerCommand(cmd, func);
  });
}

function registerCommand(command, func) {
    registry.set(command.toString().toLowerCase(), func);
}

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