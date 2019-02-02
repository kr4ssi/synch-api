const express = require('express')
const request = require('request')
const youtubedl = require('youtube-dl')
const { getVideoDurationInSeconds } = require('get-video-duration')
const Instagram = require('instagram-nodejs-without-api')
const Insta = new Instagram()
const URL = require('url')
const PATH = require('path')
const writer = require('m3u').extendedWriter();
const PORT = process.env.PORT || 5000
const STATICS = []
let index = 0
express().get('/add.json', (req, res) => {
  if (req.query.url) {
    const tryToGetDurationAndSend = jsonObj => {
      const sendOrCreate = () => {
        if (req.query.ytdl) {
          jsonObj.sources[0].url = 'https://' + req.get('host') + req.originalUrl
          //jsonObj.sources[0].contentType = 'video/mp4'
        }
        if (req.query.create) {
          let static = STATICS.find(static => static.json == jsonObj)
          //obj &&
          if (index < 0) {
            index = STATICS.push({index: index, json: jsonObj}) - 1
            if (index > 10) {
              STATICS.shift()
              index--
            }
          }
          res.send('/static' + index + '.json')
        }
        else res.send(jsonObj)
      }
      ((jsonObj.live || jsonObj.duration) ? Promise.resolve() : getVideoDurationInSeconds(jsonObj.sources[0].url).then((duration) => {
        jsonObj.duration = duration
      })).then(sendOrCreate).catch(sendOrCreate)
    }
    const allowedQuality = [240, 360, 480, 540, 720, 1080, 1440]
    const jsonObj = {
      title: decodeURIComponent(req.query.title),
      live: req.query.live == "true",
      duration: Number(req.query.duration) || 0,
      sources: [
        {
          url: decodeURIComponent(req.query.url).replace(/^http:\/\//i, 'https://'),
          quality: req.query.quality && allowedQuality.includes(Number(req.query.quality)) ? Number(req.query.quality) : 720,
          contentType: req.query.type && decodeURIComponent(req.query.type) || 'application/x-mpegURL'
        }
      ]
    }
    if (jsonObj.sources[0].url.match(/.*\.m3u8/)) {
      tryToGetDurationAndSend(jsonObj)
    }
    else if (jsonObj.sources[0].url.match(/https?:\/\/(www\.)?nxload\.com\/(embed-)?\w+\.html/i)) {
      request(jsonObj.sources[0].url.replace(/embed-/i, ''), (err, response, body) => {
        if (err) return console.log(err)
        if (response.statusCode == 200) {
          const regMatch = body.match(/new Clappr\.Player\({\s+sources: \["([^"]+)/i)
          if (regMatch) {
            jsonObj.sources[0].url = regMatch[1].replace(/^http:\/\//i, 'https://')
            jsonObj.title = body.match(/<title>Watch ([^<]+)/i)[1],
            tryToGetDurationAndSend(jsonObj)
          }
        }
      })
    }
    else if (jsonObj.sources[0].url.match(/https?:\/\/(www\.)?kinoger\.to\/stream\/[\/-\w]+\.html/i)) {
      request(jsonObj.sources[0].url, (err, response, body) => {
        if (err) return console.log(err)
        if (response.statusCode == 200) {
          let regMatch = body.match(/<div id="kinog-player"><iframe src="https?:\/\/([^"]+)/i)
          if (regMatch) {
            jsonObj.title = body.match(/<meta property="og:title" content="([^""]+)/i)[1],
            request('https://s1.' + regMatch[1], (err, response, body) => {
              if (err) return console.log(err)
              if (response.statusCode == 200) {
                regMatch = body.match(/', type: 'video\/mp4'},{url: \'\/\/([^\']+)/i)
                if (regMatch) {
                  jsonObj.sources[0].url = 'https://' + regMatch[1]
                  tryToGetDurationAndSend(jsonObj)
                }
              }
            })
          }
        }
      })
    }
    else youtubedl.getInfo(jsonObj.sources[0].url, [], function(err, info) {
      if (err) console.error(err)
      else {
        if (!info.title) info = info[0];
        const contentType = ext => {
          const contentType = [
            {type: 'video/mp4', ext: ['.mp4']},
            {type: 'video/webm', ext: ['.webm']},
            {type: 'application/x-mpegURL', ext: ['.m3u8']},
            {type: 'video/ogg', ext: ['.ogv']},
            {type: 'application/dash+xml', ext: ['.mpd']},
            {type: 'rtmp/flv', ext: ['.flv']},
            {type: 'audio/aac', ext: ['.aac']},
            {type: 'audio/ogg', ext: ['.ogg']},
            {type: 'audio/mpeg', ext: ['.mp3', '.m4a']}
          ].find(contentType => contentType.ext.includes(ext))
          if (contentType != undefined) return contentType.type
        }
        jsonObj.title = !info.title.toLowerCase().startsWith(info.extractor_key.toLowerCase()) ? info.extractor_key + ' - ' + info.title : info.title
        if (info.manifest_url) jsonObj.sources[0].url = info.manifest_url.replace(/^http:\/\//i, 'https://')
        else {
          jsonObj.sources[0].url = info.url.replace(/^http:\/\//i, 'https://')
          jsonObj.sources[0].contentType = contentType(PATH.extname(URL.parse(jsonObj.sources[0].url).pathname)) || 'video/mp4'
        }
        if (allowedQuality.includes(info.height)) jsonObj.sources[0].quality = info.height;
        if (info.thumbnail && info.thumbnail.match(/^https?:\/\//i)) jsonObj.thumbnail = info.thumbnail.replace(/^http:\/\//i, 'https://')
        if (info._duration_raw) jsonObj.duration = info._duration_raw
        tryToGetDurationAndSend(jsonObj)
      }
    });
  }
}).get('/static:index.json', (req, res) => {
  res.send(STATICS[req.params.index])
}).get('/pic.jpg', (req, res) => {
  if (req.query.url) {
    if (req.query.url.match(/https?:\/\/(www\.)?instagram\.com\/p\/\w+\/?/i)) {
      Insta.getMediaInfoByUrl(req.query.url).then(info => res.redirect(info.thumbnail_url.replace(/^http:\/\//i, 'https://')))
    }
  }
}).get('/', (req, res) => {
  res.send('')
}).listen(PORT, () => console.log(`Listening on ${ PORT }`))
