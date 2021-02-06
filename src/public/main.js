class cachedMessage {
  constructor(userIn, contentIn, timeIn, imageIn = undefined) {
    this.user = userIn;
    this.content = contentIn;
    this.time = timeIn;
    this.image = imageIn;
  }

  getData() {
    var data = {
      'username' : this.user,
      'message' : this.content,
      'time' : this.time,
      'image' : (this.image || undefined)
    };

    return data;
  }
}
class chatUser {
  constructor(username, token, id) {
    this.username = username;
    this.token = token;
    this.id = id;
  }

  getData() {
    var data = {
      'username' : this.username,
      'token' : this.token,
      'id' : this.id
    };

    return data;
  }
}
$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize variables
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $messages = $('.messages'); // Messages area
  var $inputMessage = $('.inputMessage'); // Input message input box

  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page
  
  const inboxPeople = document.querySelector(".inbox__people"); // User list
  var $btnScreenshot = $('#btnScreenshot');
  var $imgviewermodal = $('#imgViewerModal');

  // Prompt for setting a username
  var username;
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput = $usernameInput.focus();
  var screenshot;

  const generateHash = (len) => {
    var symbols = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    var hash = '';
    for (var i = 0; i < len; i++) {
      var symIndex = Math.floor(Math.random() * symbols.length);
      hash += symbols.charAt(symIndex);
    }
    return hash;
  };
  
  if (!/\buser_id=/.test(document.cookie)) { //if no 'user_id' in cookies
    document.cookie = 'user_id=' + generateHash(32);  //add cookie 'user_id'
  }
  var socket = io();
  // in 1.0
  // var socket = io.connect('http://kohabox', {
  //   'path': '/chat/socket.io'
  // });
  const users = new Set();
  
  const addToUsersBox = (userName) => {
    if (!inboxPeople || !!document.querySelector(`.${userName}-userlist`)) {
      return;
    }

    const userBox = `
      <div class="chat_ib ${userName}-userlist">
        <h5>${userName}</h5>
      </div>
    `;
    inboxPeople.innerHTML += userBox;
  };

  const removeFromUsersBox = (userName) => {
    if (!inboxPeople || !!document.querySelector(`.${userName}-userlist`)) {
      document.querySelector(`.${userName}-userlist`).remove();
    }
  };

  const addParticipantsMessage = (data) => {
    var message = '';
    if (data.numUsers === 1) {
      message += "There's 1 participant";
    } else {
      message += "There are " + data.numUsers + " participants";
    }
    log(message);
  };

  // Sets the client's username
  const setUsername = () => {
    username = cleanInput($usernameInput.val().trim());

    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      // Tell the server your username
      socket.emit('add user', username);
    }
  };

  // Sends a chat message
  const sendMessage = () => {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({
        username: username,
        message: message,
        image: (screenshot !== undefined ? screenshot : undefined)
      });

      if(screenshot !== undefined) {
        var messageWithImage = {
          message : message,
          image : screenshot
        };
        socket.emit('new image message', messageWithImage);
        screenshot = undefined;
      } else {
        // tell server to execute 'new message' and send along one parameter
        socket.emit('new message', message);
      }
    }
  };

  // Log a message
  const log = (message, options) => {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  };

  // Adds a cached chat message to the message list
  const addCachedMessage = (cachedMsg) => {
    addChatMessage(cachedMsg.getData(), { 'time' : cachedMsg.time });
  };

  // Adds the visual chat message to the message list
  const addChatMessage = (data, options) => {
    // Don't fade the message in if there is an 'X was typing'
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    const time = (options.time ?  new Date(options.time) : new Date());
    const formattedTime = time.toLocaleString("en-US", { hour: "numeric", minute: "numeric" });
    var $timeDiv = $('<span class="time_date"/>')
      .text(formattedTime);
    var $infoDiv =$('<li class="message_info"/>')
      .append($timeDiv);
    
    var $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', getUsernameColor(data.username));
    var $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);

    var typingClass = data.typing ? 'typing' : '';
    var $imageDiv = '';

    if(data.image !== undefined) {
      // create image with
      const img = new Image();
      // change image type to whatever you use, or detect it in the backend 
      // and send it if you support multiple extensions
      img.src = `${data.image}`;
      var $img = $(img).addClass("screenshot");

      // Insert it into the DOM
      $imageDiv = $('<span class="screenshot">')
        .append($img);
    }

    var $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv, $imageDiv, $messageBodyDiv, $infoDiv);

    addMessageElement($messageDiv, options);
  };

  // Adds the visual chat typing message
  const addChatTyping = (data) => {
    data.typing = true;
    data.message = 'is typing';
    addChatMessage(data);
  };

  // Removes the visual chat typing message
  const removeChatTyping = (data) => {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  };

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  const addMessageElement = (el, options) => {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  };

  // Prevents input from having injected markup
  const cleanInput = (input) => {
    return $('<div/>').text(input).html();
  };

  // Updates the typing event
  const updateTyping = () => {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(() => {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  };

  // Gets the 'X is typing' messages of a user
  const getTypingMessages = (data) => {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  };

  // Gets the color of a username through our hash function
  const getUsernameColor = (username) => {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
       hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  };

  // Send image to server
  const sendImage = (image) => {
    // Server side
    socket.emit('image', image.toString('base64')); // image should be a buffer
  };
  
  // Keyboard events

  $window.keydown(event => {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUsername();
      }
    }
  });

  $inputMessage.on('input', () => {
    updateTyping();
  });

  // Click events

  // Focus input when clicking anywhere on login page
  $loginPage.click(() => {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(() => {
    $inputMessage.focus();
    // $('.inputMessage')
  });

  $btnScreenshot.click(() => {
    html2canvas(document.body).then(function(canvas) {
      var screenshot1 = canvas;
      var screenshot2 = screenshot1.toDataURL();
      screenshot = screenshot2.toString('base64');
      //document.body.appendChild(canvas);
      console.log("Screenshot captured and saved in variable 'screenshot'");
      // sendImage(screenshot.toDataURL());
    });
  });

  // Show image viewer modal when clicking on the any screenshot image
  $messages.click((e) => {
    if(e.target.className == "screenshot") {
      $('#imgViewer').html('').append( $(e.target).clone().removeClass('screenshot') );
      $imgviewermodal.css("display", "block");
    }
  });

  // Close image viewer modal when clicking on 'X' button
  $('.imgclose').click(() => {
    $imgviewermodal.css("display", "none");
  });

  // Close image viewer modal when clicking anywhere in window
  $imgviewermodal.click(()=>{
    $imgviewermodal.css("display", "none");
  });

  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('login', (data) => {
    connected = true;
    // Display the welcome message
    var message = "AspaTukiChat – ";
    log(message, {
      prepend: true
    });
    addParticipantsMessage(data);
    data.activeUsers.map((user) => { users.add(user); addToUsersBox(user.username);});
    if(data.messageCache) {
      data.messageCache.map((msgEntry) => {
        addCachedMessage(new cachedMessage(msgEntry.user, msgEntry.content, msgEntry.time, msgEntry.image));
      });
    }  
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', (data) => {
    addChatMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', (data) => {
    log(data.username + ' joined');
    data.activeUsers.map((user) => { users.add(user); });
    addToUsersBox(data.username);
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', (data) => {
    log(data.username + ' left');
    addParticipantsMessage(data);
    removeChatTyping(data);
    removeFromUsersBox(data.username);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', (data) => {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', (data) => {
    removeChatTyping(data);
  });

  socket.on('disconnect', () => {
    log('you have been disconnected');
  });

  socket.on('reconnect', () => {
    log('you have been reconnected');
    if (username) {
      socket.emit('add user', username);
    }
  });

  socket.on('reconnect_error', () => {
    log('attempt to reconnect has failed');
  });
  
  // Whenever the server emits 'new server message', update the chat body
  socket.on('new server message', (data) => {
    console.log("data: %s", data);
    var data2 = { username : 'System', message : data.data };
    addChatMessage(data2);
  });

  // Receive images
  socket.on('image', (data) => {
    console.log("socket.on image event called");
    // create image with
    const img = new Image();
    // change image type to whatever you use, or detect it in the backend 
    // and send it if you support multiple extensions
    img.src = `${data.image}`; 
    // Insert it into the DOM
    var $messageBodyDiv = $('<span class="messageBody">')
      .append(img);

    var $messageDiv = $('<li class="message"/>')
      .append($messageBodyDiv);

    addMessageElement($messageDiv, []);
  });
});
