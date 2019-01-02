const express = require('express')
const youtubedl = require('youtube-dl')
const { getVideoDurationInSeconds } = require('get-video-duration')
const URL = require('url')
const PATH = require('path')
const PORT = process.env.PORT || 5000
express().get('/add.json', (req, res) => {
  let url = req.query.url
  m3u8 = () => {
    url = Buffer.from(url, 'base64').toString('utf8')
    let jsonObj = {
      title: decodeURIComponent(req.query.title),
      live: req.query.live == "true",
      sources: [
        {
          url: url,
          quality: [240, 360, 480, 540, 720, 1080, 1440].includes(Number(req.query.quality)) ? Number(req.query.quality) : 720,
          contentType: req.query.type && decodeURIComponent(req.query.type) || 'application/x-mpegURL',
          duration: Number(req.query.duration) || 30
        }
      ]
    }
    res.send(jsonObj)
  }
  req.query.url && req.query.m3u8 ? m3u8() : req.query.url && youtubedl.getInfo(decodeURIComponent(req.query.url.replace(/^http:\/\//i, 'https://')), [], function(err, info) {
    if (err) console.error(err)
    else {
      if (!info.title) info = info[0];
      contentType = ext => {
        let contentType = [
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
      let url = info.manifest_url ? info.manifest_url.replace(/^http:\/\//i, 'https://') : info.url.replace(/^http:\/\//i, 'https://')
      let jsonObj = {
        title: req.query.title ? decodeURIComponent(req.query.title) : !info.title.toLowerCase().startsWith(info.extractor_key.toLowerCase()) ? info.extractor_key + ' - ' + info.title : info.title,
        live: req.query.live == "true",
        sources: [
          {
            url: url,
            quality: Number(req.query.quality) || info.height,
            contentType: req.query.type ? decodeURIComponent(req.query.type) : info.manifest_url ? 'application/x-mpegURL' : contentType(PATH.extname(URL.parse(url).pathname)) || 'video/mp4'
          }
        ]
      }
      if (![240, 360, 480, 540, 720, 1080, 1440].includes(jsonObj.sources[0].quality)) jsonObj.sources[0].quality = 720;
      if (info.thumbnail && info.thumbnail.startsWith('http')) jsonObj.sources[0].thumbnail = info.thumbnail.replace(/^http:\/\//i, 'https://')
      if (Number(req.query.duration)) jsonObj.duration = Number(req.query.duration)
      else if (info._duration_raw) jsonObj.duration = info._duration_raw
      if (!jsonObj.live && !jsonObj.duration) getVideoDurationInSeconds(url).then((duration) => {
        jsonObj.duration = duration
        res.send(jsonObj)
      }).catch(() => {
        jsonObj.duration = 30
        res.send(jsonObj)
      })
      else res.send(jsonObj)
    }
  });
}).listen(PORT, () => console.log(`Listening on ${ PORT }`))
