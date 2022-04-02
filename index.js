//NOTES!
//Hey! Thanks for browsing my quick and dirty JS!
//This is as much as you need to get it working for your stream!
//I hope you changed the config file before running this!
//I designed this to be a music bot first with an API...then added the Discord bot section as you can probably tell....

const { Client, Collection, Intents } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES] });
const express = require('express')
const axios = require('axios')
const app = express()
const youtubedl = require('youtube-dl-exec')
const fs = require('fs');
const config = require('./config.json');

if (fs.existsSync("playlist.json"))
{
    var playlist = require('./playlist.json')
        console.log("Playlist loaded")
} else {
    console.log("A whole new machineeeee, creating new playlist")
    var playlist = []
}

var commands = []

function getIPAddress() {
    var interfaces = require('os').networkInterfaces();
    for (var devName in interfaces) {
      var iface = interfaces[devName];
  
      for (var i = 0; i < iface.length; i++) {
        var alias = iface[i];
        if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
          return alias.address;
      }
    }
    return '0.0.0.0';
  }
  var myIP = getIPAddress()
//Music bot stuff here

function savePlaylist (saveList) {
    const saveString = JSON.stringify(saveList)
    fs.writeFile('playlist.json', saveString, (err) => {
        console.log("Save sucessful")
    })
}

//URL endpoint for the player, load this into OBS
app.get('/player', (req, res) => {
    res.sendFile('webroot/player.html' , { root : __dirname})
})

//Queries YouTube to get the raw URL and adds it to an array
app.get('/req', (req, res) => {
    if(req.query.string != ''){
        if (req.query.string.endsWith(".mp4")){
            //MP4, super easy, add to JSON
            res.send(req.query.string)
            console.log("Adding " + req.query.string + " to the playlist")
            playlist.push({"videoURL": req.query.string, "videoName": req.query.string, "type": "mp4"})
            savePlaylist(playlist)
        } else {
            if (req.query.string.includes("twitch.tv"))
            {
                //Script identified this is a Twitch URL, these work slightly differently to YouTube
                youtubedl(req.query.string, {
                    g: true,
                    noWarnings: true,
                    noCallHome: true,
                    noCheckCertificate: true,
                    preferFreeFormats: true,
                    referer: 'https://google.com'
                })
                .then(output => {
                    res.send(req.query.string)
                    console.log("Adding " + req.query.string + " stream the playlist")
                    var replacedURL = output.replaceAll("https://", "http://" + myIP + ":" + config.port + "/proxy/?url=")
                    playlist.push({"videoURL" : replacedURL, "videoName": req.query.string, "type": "twitch"})
                    savePlaylist(playlist)
                }).catch((e) => {
                    res.send("Failed to add " + req.query.string + " stream is probably offline");
                    console.log("Failed to add " + req.query.string)
                })
            } else {
                //YouTube fallback since we are expecting a word or random collection of words
                axios.get('https://www.googleapis.com/youtube/v3/search?part=snippet&order=relevance&q=' + req.query.string + '&type=video&fields=items(id,snippet/title)&maxResults=1&key=' + config.YtToken)
                .then(qRes => {
                youtubedl('https://www.youtube.com/watch?v=' + qRes.data.items[0].id.videoId, {
                    g: true,
                    noWarnings: true,
                    noCallHome: true,
                    noCheckCertificate: true,
                    preferFreeFormats: true,
                    f: 'bestvideo[ext=mp4]+bestaudio[ext=mp4]/mp4',
                    referer: 'https://google.com'
                    })
                    .then(output => {
                        res.send(qRes.data.items[0].snippet.title)
                        console.log("Adding " + qRes.data.items[0].snippet.title + " to the playlist")
                        playlist.push({"videoURL": output, "videoName": qRes.data.items[0].snippet.title, "type": "youtube"})
                        savePlaylist(playlist)
                    }).catch((e) => {
                        console.log("Failed to add " + qRes.data.items[0].snippet.title + ", there is probably no MP4 available.")
                        res.send("0")
                    })
                })
            }
        }
    }
})

