const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const fs = require('fs');

app.get("/", (req, res) => {
   res.sendFile( __dirname + "/" + "index.html" )
});

app.get("/index.js", (req, res) => {
    res.sendFile( __dirname + "/" + "index.js" )
});

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on("path", (e) => {
        fs.readFile(__dirname + "/" + e, 'utf8' , (err, data) => {
            if (err) {
              console.error(err)
              return
            }
            
            io.emit("data", data);
        });
    });
});

http.listen(3000, () => {
    console.log('listening on *:3000');
});