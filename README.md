# Canvas-3D
I understand that webgl is a thing, and I understand that there are libraries which I could have used for matrix multiplication and similar issues. My main goal was just to make a 3d rendering engine to gain a better understanding of the math required. This is also a purely self-serving endeavor to add 3d graphics to my Twitch.tv overlay.

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
If anyone shows even a modicum of interest in this, I could look into making this a npm module, but I seriously doubt that will be the case.

## Support
Reach out to me with any questions that you have, though I doubt anyone will see this repo, and even fewer will take it seriously. The best place to reach me is Discord: LilithFool#6449. You can also try to reach out to me via email: contact@lilithdaly.com.

## Roadmap
Plans for the future include:
- Texturing, obviously.
- Adding a depth buffer.
- Rewriting lighting.
    - Either using a per-vertex or per-pixel method depending on how spicy I'm feeling.
    - If I go with per-pixel I would most likely add in normal map functionality.
    - Most likely including really basic specular highligting.
- Animation? Maybe???

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
Also, and really more pressingly, consider contributing your time and resources to one of the other brilliant repos on this site. I will not be held responsible for an hour you sink trying to rewrite my horrible code.

## License
[MIT](https://choosealicense.com/licenses/mit/)