//Gets the full queue and returns it in JSON
app.get('/queue', (req, res) => {
    res.send(playlist)
})

//Add command to array to execute during player.mainloop()
app.get('/addCMD', (req, res) => {
    commands.push(req.query.cmd)
    console.log("Adding " + req.query.cmd + " to command queue")
    res.send("Added to queue")
})

//Endpoint player users to get the command to execute
app.get('/getCMD', (req, res) => {
    if (commands.length != 0)
    {
        res.send(commands[0])
        console.log("Running " + commands[0])
        commands.shift()
    } else {
        res.send("0")
    }
})

//Gets the next song in the array and removes it from the array
app.get('/get', (req, res) => {
    res.json(playlist[0])
    if (playlist.length != 0)
    {
        console.log("Now playing: " + playlist[0].videoName)
    }
    let removedTrack = playlist.shift()
    savePlaylist(playlist)
})

//Send the default stream to the player, yes I defaulted it to VRCDN because I'm bias :D
app.get('/defaultStream', (req, res) => {
    res.send(config.defaultStream)
})


//Hacky Twitch HLS changing to bypass Cors problem
app.get('/proxy', (req, res) => {
    axios.get('https://' + req.query.url, { responseType: 'blob', headers: { 'Accept':'application/vnd.apple.mpegurl', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36'}})
    .then(Qres => {
        var replacedURL = Qres.data.replaceAll("https://", "http://" + myIP + ":" + config.port + "/proxy/ts?url=")
        res.send(replacedURL)
    })
})

app.get('/proxy/ts', (req,res) => {
    axios.get('https://' + req.query.url, { responseType: 'arraybuffer', headers: { 'Accept':'application/vnd.apple.mpegurl', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36'}})
    .then(Qres => {
    res.write(Qres.data)
    res.end()
    })
})

//Discord stuff below

client.once('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
	client.user.setStatus("online");
	client.user.setActivity("to wubz", {type: "LISTENING"});
});


client.on('messageCreate', msg => {
    if(msg.author.bot) return;
    var receivedMessage = msg.content.toLowerCase()

    //Discord command to add a song to the playlist
    if (receivedMessage.startsWith(config.prefix + "play")){
        if (receivedMessage === config.prefix + "play"){
            msg.channel.send("Put a song name in you spoon!\nTo add a song to the playlist, simply type " + config.prefix + "play and then the song name, Twitch URL, or direct MP4 URL.\nTo play this stream in VRChat use the url ``rtspt://stream.vrcdn.live/live/COMING_SOON``\nTo watch on the web use <https://vrcdn.live/preview/COMING_SOON>")
        } else {
            var messageString = receivedMessage.replace(/!play /g, '');
            axios.get('http://localhost:' + config.port + '/req?string=' + messageString)
            .then(res => {
                msg.channel.send("Adding " + res.data + " to playlist")
            })
        }
    }

    //Discord command to skip the current playing video
    if (receivedMessage === config.prefix + "skip")
    {
        axios.get('http://localhost:' + config.port + '/addCMD?cmd=skip')
        .then(res => {
            msg.channel.send("Skipping the current video")
        })
    }

    //Returns songs in the queue...I should probably limit this
    if (receivedMessage === config.prefix + "queue")
    {
        axios.get('http://localhost:' + config.port + '/queue')
        .then(res => {
            var curQueue = "```"
            for (var i = 0; i < res.data.length; i++){
                var curQueue = curQueue + res.data[i].videoName + "\n"
            }
            msg.channel.send(curQueue + "```")
        })
    }

})

app.listen(config.port, () => {
    console.log("Running on port " + config.port)
})

client.login(config.discordToken);

console.log("Looks like we are online! In OBS create a browser source to http://" + myIP + ":" + config.port + "/player")