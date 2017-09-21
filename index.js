'use strict'

const AWS = require('aws-sdk')
const S3 = new AWS.S3({signatureVersion: 'v4'})
const Sharp = require('sharp')
const Imagemin = require('imagemin')

const BUCKET = process.env.BUCKET
const URL = process.env.URL

// Imagemin options object for all image types
const imageminOptions = {
  optimizationLevel: +7,
  progressive: true,
  interlaced: true
}

exports.handler = function (event, context, callback) {
  const key = event.queryStringParameters.key
  const match = key.match(/(\d+)x(\d+)\/(.*)/)
  const width = parseInt(match[1], 10)
  const height = parseInt(match[2], 10)
  const originalKey = match[3]

  S3.getObject({Bucket: BUCKET, Key: originalKey}).promise()
    .then(data => Sharp(data.Body)
      .resize(width, height)
      .toFormat('png')
      .toBuffer()
    )
    .then(buffer => new Promise((resolve, reject) =>
      new Imagemin()
        .src(buffer)
        .use(Imagemin.jpegtran(imageminOptions))
        .use(Imagemin.gifsicle(imageminOptions))
        .use(Imagemin.optipng(imageminOptions))
        .use(Imagemin.svgo({plugins: imageminOptions.svgoPlugins || []}))
        .run(function (err, files) {
          if (err) return reject(err)
          console.log('Optimized! Final file size reduced from ' + buffer.length + ' to ' + files[0].contents.length + ' bytes')
          resolve(files[0].contents)
        })
      )
    )
    .then(buffer => S3.putObject({
      Body: buffer,
      Bucket: BUCKET,
      ContentType: 'image/png',
      Key: key
    }).promise())
    .then(() => callback(null, {
      statusCode: '301',
      headers: {'location': `${URL}/${key}`},
      body: ''
    }))
    .catch(err => callback(err))
}
