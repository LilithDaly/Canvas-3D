# Canvas-3D
I understand that webgl is a thing.
## Installation
A example html file and nodejs server are provided, but the least needed for the singular index.js file to work is a reference to 
```html
<script src="/socket.io/socket.io.js"></script>
```
in a main html file, and a socket.io listener in a node server with structure similar to:
```js
socket.on("path", (e) => {
    fs.readFile(__dirname + "/" + e, 'utf8' , (err, data) => {
        if (err) {
          console.error(err)
          return
        }
            
        io.emit("data", data);
    });
});
```
